/**
 * Cliente de Mercado Pago, hablado directo contra su API REST.
 *
 * No se usa el SDK oficial a propósito: de todo lo que trae hacen falta dos
 * llamadas, y una dependencia que mueve plata es una que hay que auditar en
 * cada actualización. Con `fetch` se ve exactamente qué se manda y qué vuelve.
 *
 * Cada empresa cobra en su propia cuenta, así que el access token llega por
 * parámetro en cada llamada y nunca sale de acá hacia el navegador.
 */

const API = "https://api.mercadopago.com";

export interface PreferenciaCreada {
  id: string;
  /** URL de pago. Es lo que se convierte en el QR que mira el cliente. */
  initPoint: string;
}

export interface ItemPreferencia {
  title: string;
  quantity: number;
  unitPrice: number;
}

interface OpcionesPreferencia {
  accessToken: string;
  items: ItemPreferencia[];
  /** Nuestro id de pedido. Vuelve en el pago y es cómo lo reconocemos. */
  externalReference: string;
  /** A dónde vuelve el cliente después de pagar, si su app lo redirige. */
  backUrl: string;
  /** Dónde nos avisa Mercado Pago. Se omite si no hay URL pública. */
  notificationUrl?: string;
  descripcion: string;
}

async function pedir(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const texto = await res.text();
  let cuerpo: unknown = null;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = texto;
  }

  if (!res.ok) {
    // El mensaje de Mercado Pago es más útil que "400": suele decir
    // exactamente qué campo no le gustó o si el token está vencido.
    const detalle =
      (cuerpo as { message?: string } | null)?.message ?? `Mercado Pago respondió ${res.status}`;
    throw new Error(`Mercado Pago: ${detalle}`);
  }

  return cuerpo;
}

/**
 * Crea la preferencia de pago de un pedido y devuelve la URL a mostrar como QR.
 *
 * `binary_mode` deja el pago en aprobado o rechazado, sin el estado intermedio
 * "en revisión": el cliente está parado esperando el sánguche, no puede quedar
 * a la espera de que alguien revise la operación.
 */
export async function crearPreferencia(o: OpcionesPreferencia): Promise<PreferenciaCreada> {
  const cuerpo = {
    items: o.items.map((i) => ({
      title: i.title.slice(0, 250),
      quantity: i.quantity,
      unit_price: Number(i.unitPrice.toFixed(2)),
      currency_id: "ARS",
    })),
    external_reference: o.externalReference,
    statement_descriptor: o.descripcion.slice(0, 22),
    binary_mode: true,
    back_urls: { success: o.backUrl, pending: o.backUrl, failure: o.backUrl },
    ...(o.notificationUrl ? { notification_url: o.notificationUrl } : {}),
  };

  const res = (await pedir(`${API}/checkout/preferences`, o.accessToken, {
    method: "POST",
    body: JSON.stringify(cuerpo),
  })) as { id?: string; init_point?: string };

  if (!res?.id || !res?.init_point) {
    throw new Error("Mercado Pago no devolvió el enlace de pago");
  }
  return { id: res.id, initPoint: res.init_point };
}

export interface PagoEncontrado {
  id: string;
  aprobado: boolean;
  estado: string;
}

/**
 * Busca si un pedido ya tiene un pago aprobado.
 *
 * Se consulta por nuestra referencia y no por el id del pago porque así sirve
 * igual cuando el aviso de Mercado Pago no llegó: el tótem pregunta cada unos
 * segundos y no depende de que el webhook funcione. En una tablet de mostrador
 * eso importa, porque la notificación puede perderse y el cliente se queda
 * mirando una pantalla que no avanza.
 */
export async function buscarPagoDePedido(
  accessToken: string,
  externalReference: string,
): Promise<PagoEncontrado | null> {
  const url = `${API}/v1/payments/search?external_reference=${encodeURIComponent(
    externalReference,
  )}&sort=date_created&criteria=desc`;

  const res = (await pedir(url, accessToken)) as {
    results?: Array<{ id: number | string; status: string }>;
  };

  const pagos = res?.results ?? [];
  if (pagos.length === 0) return null;

  const aprobado = pagos.find((p) => p.status === "approved");
  const elegido = aprobado ?? pagos[0];
  return {
    id: String(elegido.id),
    aprobado: elegido.status === "approved",
    estado: elegido.status,
  };
}

/** Un pago puntual, para cuando el aviso de Mercado Pago trae su id. */
export async function traerPago(
  accessToken: string,
  paymentId: string,
): Promise<{ id: string; aprobado: boolean; externalReference: string | null } | null> {
  const res = (await pedir(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, accessToken)) as {
    id?: number | string;
    status?: string;
    external_reference?: string | null;
  };
  if (!res?.id) return null;
  return {
    id: String(res.id),
    aprobado: res.status === "approved",
    externalReference: res.external_reference ?? null,
  };
}

/**
 * La Public Key y el Access Token empiezan igual (`APP_USR-` o `TEST-`), así
 * que el prefijo no alcanza para distinguirlos y es facilísimo pegar el que no
 * es. Lo que sí los separa es la forma: la Public Key es el prefijo seguido de
 * un UUID y nada más.
 */
export function pareceClavePublica(token: string): boolean {
  return /^(APP_USR|TEST)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    token.trim(),
  );
}

/**
 * Le pregunta a Mercado Pago si el token sirve, consultando la cuenta a la que
 * pertenece.
 *
 * Se hace al guardar y no al cobrar a propósito: una credencial equivocada
 * tiene que fallar cuando el dueño la está configurando, no cuando hay un
 * cliente parado frente al tótem con el pedido armado.
 */
export async function verificarCredencial(
  accessToken: string,
): Promise<{ ok: true; cuenta: string } | { ok: false; motivo: string }> {
  try {
    const res = await fetch(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        motivo: "Mercado Pago no acepta esa credencial. Revisá que sea el Access Token.",
      };
    }
    if (!res.ok) {
      return { ok: false, motivo: `Mercado Pago respondió ${res.status} al validar la credencial` };
    }

    const cuenta = (await res.json()) as { nickname?: string; email?: string };
    return { ok: true, cuenta: cuenta.nickname ?? cuenta.email ?? "tu cuenta" };
  } catch {
    // Sin internet o Mercado Pago caído: no es motivo para no dejar guardar.
    return { ok: true, cuenta: "" };
  }
}

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, locations, paymentSettings } from "@/db/schema";
import { traerPago } from "./mercadopago";
import { acreditarPedido } from "./acreditar";

/**
 * Aviso de Mercado Pago de que pasó algo con un pago.
 *
 * Lo único que se toma del aviso es el id del pago: **nunca** si está aprobado
 * ni por cuánto. Eso se le pregunta a Mercado Pago con el token de la empresa,
 * porque este endpoint es público y cualquiera puede golpearlo diciendo que un
 * pedido se pagó. El aviso es un "andá a fijarte", no una fuente de verdad.
 *
 * Siempre responde 200, incluso cuando algo falla: si devuelve error, Mercado
 * Pago reintenta durante horas, y el tótem igual se entera por su cuenta
 * preguntando cada unos segundos.
 */
export async function handleMercadoPagoWebhook(request: Request): Promise<Response> {
  const ok = () => new Response("ok", { status: 200 });

  try {
    const url = new URL(request.url);
    let paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");

    if (!paymentId && request.method === "POST") {
      const cuerpo = (await request.json().catch(() => null)) as {
        data?: { id?: string | number };
        type?: string;
        action?: string;
      } | null;
      const tipo = cuerpo?.type ?? cuerpo?.action ?? url.searchParams.get("topic") ?? "";
      // Mercado Pago avisa de varias cosas; acá solo interesan los pagos.
      if (tipo && !tipo.includes("payment")) return ok();
      if (cuerpo?.data?.id) paymentId = String(cuerpo.data.id);
    }

    if (!paymentId) return ok();

    // No sabemos de qué empresa es el pago hasta consultarlo, y para
    // consultarlo hace falta el token de esa empresa. Se prueba con las que
    // tienen el cobro activo: son pocas y la consulta es barata.
    const cuentas = await db
      .select({ companyId: paymentSettings.companyId, token: paymentSettings.mpAccessToken })
      .from(paymentSettings)
      .where(eq(paymentSettings.mpEnabled, true));

    for (const cuenta of cuentas) {
      if (!cuenta.token) continue;

      const pago = await traerPago(cuenta.token, paymentId).catch(() => null);
      if (!pago || !pago.aprobado || !pago.externalReference) continue;

      const orderId = Number(pago.externalReference);
      if (!Number.isInteger(orderId) || orderId <= 0) continue;

      // El pedido tiene que ser de la empresa cuyo token reconoció el pago; si
      // no, un comercio podría marcar como pagados los pedidos de otro.
      const [pedido] = await db
        .select({ id: orders.id, companyId: locations.companyId })
        .from(orders)
        .innerJoin(locations, eq(locations.id, orders.locationId))
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!pedido || pedido.companyId !== cuenta.companyId) continue;

      await acreditarPedido(orderId, pago.id);
      break;
    }

    return ok();
  } catch (error) {
    console.error("Webhook de Mercado Pago:", error);
    return ok();
  }
}

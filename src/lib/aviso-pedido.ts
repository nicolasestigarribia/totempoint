import { useEffect, useRef } from "react";

/** Dos notas cortas, con Web Audio y sin archivo de sonido. */
function sonarAviso(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    void ctx.resume().then(() => {
      let t = ctx.currentTime;
      for (const f of [880, 1320]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
        t += 0.18;
      }
      setTimeout(() => void ctx.close(), 1500);
    });
  } catch {
    // Sin sonido queda el título de la pestaña.
  }
}

/** Lo mínimo del pedido para saber en qué paso está. */
interface PedidoAvisable {
  status: string;
  acceptedAt: string | null;
  pagarEn?: string | null;
  dispatchedAt?: string | null;
}

/** El paso del pedido como lo cuenta el cliente: una palabra por momento. */
function pasoDe(p: PedidoAvisable): string {
  if (p.status === "cancelado") return "cancelado";
  if (p.pagarEn) return "pago";
  if (!p.acceptedAt) return "esperando";
  if (p.status === "preparacion" && p.dispatchedAt) return "camino";
  return p.status; // recibido (confirmado), preparacion, entregado
}

const TITULO: Record<string, string> = {
  cancelado: "Pedido cancelado",
  pago: "Falta el pago",
  esperando: "Esperando confirmación",
  recibido: "✅ Pedido confirmado",
  preparacion: "👨‍🍳 Lo están preparando",
  camino: "🛵 Va en camino",
  entregado: "🎉 ¡Listo!",
};

/**
 * El título de la pestaña con el paso del pedido ("✅ Pedido confirmado ·
 * Pedido 1017-01"): se ve aunque el cliente esté en otra pestaña. Lo usa el
 * `head` de la ruta, que se vuelve a calcular en cada refresco automático.
 */
export function tituloPedido(pedido: PedidoAvisable, numero: string): string {
  return `${TITULO[pasoDe(pedido)] ?? "Tu pedido"} · ${numero}`;
}

/**
 * Cuando el pedido cambia de paso con la página abierta, el título de la
 * pestaña lo sigue (el `head` de la ruta solo se aplica al cargar; los
 * refrescos automáticos no lo vuelven a correr) y el teléfono vibra. La página
 * ya se refresca sola: esto hace que el cambio se note sin estar mirándola.
 * Al cargar no vibra.
 */
export function useAvisoPedido(pedido: PedidoAvisable, numero: string): void {
  const paso = pasoDe(pedido);
  const anterior = useRef<string | null>(null);

  useEffect(() => {
    document.title = tituloPedido(pedido, numero);
    if (anterior.current !== null && anterior.current !== paso) {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        // Sin vibración (iPhone, o la página no tiene el foco): queda el título.
      }
      // Y un "ding": el iPhone no vibra desde una página, pero suena si el
      // cliente ya tocó algo en ella (lo hizo, para mandar el pedido).
      if (paso !== "cancelado") sonarAviso();
    }
    anterior.current = paso;
    // Solo cuando cambia el paso o el número, no en cada refresco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, numero]);
}

// Lo último que se supo de cada pedido, solo en el navegador.
const ultimoEstado = new Map<string, unknown>();

/**
 * El loader del seguimiento, a prueba de cortes: la página se refresca sola
 * cada pocos segundos, y si un refresco falla —el celular perdió señal un
 * instante— se sigue mostrando el último estado en vez de cambiar toda la
 * pantalla por un error. El primer intento sí falla: no hay nada que mostrar.
 */
export async function conUltimoEstado<T>(clave: string, pedir: () => Promise<T>): Promise<T> {
  try {
    const datos = await pedir();
    if (typeof window !== "undefined") ultimoEstado.set(clave, datos);
    return datos;
  } catch (err) {
    const previo = typeof window !== "undefined" ? ultimoEstado.get(clave) : undefined;
    if (previo !== undefined) return previo as T;
    throw err;
  }
}

/** Cada cuánto el seguimiento vuelve a preguntar cómo va el pedido. */
export const REFRESCO_SEGUIMIENTO_MS = 4_000;

/**
 * Mantiene el seguimiento al día: pregunta cada pocos segundos mientras el
 * pedido no terminó, y al instante cuando el cliente vuelve a la pestaña o
 * recupera la señal. Con el teléfono en otra app el navegador frena los
 * relojes de la página: sin esto, al volver de WhatsApp el cliente veía el
 * estado viejo hasta el próximo turno.
 */
export function useRefrescoSeguimiento(refrescar: () => void, terminado: boolean): void {
  const ref = useRef(refrescar);
  ref.current = refrescar;
  useEffect(() => {
    if (terminado) return;
    const id = setInterval(() => ref.current(), REFRESCO_SEGUIMIENTO_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    window.addEventListener("online", alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
      window.removeEventListener("online", alVolver);
    };
  }, [terminado]);
}

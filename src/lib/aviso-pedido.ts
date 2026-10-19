import { useEffect, useRef } from "react";

/** Lo mínimo del pedido para saber en qué paso está. */
interface PedidoAvisable {
  status: string;
  acceptedAt: string | null;
  pagarEn?: string | null;
}

/** El paso del pedido como lo cuenta el cliente: una palabra por momento. */
function pasoDe(p: PedidoAvisable): string {
  if (p.status === "cancelado") return "cancelado";
  if (p.pagarEn) return "pago";
  if (!p.acceptedAt) return "esperando";
  return p.status; // recibido (confirmado), preparacion, entregado
}

const TITULO: Record<string, string> = {
  cancelado: "Pedido cancelado",
  pago: "Falta el pago",
  esperando: "Esperando confirmación",
  recibido: "✅ Pedido confirmado",
  preparacion: "👨‍🍳 Lo están preparando",
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

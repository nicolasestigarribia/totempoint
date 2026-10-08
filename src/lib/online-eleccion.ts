/**
 * Lo que el cliente eligió en la página de la empresa (`/p/{empresa}`) y tiene
 * que llegar a la sucursal: si es envío o retiro, y la dirección que ya buscó.
 * Así no la vuelve a escribir en "Tu pedido".
 *
 * Va por el celular y no por la URL: la dirección es un dato personal y no
 * tiene que quedar en un link que se comparte o se guarda en el historial.
 */
import { useTotemCart } from "@/lib/totem-cart";
import type { Destino } from "@/components/online/DireccionEntrega";

const CLAVE = "pedido-online-eleccion";

export interface EleccionSucursal {
  entrega: "envio" | "mostrador";
  destino: Destino | null;
}

export function guardarEleccion(cartKey: string, e: EleccionSucursal): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ ...e, cartKey, hecho: Date.now() }));
  } catch {
    // Sin almacenamiento: el cliente la vuelve a cargar en su pedido.
  }
}

/**
 * La elección para esta sucursal. Se consume cuando el carrito ya tiene algo
 * (a partir de ahí la tiene el carrito); con el carrito vacío solo se lee, así
 * no se pierde si el cliente abre "Tu pedido" antes de agregar nada.
 */
export function tomarEleccion(cartKey: string, consumir: boolean): EleccionSucursal | null {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as
      | (EleccionSucursal & { cartKey: string; hecho: number })
      | null;
    if (!g || g.cartKey !== cartKey || Date.now() - g.hecho > 60 * 60 * 1000) return null;
    if (consumir) localStorage.removeItem(CLAVE);
    return { entrega: g.entrega, destino: g.destino };
  } catch {
    return null;
  }
}

/**
 * Si el cliente ya había armado un pedido en otra sucursal de la misma empresa
 * (cambió de dirección y ahora le toca otra), se lo lleva a la nueva. Los
 * precios se reajustan solos al abrir su menú, y lo que ahí no se vende queda
 * marcado en el carrito para sacarlo.
 */
export function llevarCarrito(empresa: string, destino: string): void {
  const { slug, items } = useTotemCart.getState();
  if (slug && slug !== destino && slug.startsWith(`online:${empresa}/`) && items.length > 0) {
    useTotemCart.setState({ slug: destino, items });
  }
}

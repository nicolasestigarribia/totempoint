import type { TotemCombo, TotemProduct } from "@/lib/api/totem.functions";

export interface MenuDelCarrito {
  products: TotemProduct[];
  combos: TotemCombo[];
}

/**
 * Si una línea del carrito ya no está en el menú: el dueño la apagó o se agotó
 * mientras el cliente compraba (el carrito vive en el celular).
 */
export function lineaNoDisponible(menu: MenuDelCarrito) {
  const productos = new Set(menu.products.map((p) => p.id));
  const combos = new Set(menu.combos.map((c) => c.id));
  return (i: { kind: string; refId: number; mitad?: { id: number } }) =>
    i.kind === "producto"
      ? !productos.has(i.refId) || (i.mitad !== undefined && !productos.has(i.mitad.id))
      : !combos.has(i.refId);
}

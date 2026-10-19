/**
 * Pizza mitad y mitad, del lado del celular y del tótem: con qué gustos se
 * puede combinar un producto, cuánto sale y cómo se llama la línea. El
 * servidor (`tomarPedido`) vuelve a validar y a cobrar todo con estas mismas
 * reglas:
 *
 * - las dos mitades son de la misma categoría, y la categoría lo permite;
 * - vienen en el mismo tamaño (una grande se combina con otra grande);
 * - se cobra la mitad más cara, como en cualquier pizzería.
 */

export interface ProductoMitad {
  id: number;
  name: string;
  price: string;
  categoryId: number;
  mitades: boolean;
  tamanios: { nombre: string; precio: string }[];
}

/** El precio de un producto en ese tamaño; null si no viene en ese tamaño. */
export function precioEnTamanio(p: ProductoMitad, tamanio: string | undefined): number | null {
  if (p.tamanios.length === 0) return tamanio ? null : Number(p.price);
  if (!tamanio) return null;
  const t = p.tamanios.find((x) => x.nombre === tamanio);
  return t ? Number(t.precio) : null;
}

/** Los gustos que pueden ir en la otra mitad, en el tamaño elegido. */
export function opcionesDeMitad<T extends ProductoMitad>(
  p: ProductoMitad,
  menu: T[],
  tamanio: string | undefined,
): T[] {
  if (!p.mitades) return [];
  return menu.filter(
    (o) =>
      o.id !== p.id &&
      o.mitades &&
      o.categoryId === p.categoryId &&
      precioEnTamanio(o, tamanio) !== null,
  );
}

/** Lo que sale la pizza: la mitad más cara. */
export function precioMitadYMitad(
  a: ProductoMitad,
  b: ProductoMitad,
  tamanio: string | undefined,
): number | null {
  const pa = precioEnTamanio(a, tamanio);
  const pb = precioEnTamanio(b, tamanio);
  return pa === null || pb === null ? null : Math.max(pa, pb);
}

/** "½ Muzzarella + ½ Napolitana": como lo congela el servidor en el pedido. */
export const nombreMitadYMitad = (a: string, b: string) => `½ ${a} + ½ ${b}`;

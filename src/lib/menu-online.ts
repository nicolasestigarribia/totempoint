/**
 * Lo que el menú online (y el de mesa) calcula sin tocar la pantalla: la
 * búsqueda, el número de carta y qué categoría está abierta según la URL.
 */
import type { TotemCombo, TotemProduct } from "@/lib/api/totem.functions";

/** La sección de los combos, que no es una categoría de la base. */
export const ID_COMBOS = "combos";

/** El id de la sección de una categoría: también es el id del elemento en la página. */
export function idDeCategoria(id: number): string {
  return `cat-${id}`;
}

/** Para buscar sin que importen tildes ni mayúsculas: "jamon" encuentra "Jamón". */
export function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * "01 · Jamón y queso" → el número aparte, para mostrarlo como en la carta
 * de la casa ("N°1"). Los que no tienen número quedan como están.
 */
export function partirNombre(nombre: string): { numero: string | null; resto: string } {
  const m = nombre.match(/^0*(\d+)\s*·\s*(.+)$/);
  return m ? { numero: m[1], resto: m[2] } : { numero: null, resto: nombre };
}

/**
 * Lo que coincide con lo que escribió el cliente, por nombre, descripción y, en
 * los combos, por lo que traen. Null si no escribió nada: se ve el menú.
 */
export function buscarEnMenu(
  busqueda: string,
  combos: TotemCombo[],
  productos: TotemProduct[],
): { combos: TotemCombo[]; productos: TotemProduct[] } | null {
  const termino = normalizar(busqueda.trim());
  if (!termino) return null;
  const coincide = (...textos: (string | null | undefined)[]) =>
    textos.some((t) => t && normalizar(t).includes(termino));
  return {
    combos: combos.filter((c) => coincide(c.name, c.description, ...c.items.map((i) => i.name))),
    // Por número y nombre ("2 ·" antes que "10 ·"), no en el orden del menú,
    // que mezcla categorías.
    productos: productos
      .filter((p) => coincide(p.name, p.description))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true })),
  };
}

/*
 * La categoría abierta va en el hash ("#categoria-12") para que el "atrás" del
 * celular vuelva a la grilla. No es el id de la sección ("cat-12") a propósito:
 * el router desplaza la página hasta el elemento que se llama como el hash, y
 * el desplazamiento lo maneja el menú.
 */
const PREFIJO = "categoria-";

export function hashDeSeccion(seccion: string): string {
  return PREFIJO + seccion.replace(/^cat-/, "");
}

/** La sección abierta según el hash, o null (la grilla) si no es una del menú. */
export function seccionDelHash(hash: string, secciones: string[]): string | null {
  const limpio = hash.replace(/^#/, "");
  if (!limpio.startsWith(PREFIJO)) return null;
  const resto = limpio.slice(PREFIJO.length);
  const seccion = resto === ID_COMBOS ? ID_COMBOS : `cat-${resto}`;
  return secciones.includes(seccion) ? seccion : null;
}

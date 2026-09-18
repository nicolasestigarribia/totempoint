/**
 * Cuántas columnas usar según cuántas tarjetas hay.
 *
 * Una grilla fija de tres columnas deja la pantalla de la tablet medio vacía
 * cuando el negocio tiene tres o cuatro categorías: quedan tarjetas chicas
 * arriba y un hueco abajo. Acá las columnas salen de la cantidad, así cuatro
 * categorías caen en 2x2 y llenan la pantalla en vez de quedar 3 + 1.
 *
 * Las clases van escritas enteras a propósito: Tailwind lee el código y no
 * generaría una clase armada con plantillas.
 */
export function gridColsFor(n: number): string {
  if (n <= 1) return "grid-cols-1";
  if (n === 2) return "grid-cols-1 sm:grid-cols-2";
  if (n === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  if (n === 4) return "grid-cols-1 sm:grid-cols-2";
  if (n <= 6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  if (n <= 8) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

/**
 * La última tarjeta ocupa las dos columnas cuando la cantidad es impar.
 *
 * En una tablet vertical la grilla es de dos columnas: con cinco tarjetas la
 * quinta quedaba sola, con un hueco al lado, que es justo lo que se ve
 * desprolijo. Ancha, la fila cierra.
 */
export function lastSpanFor(n: number, index: number): string {
  const esUltima = index === n - 1;
  return esUltima && n > 1 && n % 2 === 1 ? "sm:col-span-2 lg:col-span-1" : "";
}

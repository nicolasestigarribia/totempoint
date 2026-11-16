/**
 * Cómo se llama el lugar donde se sienta el cliente que pide con el QR: mesa en
 * un restaurante, carpa o sombrilla en un balneario. Lo elige cada sucursal en
 * el Salón (`dining_rooms.lugar`), porque una misma empresa puede tener un
 * restaurante y un parador de playa.
 *
 * Las tres palabras son femeninas a propósito: "la mesa", "la carpa", "la
 * sombrilla" — así cada frase ("Estás en la carpa 23", "Llevar a la sombrilla")
 * sirve para todas cambiando solo el sustantivo. Si se suma una masculina
 * ("quincho", "puesto"), hay que agregar el artículo acá.
 */

export const LUGARES = ["mesa", "carpa", "sombrilla"] as const;
export type Lugar = (typeof LUGARES)[number];

/** Lo que viene de la base o de una sucursal sin salón: siempre un lugar válido. */
export function lugarDe(valor: string | null | undefined): Lugar {
  return (LUGARES as readonly string[]).includes(valor ?? "") ? (valor as Lugar) : "mesa";
}

/**
 * El lugar que se muestra: el guardado solo si la empresa es balneario. Otra
 * empresa dice siempre "mesa", aunque tenga algo guardado.
 */
export function lugarEfectivo(
  balneario: boolean | null | undefined,
  guardado: string | null | undefined,
): Lugar {
  return balneario ? lugarDe(guardado) : "mesa";
}

/** "mesa" / "carpa", en minúscula, para el medio de una frase: "en la carpa 23". */
export function sustantivo(lugar: Lugar, plural = false): string {
  return plural ? `${lugar}s` : lugar;
}

/** "Carpa", "Sombrillas": para títulos y botones. */
export function Sustantivo(lugar: Lugar, plural = false): string {
  const s = sustantivo(lugar, plural);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Carpa 23": el nombre que ve la cocina, el ticket y el cliente. */
export function nombreLugar(lugar: Lugar, numero: number): string {
  return `${Sustantivo(lugar)} ${numero}`;
}

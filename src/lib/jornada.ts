/**
 * La jornada comercial de un momento, como "YYYY-MM-DD".
 *
 * Los pedidos se numeran y se cierran en caja por jornada, así que tiene que
 * salir del reloj del negocio y no del de quien lo calcula:
 *
 * - **En hora argentina.** El servidor de Railway corre en UTC: con su reloj, a
 *   las 21:00 de acá ya era "mañana", la numeración volvía a 1 en pleno
 *   servicio de la noche y la caja de esa noche quedaba partida en dos días.
 * - **Con el corte a las 6 de la mañana.** Una pizzería abierta hasta la 1 sigue
 *   en la misma jornada después de medianoche: el pedido de las 00:30 es del
 *   turno de la noche anterior, no el primero del día siguiente.
 */
import { ZONA } from "@/lib/horario";

export const CORTE_JORNADA_HORAS = 6;

export function jornadaDe(fecha: Date = new Date()): string {
  const corrida = new Date(fecha.getTime() - CORTE_JORNADA_HORAS * 60 * 60 * 1000);
  // en-CA da "YYYY-MM-DD" directamente.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(corrida);
}

/**
 * Formatea el número visible del pedido como `MMDD-NN`: mes y día de la jornada
 * más el número correlativo de ese día.
 *
 * El número correlativo se reinicia en 1 cada mañana y por local, así que solo
 * es único dentro de su jornada. Sin la fecha, el #1 de hoy y el de ayer se ven
 * iguales: alguien podría volver al día siguiente con el ticket de ayer y el que
 * entrega no notaría que no corresponde. Anteponiendo la fecha, `0924-01` y
 * `0925-01` no se confunden. El prefijo sale de `businessDate` (la jornada), no
 * de la hora real, para que un pedido tomado pasada la medianoche siga contando
 * en el día comercial al que pertenece.
 *
 * No se guarda en la base: `businessDate` y `orderNumber` ya están, esto es solo
 * cómo se muestra en el ticket, la pantalla del cliente y la comandera.
 *
 * @param businessDate jornada en formato `YYYY-MM-DD`
 */
export function formatearNumeroPedido(businessDate: string, orderNumber: number): string {
  const [, mes, dia] = businessDate.split("-");
  return `${mes}${dia}-${String(orderNumber).padStart(2, "0")}`;
}

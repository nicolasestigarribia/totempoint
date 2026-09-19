import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";

/**
 * Deja un pedido como cobrado.
 *
 * Vive acá y no junto a las server functions del tótem por una razón concreta:
 * aquel archivo lo importa el navegador, y de él solo se van las funciones
 * marcadas como server function. Una función común exportada ahí se queda en el
 * bundle del cliente y se lleva puesto a drizzle y al driver de MySQL, que en
 * el navegador explotan y dejan la app entera sin JavaScript.
 *
 * Es idempotente a propósito: el aviso de Mercado Pago y la consulta que hace
 * el tótem pueden llegar casi juntos por el mismo pago.
 */
export async function acreditarPedido(orderId: number, paymentId: string): Promise<void> {
  await db
    .update(orders)
    .set({ paymentStatus: "pagado", mpPaymentId: paymentId })
    .where(and(eq(orders.id, orderId), ne(orders.paymentStatus, "pagado")));
}

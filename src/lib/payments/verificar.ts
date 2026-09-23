import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentSettings } from "@/db/schema";
import { buscarPagoDePedido } from "./mercadopago";
import { acreditarPedido } from "./acreditar";

/** Token de Mercado Pago de la empresa, si tiene el cobro prendido. */
export async function tokenDeEmpresa(companyId: number): Promise<string | null> {
  const [row] = await db
    .select({ token: paymentSettings.mpAccessToken, enabled: paymentSettings.mpEnabled })
    .from(paymentSettings)
    .where(eq(paymentSettings.companyId, companyId))
    .limit(1);
  if (!row?.enabled || !row.token) return null;
  return row.token;
}

/**
 * Le pregunta a Mercado Pago si un pedido está pagado y, si lo está, lo deja
 * como cobrado.
 *
 * Es lo mismo que hace el tótem mientras el cliente escanea, pero desde la
 * cocina: si el cliente pagó y se fue de la pantalla antes de que el pago se
 * confirmara, y además el aviso de Mercado Pago se perdió, nadie más se iba a
 * enterar y el pedido quedaba "sin cobrar" con la plata ya en la cuenta.
 *
 * Devuelve `null` si no se pudo consultar (sin token o Mercado Pago sin
 * responder), para que quien llama no lo confunda con "no pagó".
 */
export async function verificarPagoMP(orderId: number, companyId: number): Promise<boolean | null> {
  const token = await tokenDeEmpresa(companyId);
  if (!token) return null;
  try {
    // Con tope: la cocina refresca sola cada pocos segundos y no puede quedar
    // colgada porque Mercado Pago tarda en contestar.
    const pago = await Promise.race([
      buscarPagoDePedido(token, String(orderId)),
      new Promise<never>((_, rechazar) =>
        setTimeout(() => rechazar(new Error("Mercado Pago no contestó a tiempo")), 6000),
      ),
    ]);
    if (!pago?.aprobado) return false;
    await acreditarPedido(orderId, pago.id);
    return true;
  } catch {
    return null;
  }
}

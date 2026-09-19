import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, locations } from "@/db/schema";
import { requireCompany } from "@/lib/auth/middleware";
import {
  accessibleLocationIds,
  assertCanViewKitchen,
  assertCanOperateKitchen,
} from "@/lib/auth/scope";
import type { SessionUser } from "@/lib/auth/session";

export type OrderStatus = "recibido" | "preparacion" | "entregado" | "cancelado";
export type PaymentMethod = "efectivo" | "mercadopago";
export type PaymentStatus = "pendiente" | "pagado" | "reembolso_pendiente";

export interface KitchenOrderItem {
  productName: string;
  quantity: number;
  unitPrice: string;
}

export interface KitchenOrder {
  id: number;
  orderNumber: number;
  customerName: string;
  deliveryMethod: "local" | "mostrador";
  comments: string | null;
  status: OrderStatus;
  total: string;
  createdAt: string;
  locationName: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  items: KitchenOrderItem[];
}

/**
 * Negocios cuyos pedidos puede ver quien llama: el dueño los ve todos, el
 * encargado solo los que tiene asignados.
 */
async function visibleLocations(user: SessionUser) {
  const allowed = await accessibleLocationIds(user);
  if (allowed.length === 0) return [];
  return db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(inArray(locations.id, allowed));
}

export const listKitchenOrders = createServerFn({ method: "GET" })
  .middleware([requireCompany])
  .handler(async ({ context }): Promise<KitchenOrder[]> => {
    const user = context.user as SessionUser;
    assertCanViewKitchen(user);

    const locs = await visibleLocations(user);
    if (locs.length === 0) return [];

    const locIds = locs.map((l) => l.id);
    const rows = await db
      .select()
      .from(orders)
      .where(inArray(orders.locationId, locIds))
      .orderBy(desc(orders.createdAt))
      .limit(200);

    if (rows.length === 0) return [];

    const items = await db
      .select()
      .from(orderItems)
      .where(
        inArray(
          orderItems.orderId,
          rows.map((r) => r.id),
        ),
      );

    return rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      deliveryMethod: o.deliveryMethod,
      comments: o.comments,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt.toISOString(),
      locationName: locs.find((l) => l.id === o.locationId)?.name ?? "",
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      items: items
        .filter((i) => i.orderId === o.id)
        .map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
    }));
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireCompany])
  .inputValidator(
    z.object({
      orderId: z.number().int(),
      status: z.enum(["recibido", "preparacion", "entregado"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    assertCanOperateKitchen(user);

    const locs = await visibleLocations(user);
    const locIds = locs.map((l) => l.id);
    if (locIds.length === 0) throw new Error("Ese pedido no es de un negocio tuyo");

    const [target] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(and(eq(orders.id, data.orderId), inArray(orders.locationId, locIds)))
      .limit(1);

    if (!target) throw new Error("Ese pedido no es de un negocio tuyo");
    if (target.status === "cancelado") {
      throw new Error("Ese pedido está cancelado: no se le puede cambiar el estado");
    }

    await db.update(orders).set({ status: data.status }).where(eq(orders.id, data.orderId));
    return { ok: true };
  });

/**
 * Marca un pedido como cobrado (o lo vuelve a pendiente si se marcó por error).
 *
 * El tótem no cobra: el efectivo se recibe en el mostrador y Mercado Pago
 * todavía no está integrado. Entonces quien atiende es el que dice "esto ya se
 * pagó", y de ahí sale el cierre de caja.
 */
export const setOrderPaid = createServerFn({ method: "POST" })
  .middleware([requireCompany])
  .inputValidator(z.object({ orderId: z.number().int(), paid: z.boolean() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    assertCanOperateKitchen(user);

    const locs = await visibleLocations(user);
    const locIds = locs.map((l) => l.id);
    if (locIds.length === 0) throw new Error("Ese pedido no es de un negocio tuyo");

    const [target] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(and(eq(orders.id, data.orderId), inArray(orders.locationId, locIds)))
      .limit(1);
    if (!target) throw new Error("Ese pedido no es de un negocio tuyo");
    if (target.status === "cancelado") {
      throw new Error("Ese pedido está cancelado");
    }

    await db
      .update(orders)
      .set({ paymentStatus: data.paid ? "pagado" : "pendiente" })
      .where(eq(orders.id, data.orderId));
    return { ok: true };
  });

/**
 * Cancela un pedido.
 *
 * Si ya estaba cobrado, el pedido queda en "reembolso pendiente": la plata se
 * devuelve a mano, por caja o por Mercado Pago, y el sistema solo deja anotado
 * que hay algo que devolver. No hay reembolso automático, está fuera de alcance.
 *
 * Un pedido cancelado no vuelve atrás: si el cliente se arrepiente del
 * arrepentimiento, se toma un pedido nuevo. Así el cierre de caja del día no
 * cambia después de hecho.
 */
export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireCompany])
  .inputValidator(z.object({ orderId: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    assertCanOperateKitchen(user);

    const locs = await visibleLocations(user);
    const locIds = locs.map((l) => l.id);
    if (locIds.length === 0) throw new Error("Ese pedido no es de un negocio tuyo");

    const [target] = await db
      .select({ id: orders.id, status: orders.status, paymentStatus: orders.paymentStatus })
      .from(orders)
      .where(and(eq(orders.id, data.orderId), inArray(orders.locationId, locIds)))
      .limit(1);
    if (!target) throw new Error("Ese pedido no es de un negocio tuyo");
    if (target.status === "cancelado") throw new Error("Ese pedido ya está cancelado");

    await db
      .update(orders)
      .set({
        status: "cancelado",
        cancelledAt: new Date(),
        cancelledBy: user.id,
        paymentStatus: target.paymentStatus === "pagado" ? "reembolso_pendiente" : "pendiente",
      })
      .where(eq(orders.id, data.orderId));

    return { ok: true, reembolso: target.paymentStatus === "pagado" };
  });

export interface CashCloseLine {
  locationId: number;
  locationName: string;
  efectivoCobrado: number;
  mercadopagoCobrado: number;
  pendienteDeCobro: number;
  reembolsosPendientes: number;
  pedidos: number;
  cancelados: number;
}

export interface CashClose {
  date: string;
  lines: CashCloseLine[];
  totalCobrado: number;
  totalPendiente: number;
  totalReembolsos: number;
  pedidos: number;
  cancelados: number;
}

/**
 * Cierre de caja de una jornada.
 *
 * Suma solo lo que efectivamente se cobró, separado por forma de pago, que es
 * lo que hay que comparar contra la caja física al cerrar. Los cancelados se
 * cuentan aparte y no suman a ningún total: no se facturaron. Lo que quedó
 * pendiente de cobro se muestra porque casi siempre es un pedido que se
 * entregó y nadie marcó, y conviene verlo antes de cerrar.
 *
 * Trabaja sobre business_date, no sobre la hora de creación: la jornada la
 * define el día del pedido.
 */
export const getCashClose = createServerFn({ method: "GET" })
  .middleware([requireCompany])
  .inputValidator(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ context, data }): Promise<CashClose> => {
    const user = context.user as SessionUser;
    assertCanViewKitchen(user);

    const locs = await visibleLocations(user);
    const vacio: CashClose = {
      date: data.date,
      lines: [],
      totalCobrado: 0,
      totalPendiente: 0,
      totalReembolsos: 0,
      pedidos: 0,
      cancelados: 0,
    };
    if (locs.length === 0) return vacio;

    const rows = await db
      .select({
        locationId: orders.locationId,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
      })
      .from(orders)
      .where(
        and(
          inArray(
            orders.locationId,
            locs.map((l) => l.id),
          ),
          eq(orders.businessDate, data.date),
        ),
      );

    const porLocal = new Map<number, CashCloseLine>();
    for (const l of locs) {
      porLocal.set(l.id, {
        locationId: l.id,
        locationName: l.name,
        efectivoCobrado: 0,
        mercadopagoCobrado: 0,
        pendienteDeCobro: 0,
        reembolsosPendientes: 0,
        pedidos: 0,
        cancelados: 0,
      });
    }

    for (const o of rows) {
      const linea = porLocal.get(o.locationId);
      if (!linea) continue;
      const monto = Number(o.total);

      if (o.status === "cancelado") {
        linea.cancelados++;
        if (o.paymentStatus === "reembolso_pendiente") linea.reembolsosPendientes += monto;
        continue;
      }

      linea.pedidos++;
      if (o.paymentStatus === "pagado") {
        if (o.paymentMethod === "efectivo") linea.efectivoCobrado += monto;
        else linea.mercadopagoCobrado += monto;
      } else {
        linea.pendienteDeCobro += monto;
      }
    }

    const lines = [...porLocal.values()].filter(
      (l) => l.pedidos > 0 || l.cancelados > 0 || l.reembolsosPendientes > 0,
    );

    return {
      date: data.date,
      lines,
      totalCobrado: lines.reduce((t, l) => t + l.efectivoCobrado + l.mercadopagoCobrado, 0),
      totalPendiente: lines.reduce((t, l) => t + l.pendienteDeCobro, 0),
      totalReembolsos: lines.reduce((t, l) => t + l.reembolsosPendientes, 0),
      pedidos: lines.reduce((t, l) => t + l.pedidos, 0),
      cancelados: lines.reduce((t, l) => t + l.cancelados, 0),
    };
  });

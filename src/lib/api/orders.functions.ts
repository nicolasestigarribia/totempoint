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

export type OrderStatus = "recibido" | "preparacion" | "entregado";

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
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, data.orderId), inArray(orders.locationId, locIds)))
      .limit(1);

    if (!target) throw new Error("Ese pedido no es de un negocio tuyo");

    await db.update(orders).set({ status: data.status }).where(eq(orders.id, data.orderId));
    return { ok: true };
  });

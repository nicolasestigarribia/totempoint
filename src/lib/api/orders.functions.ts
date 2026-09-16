import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, locations } from "@/db/schema";
import { requireAuth } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export type OrderStatus = "nuevo" | "preparacion" | "listo" | "entregado";

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

async function companyLocationIds(companyId: number) {
  const rows = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.companyId, companyId));
  return rows;
}

export const listKitchenOrders = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<KitchenOrder[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const locs = await companyLocationIds(user.companyId);
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
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      orderId: z.number().int(),
      status: z.enum(["nuevo", "preparacion", "listo", "entregado"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const locs = await companyLocationIds(user.companyId);
    const locIds = locs.map((l) => l.id);
    if (locIds.length === 0) throw new Error("El pedido no pertenece a tu empresa");

    const [target] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, data.orderId), inArray(orders.locationId, locIds)))
      .limit(1);

    if (!target) throw new Error("El pedido no pertenece a tu empresa");

    await db.update(orders).set({ status: data.status }).where(eq(orders.id, data.orderId));
    return { ok: true };
  });

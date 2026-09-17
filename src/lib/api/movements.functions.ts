import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, or, isNull, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { movements, ingredients, products, locations, artistock, actionCodes } from "@/db/schema";
import { requireView, requireEdit } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";
import { assertLocationAccess } from "@/lib/auth/scope";
import type { ActionCode } from "@/lib/actionCodes";

async function assertIngredientUsable(ingredientId: number, companyId: number) {
  const [ing] = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      and(
        eq(ingredients.id, ingredientId),
        or(isNull(ingredients.companyId), eq(ingredients.companyId, companyId)),
      ),
    )
    .limit(1);
  if (!ing) throw new Error("El ingrediente no es válido para tu empresa");
}

// Un producto de reventa (stockable) de la empresa.
async function assertProductStockable(productId: number, companyId: number) {
  const [p] = await db
    .select({ id: products.id, stockable: products.stockable })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.companyId, companyId)))
    .limit(1);
  if (!p) throw new Error("El producto no es válido para tu empresa");
  if (!p.stockable) throw new Error("El producto no maneja stock (no es de reventa)");
}

export interface MovementListRow {
  id: number;
  createdAt: string;
  locationId: number;
  locationName: string | null;
  type: "stock" | "caja";
  ingredientId: number | null;
  ingredientName: string | null;
  productId: number | null;
  productName: string | null;
  actionCode: string;
  amount: string;
  detail: string | null;
}

// Códigos de acción disponibles (globales + de la empresa), activos.
export const listActionCodes = createServerFn({ method: "GET" })
  .middleware([requireView("movimientos")])
  .handler(async ({ context }): Promise<ActionCode[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const rows = await db
      .select({
        code: actionCodes.code,
        label: actionCodes.label,
        type: actionCodes.type,
        direction: actionCodes.direction,
        auto: actionCodes.auto,
      })
      .from(actionCodes)
      .where(
        and(
          eq(actionCodes.active, true),
          or(isNull(actionCodes.companyId), eq(actionCodes.companyId, user.companyId)),
        ),
      );

    return rows.map((r) => ({
      code: r.code,
      label: r.label,
      type: r.type,
      direction: r.direction,
      auto: r.auto,
    }));
  });

// Carga manual de un movimiento (stock o caja). El código de acción define tipo y signo.
export const createMovement = createServerFn({ method: "POST" })
  .middleware([requireEdit("movimientos")])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      actionCode: z.string().trim().min(1).max(40),
      ingredientId: z.number().int().nullable().optional(),
      productId: z.number().int().nullable().optional(),
      quantity: z.number().positive(),
      detail: z.string().trim().max(255).optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const [def] = await db
      .select({
        type: actionCodes.type,
        direction: actionCodes.direction,
        auto: actionCodes.auto,
      })
      .from(actionCodes)
      .where(
        and(
          eq(actionCodes.code, data.actionCode),
          eq(actionCodes.active, true),
          or(isNull(actionCodes.companyId), eq(actionCodes.companyId, user.companyId)),
        ),
      )
      .limit(1);
    if (!def) throw new Error("Código de acción inválido");
    if (def.auto) throw new Error("Ese código lo genera el sistema, no se carga a mano");

    await assertLocationAccess(user, data.locationId);

    // Movimiento de stock: apunta a un ingrediente O a un producto de reventa (exactamente uno).
    let ingredientId: number | null = null;
    let productId: number | null = null;
    if (def.type === "stock") {
      if (data.ingredientId && data.productId) {
        throw new Error("El movimiento de stock debe ser de un ingrediente o un producto, no ambos");
      }
      if (data.ingredientId) {
        await assertIngredientUsable(data.ingredientId, user.companyId);
        ingredientId = data.ingredientId;
      } else if (data.productId) {
        await assertProductStockable(data.productId, user.companyId);
        productId = data.productId;
      } else {
        throw new Error("Falta el ingrediente o producto");
      }
    }

    const isIngreso = def.direction === "ingreso";
    const signo = isIngreso ? 1 : -1;
    const qty = String(data.quantity);
    const amountSigned = String(data.quantity * signo);

    await db.insert(movements).values({
      companyId: user.companyId,
      locationId: data.locationId,
      ingredientId,
      productId,
      type: def.type,
      actionCode: data.actionCode,
      amount: amountSigned,
      detail: data.detail?.trim() || null,
    });

    // Solo stock actualiza el acumulador artistock (por ingrediente o por producto).
    if (def.type === "stock" && (ingredientId !== null || productId !== null)) {
      await db
        .insert(artistock)
        .values({
          companyId: user.companyId,
          ingredientId,
          productId,
          locationId: data.locationId,
          ipLocal: isIngreso ? qty : "0",
          epLocal: isIngreso ? "0" : qty,
        })
        .onDuplicateKeyUpdate({
          set: isIngreso
            ? { ipLocal: sql`${artistock.ipLocal} + ${qty}` }
            : { epLocal: sql`${artistock.epLocal} + ${qty}` },
        });
    }

    return { ok: true };
  });

export const listMovements = createServerFn({ method: "GET" })
  .middleware([requireView("movimientos")])
  .inputValidator(
    z.object({
      locationId: z.number().int().nullable().optional(),
      type: z.enum(["stock", "caja"]).nullable().optional(),
    }),
  )
  .handler(async ({ context, data }): Promise<MovementListRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const conds = [eq(movements.companyId, user.companyId)];
    if (data.locationId != null) conds.push(eq(movements.locationId, data.locationId));
    if (data.type != null) conds.push(eq(movements.type, data.type));

    const rows = await db
      .select({
        id: movements.id,
        createdAt: movements.createdAt,
        locationId: movements.locationId,
        locationName: locations.name,
        type: movements.type,
        ingredientId: movements.ingredientId,
        ingredientName: ingredients.name,
        productId: movements.productId,
        productName: products.name,
        actionCode: movements.actionCode,
        amount: movements.amount,
        detail: movements.detail,
      })
      .from(movements)
      .leftJoin(locations, eq(movements.locationId, locations.id))
      .leftJoin(ingredients, eq(movements.ingredientId, ingredients.id))
      .leftJoin(products, eq(movements.productId, products.id))
      .where(and(...conds))
      .orderBy(desc(movements.createdAt))
      .limit(500);

    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      locationId: r.locationId,
      locationName: r.locationName,
      type: r.type,
      ingredientId: r.ingredientId,
      ingredientName: r.ingredientName,
      productId: r.productId,
      productName: r.productName,
      actionCode: r.actionCode,
      amount: r.amount,
      detail: r.detail,
    }));
  });

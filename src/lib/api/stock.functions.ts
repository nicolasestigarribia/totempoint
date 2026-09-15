import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { db } from "@/db";
import { ingredients, products, artistock, stockLimits, movements, locations } from "@/db/schema";
import { requireAuth } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

// Fila de stock de un ítem stockable: ingrediente o producto de reventa.
export interface StockRow {
  kind: "ingredient" | "product";
  itemId: number;
  name: string;
  unit: string | null;
  unitsPerBulk: string;
  scope: "global" | "private";
  ipLocal: string;
  vpLocal: string;
  epLocal: string;
  stockActual: string;
  minStock: string | null;
}

async function assertLocationOwned(locationId: number, companyId: number) {
  const [loc] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.companyId, companyId)))
    .limit(1);
  if (!loc) throw new Error("El local no pertenece a tu empresa");
}

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

async function assertProductStockable(productId: number, companyId: number) {
  const [p] = await db
    .select({ id: products.id, stockable: products.stockable })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.companyId, companyId)))
    .limit(1);
  if (!p) throw new Error("El producto no es válido para tu empresa");
  if (!p.stockable) throw new Error("El producto no maneja stock (no es de reventa)");
}

export const getLocationStock = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator(z.object({ locationId: z.number().int() }))
  .handler(async ({ context, data }): Promise<StockRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await assertLocationOwned(data.locationId, user.companyId);

    const ingRows = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        unit: ingredients.unit,
        unitsPerBulk: ingredients.unitsPerBulk,
        companyId: ingredients.companyId,
        ipLocal: artistock.ipLocal,
        vpLocal: artistock.vpLocal,
        epLocal: artistock.epLocal,
        stockActual: artistock.stockActual,
        minStock: stockLimits.minStock,
      })
      .from(ingredients)
      .leftJoin(
        artistock,
        and(
          eq(artistock.ingredientId, ingredients.id),
          eq(artistock.locationId, data.locationId),
        ),
      )
      .leftJoin(
        stockLimits,
        and(
          eq(stockLimits.ingredientId, ingredients.id),
          eq(stockLimits.companyId, user.companyId),
        ),
      )
      .where(or(isNull(ingredients.companyId), eq(ingredients.companyId, user.companyId)));

    // Productos de reventa (stockable) de la empresa.
    const prodRows = await db
      .select({
        id: products.id,
        name: products.name,
        unit: products.unit,
        unitsPerBulk: products.unitsPerBulk,
        ipLocal: artistock.ipLocal,
        vpLocal: artistock.vpLocal,
        epLocal: artistock.epLocal,
        stockActual: artistock.stockActual,
        minStock: stockLimits.minStock,
      })
      .from(products)
      .leftJoin(
        artistock,
        and(
          eq(artistock.productId, products.id),
          eq(artistock.locationId, data.locationId),
        ),
      )
      .leftJoin(
        stockLimits,
        and(
          eq(stockLimits.productId, products.id),
          eq(stockLimits.companyId, user.companyId),
        ),
      )
      .where(and(eq(products.companyId, user.companyId), eq(products.stockable, true)));

    const ingredientStock: StockRow[] = ingRows.map((r) => ({
      kind: "ingredient",
      itemId: r.id,
      name: r.name,
      unit: r.unit,
      unitsPerBulk: r.unitsPerBulk,
      scope: r.companyId === null ? "global" : "private",
      ipLocal: r.ipLocal ?? "0.00",
      vpLocal: r.vpLocal ?? "0.00",
      epLocal: r.epLocal ?? "0.00",
      stockActual: r.stockActual ?? "0.00",
      minStock: r.minStock ?? null,
    }));

    const productStock: StockRow[] = prodRows.map((r) => ({
      kind: "product",
      itemId: r.id,
      name: r.name,
      unit: r.unit,
      unitsPerBulk: r.unitsPerBulk,
      scope: "private",
      ipLocal: r.ipLocal ?? "0.00",
      vpLocal: r.vpLocal ?? "0.00",
      epLocal: r.epLocal ?? "0.00",
      stockActual: r.stockActual ?? "0.00",
      minStock: r.minStock ?? null,
    }));

    return [...ingredientStock, ...productStock];
  });

export interface MovementRow {
  id: number;
  direction: "ingreso" | "egreso";
  actionCode: string;
  amount: string; // firmado (+ ingreso / − egreso)
  detail: string | null;
  createdAt: string;
}

// La carga de movimientos vive en movements.functions.ts (createMovement).

export const getMovements = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      ingredientId: z.number().int().nullable().optional(),
      productId: z.number().int().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }): Promise<MovementRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await assertLocationOwned(data.locationId, user.companyId);

    if (!data.ingredientId && !data.productId) {
      throw new Error("Falta el ingrediente o producto");
    }
    const itemCond = data.productId
      ? eq(movements.productId, data.productId)
      : eq(movements.ingredientId, data.ingredientId!);

    const rows = await db
      .select({
        id: movements.id,
        actionCode: movements.actionCode,
        amount: movements.amount,
        detail: movements.detail,
        createdAt: movements.createdAt,
      })
      .from(movements)
      .where(
        and(
          eq(movements.companyId, user.companyId),
          eq(movements.locationId, data.locationId),
          itemCond,
          eq(movements.type, "stock"),
        ),
      )
      .orderBy(desc(movements.createdAt))
      .limit(20);

    return rows.map((r) => ({
      id: r.id,
      direction: Number(r.amount) < 0 ? "egreso" : "ingreso",
      actionCode: r.actionCode,
      amount: r.amount,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
    }));
  });

export const setStockLimit = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      ingredientId: z.number().int().nullable().optional(),
      productId: z.number().int().nullable().optional(),
      minStock: z.number().min(0),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    if (data.ingredientId && data.productId) {
      throw new Error("El límite debe ser de un ingrediente o un producto, no ambos");
    }
    if (data.productId) {
      await assertProductStockable(data.productId, user.companyId);
    } else if (data.ingredientId) {
      await assertIngredientUsable(data.ingredientId, user.companyId);
    } else {
      throw new Error("Falta el ingrediente o producto");
    }

    await db
      .insert(stockLimits)
      .values({
        companyId: user.companyId,
        ingredientId: data.ingredientId ?? null,
        productId: data.productId ?? null,
        minStock: String(data.minStock),
      })
      .onDuplicateKeyUpdate({ set: { minStock: String(data.minStock) } });
    return { ok: true };
  });

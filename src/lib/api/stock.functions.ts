import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { db } from "@/db";
import { ingredients, artistock, stockLimits, movements, locations } from "@/db/schema";
import { requireAuth } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export interface StockRow {
  ingredientId: number;
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

export const getLocationStock = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator(z.object({ locationId: z.number().int() }))
  .handler(async ({ context, data }): Promise<StockRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await assertLocationOwned(data.locationId, user.companyId);

    const rows = await db
      .select({
        ingredientId: ingredients.id,
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

    return rows.map((r) => ({
      ingredientId: r.ingredientId,
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
  .inputValidator(z.object({ locationId: z.number().int(), ingredientId: z.number().int() }))
  .handler(async ({ context, data }): Promise<MovementRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await assertLocationOwned(data.locationId, user.companyId);

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
          eq(movements.ingredientId, data.ingredientId),
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
    z.object({ ingredientId: z.number().int(), minStock: z.number().min(0) }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await assertIngredientUsable(data.ingredientId, user.companyId);

    await db
      .insert(stockLimits)
      .values({
        companyId: user.companyId,
        ingredientId: data.ingredientId,
        minStock: String(data.minStock),
      })
      .onDuplicateKeyUpdate({ set: { minStock: String(data.minStock) } });
    return { ok: true };
  });

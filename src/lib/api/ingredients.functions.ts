import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, or, isNull, asc } from "drizzle-orm";
import { db } from "@/db";
import { ingredients, ingredientCategories, productIngredients, movements } from "@/db/schema";
import { requireAuth, requireSuperadmin } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export interface IngredientRow {
  id: number;
  name: string;
  unit: string | null;
  unitsPerBulk: string;
  cost: string | null;
  categoryId: number | null;
  categoryName: string | null;
  scope: "global" | "private";
}

// La categoría (si viene) debe ser global o de la empresa.
async function assertCategoryUsable(categoryId: number, companyId: number) {
  const [c] = await db
    .select({ id: ingredientCategories.id })
    .from(ingredientCategories)
    .where(
      and(
        eq(ingredientCategories.id, categoryId),
        or(isNull(ingredientCategories.companyId), eq(ingredientCategories.companyId, companyId)),
      ),
    )
    .limit(1);
  if (!c) throw new Error("La categoría no es válida para tu empresa");
}

export const listIngredients = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<IngredientRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const rows = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        unit: ingredients.unit,
        unitsPerBulk: ingredients.unitsPerBulk,
        cost: ingredients.cost,
        categoryId: ingredients.categoryId,
        categoryName: ingredientCategories.name,
        companyId: ingredients.companyId,
      })
      .from(ingredients)
      .leftJoin(ingredientCategories, eq(ingredients.categoryId, ingredientCategories.id))
      .where(
        or(
          isNull(ingredients.companyId),
          eq(ingredients.companyId, user.companyId),
        ),
      )
      .orderBy(asc(ingredients.name));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      unitsPerBulk: r.unitsPerBulk,
      cost: r.cost,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      scope: r.companyId === null ? "global" : "private",
    }));
  });

export const createIngredient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1).max(120),
      unit: z.string().trim().max(20).optional(),
      unitsPerBulk: z.number().positive().optional(),
      cost: z.number().nonnegative().nullable().optional(),
      categoryId: z.number().int().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }): Promise<IngredientRow> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const name = data.name.trim();
    const unit = data.unit?.trim() ? data.unit.trim() : null;
    const unitsPerBulk = String(data.unitsPerBulk ?? 1);
    const cost = data.cost == null ? null : String(data.cost);
    const categoryId = data.categoryId ?? null;
    if (categoryId !== null) await assertCategoryUsable(categoryId, user.companyId);

    const [{ id }] = await db
      .insert(ingredients)
      .values({
        companyId: user.companyId,
        categoryId,
        name,
        unit,
        unitsPerBulk,
        cost,
        active: true,
      })
      .$returningId();

    let categoryName: string | null = null;
    if (categoryId !== null) {
      const [c] = await db
        .select({ name: ingredientCategories.name })
        .from(ingredientCategories)
        .where(eq(ingredientCategories.id, categoryId))
        .limit(1);
      categoryName = c?.name ?? null;
    }

    return { id, name, unit, unitsPerBulk, cost, categoryId, categoryName, scope: "private" };
  });

export const updateIngredient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      id: z.number().int(),
      name: z.string().trim().min(1).max(120),
      unit: z.string().trim().max(20).optional(),
      unitsPerBulk: z.number().positive().optional(),
      cost: z.number().nonnegative().nullable().optional(),
      categoryId: z.number().int().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    // Permitido: ingredientes propios de la empresa o globales (por ahora).
    const ownScope = or(
      isNull(ingredients.companyId),
      eq(ingredients.companyId, user.companyId),
    );

    const [existing] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(and(eq(ingredients.id, data.id), ownScope))
      .limit(1);

    if (!existing) throw new Error("Ingrediente no encontrado");

    const categoryId = data.categoryId ?? null;
    if (categoryId !== null) await assertCategoryUsable(categoryId, user.companyId);

    await db
      .update(ingredients)
      .set({
        name: data.name.trim(),
        unit: data.unit?.trim() ? data.unit.trim() : null,
        unitsPerBulk: String(data.unitsPerBulk ?? 1),
        cost: data.cost == null ? null : String(data.cost),
        categoryId,
      })
      .where(and(eq(ingredients.id, data.id), ownScope));

    return { ok: true };
  });

export const deleteIngredient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const [existing] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(
        and(
          eq(ingredients.id, data.id),
          eq(ingredients.companyId, user.companyId),
        ),
      )
      .limit(1);

    if (!existing) throw new Error("No podés modificar ingredientes globales");

    await db
      .delete(ingredients)
      .where(
        and(
          eq(ingredients.id, data.id),
          eq(ingredients.companyId, user.companyId),
        ),
      );

    return { ok: true };
  });

// ---------- Ingredientes globales (superadmin) ----------

export interface GlobalIngredientRow {
  id: number;
  name: string;
  unit: string | null;
  unitsPerBulk: string;
  cost: string | null;
  categoryId: number | null;
  categoryName: string | null;
}

// La categoría de un ingrediente global debe ser global (companyId null).
async function assertGlobalCategory(categoryId: number) {
  const [c] = await db
    .select({ id: ingredientCategories.id })
    .from(ingredientCategories)
    .where(and(eq(ingredientCategories.id, categoryId), isNull(ingredientCategories.companyId)))
    .limit(1);
  if (!c) throw new Error("La categoría debe ser global");
}

export const listGlobalIngredients = createServerFn({ method: "GET" })
  .middleware([requireSuperadmin])
  .handler(async (): Promise<GlobalIngredientRow[]> => {
    const rows = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        unit: ingredients.unit,
        unitsPerBulk: ingredients.unitsPerBulk,
        cost: ingredients.cost,
        categoryId: ingredients.categoryId,
        categoryName: ingredientCategories.name,
      })
      .from(ingredients)
      .leftJoin(ingredientCategories, eq(ingredients.categoryId, ingredientCategories.id))
      .where(isNull(ingredients.companyId))
      .orderBy(asc(ingredients.name));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      unitsPerBulk: r.unitsPerBulk,
      cost: r.cost,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
    }));
  });

export const createGlobalIngredient = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1).max(120),
      unit: z.string().trim().max(20).optional(),
      unitsPerBulk: z.number().positive().optional(),
      cost: z.number().nonnegative().nullable().optional(),
      categoryId: z.number().int().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const categoryId = data.categoryId ?? null;
    if (categoryId !== null) await assertGlobalCategory(categoryId);
    await db.insert(ingredients).values({
      companyId: null,
      categoryId,
      name: data.name.trim(),
      unit: data.unit?.trim() ? data.unit.trim() : null,
      unitsPerBulk: String(data.unitsPerBulk ?? 1),
      cost: data.cost == null ? null : String(data.cost),
      active: true,
    });
    return { ok: true };
  });

export const updateGlobalIngredient = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .inputValidator(
    z.object({
      id: z.number().int(),
      name: z.string().trim().min(1).max(120),
      unit: z.string().trim().max(20).optional(),
      unitsPerBulk: z.number().positive().optional(),
      cost: z.number().nonnegative().nullable().optional(),
      categoryId: z.number().int().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const [existing] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(and(eq(ingredients.id, data.id), isNull(ingredients.companyId)))
      .limit(1);
    if (!existing) throw new Error("Ingrediente global no encontrado");

    const categoryId = data.categoryId ?? null;
    if (categoryId !== null) await assertGlobalCategory(categoryId);

    await db
      .update(ingredients)
      .set({
        name: data.name.trim(),
        unit: data.unit?.trim() ? data.unit.trim() : null,
        unitsPerBulk: String(data.unitsPerBulk ?? 1),
        cost: data.cost == null ? null : String(data.cost),
        categoryId,
      })
      .where(and(eq(ingredients.id, data.id), isNull(ingredients.companyId)));
    return { ok: true };
  });

export const deleteGlobalIngredient = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const [existing] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(and(eq(ingredients.id, data.id), isNull(ingredients.companyId)))
      .limit(1);
    if (!existing) throw new Error("Ingrediente global no encontrado");

    const [inProduct] = await db
      .select({ id: productIngredients.id })
      .from(productIngredients)
      .where(eq(productIngredients.ingredientId, data.id))
      .limit(1);
    const [inMovement] = await db
      .select({ id: movements.id })
      .from(movements)
      .where(eq(movements.ingredientId, data.id))
      .limit(1);
    if (inProduct || inMovement) {
      throw new Error("No se puede borrar: el ingrediente está en uso (productos o movimientos).");
    }

    await db
      .delete(ingredients)
      .where(and(eq(ingredients.id, data.id), isNull(ingredients.companyId)));
    return { ok: true };
  });

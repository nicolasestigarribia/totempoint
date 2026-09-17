import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { ingredients, ingredientCategories, productIngredients, movements } from "@/db/schema";
import { requireView, requireEdit } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export interface IngredientRow {
  id: number;
  name: string;
  unit: string | null;
  unitsPerBulk: string;
  cost: string | null;
  categoryId: number | null;
  categoryName: string | null;
}

// La categoría (si viene) tiene que ser de la empresa.
async function assertCategoryUsable(categoryId: number, companyId: number) {
  const [c] = await db
    .select({ id: ingredientCategories.id })
    .from(ingredientCategories)
    .where(
      and(eq(ingredientCategories.id, categoryId), eq(ingredientCategories.companyId, companyId)),
    )
    .limit(1);
  if (!c) throw new Error("La categoría no es válida para tu empresa");
}

export const listIngredients = createServerFn({ method: "GET" })
  .middleware([requireView("ingredientes")])
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
      .where(eq(ingredients.companyId, user.companyId))
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

export const createIngredient = createServerFn({ method: "POST" })
  .middleware([requireEdit("ingredientes")])
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

    return { id, name, unit, unitsPerBulk, cost, categoryId, categoryName };
  });

export const updateIngredient = createServerFn({ method: "POST" })
  .middleware([requireEdit("ingredientes")])
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

    const ownScope = eq(ingredients.companyId, user.companyId);

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
  .middleware([requireEdit("ingredientes")])
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const [existing] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(and(eq(ingredients.id, data.id), eq(ingredients.companyId, user.companyId)))
      .limit(1);

    if (!existing) throw new Error("Ingrediente no encontrado");

    await db
      .delete(ingredients)
      .where(and(eq(ingredients.id, data.id), eq(ingredients.companyId, user.companyId)));

    return { ok: true };
  });

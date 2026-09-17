import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { ingredientCategories, ingredients } from "@/db/schema";
import { requireView, requireEdit } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export interface IngredientCategoryRow {
  id: number;
  name: string;
  active: boolean;
}

export const listIngredientCategories = createServerFn({ method: "GET" })
  .middleware([requireView("ingredientes")])
  .handler(async ({ context }): Promise<IngredientCategoryRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const rows = await db
      .select()
      .from(ingredientCategories)
      .where(eq(ingredientCategories.companyId, user.companyId))
      .orderBy(asc(ingredientCategories.name));

    return rows.map((r) => ({ id: r.id, name: r.name, active: r.active }));
  });

export const createIngredientCategory = createServerFn({ method: "POST" })
  .middleware([requireEdit("ingredientes")])
  .inputValidator(z.object({ name: z.string().trim().min(1).max(80) }))
  .handler(async ({ context, data }): Promise<IngredientCategoryRow> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const name = data.name.trim();
    const [{ id }] = await db
      .insert(ingredientCategories)
      .values({ companyId: user.companyId, name, active: true })
      .$returningId();
    return { id, name, active: true };
  });

export const updateIngredientCategory = createServerFn({ method: "POST" })
  .middleware([requireEdit("ingredientes")])
  .inputValidator(
    z.object({ id: z.number().int(), name: z.string().trim().min(1).max(80), active: z.boolean() }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const [existing] = await db
      .select({ id: ingredientCategories.id })
      .from(ingredientCategories)
      .where(
        and(
          eq(ingredientCategories.id, data.id),
          eq(ingredientCategories.companyId, user.companyId),
        ),
      )
      .limit(1);
    if (!existing) throw new Error("Categoría no encontrada");

    await db
      .update(ingredientCategories)
      .set({ name: data.name.trim(), active: data.active })
      .where(
        and(
          eq(ingredientCategories.id, data.id),
          eq(ingredientCategories.companyId, user.companyId),
        ),
      );
    return { ok: true };
  });

export const deleteIngredientCategory = createServerFn({ method: "POST" })
  .middleware([requireEdit("ingredientes")])
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const [existing] = await db
      .select({ id: ingredientCategories.id })
      .from(ingredientCategories)
      .where(
        and(
          eq(ingredientCategories.id, data.id),
          eq(ingredientCategories.companyId, user.companyId),
        ),
      )
      .limit(1);
    if (!existing) throw new Error("Categoría no encontrada");

    // Desasigna la categoría de los ingredientes de la empresa antes de borrarla.
    await db
      .update(ingredients)
      .set({ categoryId: null })
      .where(and(eq(ingredients.categoryId, data.id), eq(ingredients.companyId, user.companyId)));

    await db
      .delete(ingredientCategories)
      .where(
        and(
          eq(ingredientCategories.id, data.id),
          eq(ingredientCategories.companyId, user.companyId),
        ),
      );
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, or, isNull, asc } from "drizzle-orm";
import { db } from "@/db";
import { ingredientCategories, ingredients } from "@/db/schema";
import { requireAuth, requireSuperadmin } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export interface IngredientCategoryRow {
  id: number;
  name: string;
  active: boolean;
  scope: "global" | "private";
}

export const listIngredientCategories = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<IngredientCategoryRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const rows = await db
      .select()
      .from(ingredientCategories)
      .where(
        or(
          isNull(ingredientCategories.companyId),
          eq(ingredientCategories.companyId, user.companyId),
        ),
      )
      .orderBy(asc(ingredientCategories.name));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      active: r.active,
      scope: r.companyId === null ? "global" : "private",
    }));
  });

// Categorías globales (superadmin) para asignar a ingredientes globales.
export const listGlobalIngredientCategories = createServerFn({ method: "GET" })
  .middleware([requireSuperadmin])
  .handler(async (): Promise<IngredientCategoryRow[]> => {
    const rows = await db
      .select()
      .from(ingredientCategories)
      .where(isNull(ingredientCategories.companyId))
      .orderBy(asc(ingredientCategories.name));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      active: r.active,
      scope: "global" as const,
    }));
  });

export const createIngredientCategory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(z.object({ name: z.string().trim().min(1).max(80) }))
  .handler(async ({ context, data }): Promise<IngredientCategoryRow> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const name = data.name.trim();
    const [{ id }] = await db
      .insert(ingredientCategories)
      .values({ companyId: user.companyId, name, active: true })
      .$returningId();
    return { id, name, active: true, scope: "private" };
  });

export const updateIngredientCategory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
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
        and(eq(ingredientCategories.id, data.id), eq(ingredientCategories.companyId, user.companyId)),
      )
      .limit(1);
    if (!existing) throw new Error("No podés modificar categorías globales");

    await db
      .update(ingredientCategories)
      .set({ name: data.name.trim(), active: data.active })
      .where(
        and(eq(ingredientCategories.id, data.id), eq(ingredientCategories.companyId, user.companyId)),
      );
    return { ok: true };
  });

export const deleteIngredientCategory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const [existing] = await db
      .select({ id: ingredientCategories.id })
      .from(ingredientCategories)
      .where(
        and(eq(ingredientCategories.id, data.id), eq(ingredientCategories.companyId, user.companyId)),
      )
      .limit(1);
    if (!existing) throw new Error("No podés borrar categorías globales");

    // Desasigna la categoría de los ingredientes de la empresa antes de borrarla.
    await db
      .update(ingredients)
      .set({ categoryId: null })
      .where(and(eq(ingredients.categoryId, data.id), eq(ingredients.companyId, user.companyId)));

    await db
      .delete(ingredientCategories)
      .where(
        and(eq(ingredientCategories.id, data.id), eq(ingredientCategories.companyId, user.companyId)),
      );
    return { ok: true };
  });

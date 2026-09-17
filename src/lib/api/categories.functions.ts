import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireView, requireEdit } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export interface CategoryRow {
  id: number;
  name: string;
  tagline: string | null;
  photoUrl: string | null;
  sort: number;
  active: boolean;
}

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireView("categorias")])
  .handler(async ({ context }): Promise<CategoryRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const rows = await db
      .select({
        id: categories.id,
        name: categories.name,
        tagline: categories.tagline,
        photoUrl: categories.photoUrl,
        sort: categories.sort,
        active: categories.active,
      })
      .from(categories)
      .where(eq(categories.companyId, user.companyId))
      .orderBy(asc(categories.sort), asc(categories.name));

    return rows;
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireEdit("categorias")])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1).max(80),
      tagline: z.string().trim().max(60).optional(),
      photoUrl: z.string().trim().max(500).optional(),
      sort: z.number().int().default(0),
    }),
  )
  .handler(async ({ context, data }): Promise<CategoryRow> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const name = data.name.trim();
    const sort = data.sort ?? 0;
    const tagline = data.tagline?.trim() || null;
    const photoUrl = data.photoUrl?.trim() || null;

    const [{ id }] = await db
      .insert(categories)
      .values({
        companyId: user.companyId,
        name,
        tagline,
        photoUrl,
        sort,
        active: true,
      })
      .$returningId();

    return { id, name, tagline, photoUrl, sort, active: true };
  });

export const updateCategory = createServerFn({ method: "POST" })
  .middleware([requireEdit("categorias")])
  .inputValidator(
    z.object({
      id: z.number().int(),
      name: z.string().trim().min(1).max(80),
      tagline: z.string().trim().max(60).optional(),
      photoUrl: z.string().trim().max(500).optional(),
      sort: z.number().int(),
      active: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    await db
      .update(categories)
      .set({
        name: data.name.trim(),
        tagline: data.tagline?.trim() || null,
        photoUrl: data.photoUrl?.trim() || null,
        sort: data.sort,
        active: data.active,
      })
      .where(and(eq(categories.id, data.id), eq(categories.companyId, user.companyId)));

    return { ok: true };
  });

export const setCategoryActive = createServerFn({ method: "POST" })
  .middleware([requireEdit("categorias")])
  .inputValidator(z.object({ id: z.number().int(), active: z.boolean() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await db
      .update(categories)
      .set({ active: data.active })
      .where(and(eq(categories.id, data.id), eq(categories.companyId, user.companyId)));
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireEdit("categorias")])
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    await db
      .delete(categories)
      .where(and(eq(categories.id, data.id), eq(categories.companyId, user.companyId)));

    return { ok: true };
  });

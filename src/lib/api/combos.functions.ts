import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, inArray, asc } from "drizzle-orm";
import { db } from "@/db";
import { combos, comboProducts, products } from "@/db/schema";
import { requireView, requireEdit, requireCompany } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export interface ComboProductRow {
  productId: number;
  name: string;
  price: string;
  quantity: number;
}

export interface ComboRow {
  id: number;
  name: string;
  description: string | null;
  price: string;
  photoUrl: string | null;
  active: boolean;
  sort: number;
  products: ComboProductRow[];
}

const productInput = z.object({
  productId: z.number().int(),
  quantity: z.number().int().min(1).optional(),
});

// Valida que cada productId pertenezca a la empresa del user.
// Devuelve la lista deduplicada de productos válidos con su cantidad.
async function validateProducts(
  list: { productId: number; quantity?: number }[] | undefined,
  companyId: number,
): Promise<{ productId: number; quantity: number }[]> {
  if (!list || list.length === 0) return [];

  const dedup = new Map<number, number | undefined>();
  for (const it of list) dedup.set(it.productId, it.quantity);
  const ids = [...dedup.keys()];

  const found = await db
    .select({ id: products.id })
    .from(products)
    .where(and(inArray(products.id, ids), eq(products.companyId, companyId)));

  const allowed = new Set(found.map((r) => r.id));

  for (const id of ids) {
    if (!allowed.has(id)) {
      throw new Error("Uno o más productos no son válidos para tu empresa");
    }
  }

  return ids.map((id) => {
    const q = dedup.get(id);
    return {
      productId: id,
      quantity: q === undefined || q < 1 ? 1 : q,
    };
  });
}

// Carga el detalle completo (con productos) de un combo por id.
async function loadComboRow(
  comboId: number,
  companyId: number,
): Promise<ComboRow> {
  const [row] = await db
    .select({
      id: combos.id,
      name: combos.name,
      description: combos.description,
      price: combos.price,
      photoUrl: combos.photoUrl,
      active: combos.active,
      sort: combos.sort,
    })
    .from(combos)
    .where(and(eq(combos.id, comboId), eq(combos.companyId, companyId)))
    .limit(1);

  if (!row) throw new Error("Combo no encontrado");

  const prods = await db
    .select({
      productId: comboProducts.productId,
      quantity: comboProducts.quantity,
      name: products.name,
      price: products.price,
    })
    .from(comboProducts)
    .innerJoin(products, eq(comboProducts.productId, products.id))
    .where(eq(comboProducts.comboId, comboId))
    .orderBy(asc(products.name));

  return {
    ...row,
    products: prods.map((p) => ({
      productId: p.productId,
      name: p.name,
      price: p.price,
      quantity: p.quantity,
    })),
  };
}

export const listCombos = createServerFn({ method: "GET" })
  .middleware([requireCompany])
  .handler(async ({ context }): Promise<ComboRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const rows = await db
      .select({
        id: combos.id,
        name: combos.name,
        description: combos.description,
        price: combos.price,
        photoUrl: combos.photoUrl,
        active: combos.active,
        sort: combos.sort,
      })
      .from(combos)
      .where(eq(combos.companyId, user.companyId))
      .orderBy(asc(combos.sort), asc(combos.name));

    if (rows.length === 0) return [];

    const prods = await db
      .select({
        comboId: comboProducts.comboId,
        productId: comboProducts.productId,
        quantity: comboProducts.quantity,
        name: products.name,
        price: products.price,
      })
      .from(comboProducts)
      .innerJoin(products, eq(comboProducts.productId, products.id))
      .where(
        inArray(
          comboProducts.comboId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(products.name));

    const byCombo = new Map<number, ComboProductRow[]>();
    for (const p of prods) {
      const arr = byCombo.get(p.comboId) ?? [];
      arr.push({
        productId: p.productId,
        name: p.name,
        price: p.price,
        quantity: p.quantity,
      });
      byCombo.set(p.comboId, arr);
    }

    return rows.map((r) => ({
      ...r,
      products: byCombo.get(r.id) ?? [],
    }));
  });

export const createCombo = createServerFn({ method: "POST" })
  .middleware([requireEdit("combos")])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1).max(120),
      description: z.string().optional(),
      price: z.union([z.number(), z.string()]),
      photoUrl: z.string().max(500).optional(),
      sort: z.number().int().optional(),
      products: z.array(productInput).optional(),
    }),
  )
  .handler(async ({ context, data }): Promise<ComboRow> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const prodList = await validateProducts(data.products, user.companyId);

    const name = data.name.trim();
    const description = data.description?.trim() ? data.description.trim() : null;
    const photoUrl = data.photoUrl?.trim() ? data.photoUrl.trim() : null;
    const price = String(data.price);
    const sort = data.sort ?? 0;

    const [{ id }] = await db
      .insert(combos)
      .values({
        companyId: user.companyId,
        name,
        description,
        price,
        photoUrl,
        active: true,
        sort,
      })
      .$returningId();

    if (prodList.length > 0) {
      await db.insert(comboProducts).values(
        prodList.map((p) => ({
          comboId: id,
          productId: p.productId,
          quantity: p.quantity,
        })),
      );
    }

    return loadComboRow(id, user.companyId);
  });

export const updateCombo = createServerFn({ method: "POST" })
  .middleware([requireEdit("combos")])
  .inputValidator(
    z.object({
      id: z.number().int(),
      name: z.string().trim().min(1).max(120),
      description: z.string().optional(),
      price: z.union([z.number(), z.string()]),
      photoUrl: z.string().max(500).optional(),
      active: z.boolean(),
      sort: z.number().int().optional(),
      products: z.array(productInput).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    // Verifica ownership del combo.
    const [existing] = await db
      .select({ id: combos.id })
      .from(combos)
      .where(and(eq(combos.id, data.id), eq(combos.companyId, user.companyId)))
      .limit(1);
    if (!existing) throw new Error("Combo no encontrado");

    const prodList = await validateProducts(data.products, user.companyId);

    await db
      .update(combos)
      .set({
        name: data.name.trim(),
        description: data.description?.trim() ? data.description.trim() : null,
        price: String(data.price),
        photoUrl: data.photoUrl?.trim() ? data.photoUrl.trim() : null,
        active: data.active,
        sort: data.sort ?? 0,
      })
      .where(and(eq(combos.id, data.id), eq(combos.companyId, user.companyId)));

    // Reemplazo total de productos.
    await db.delete(comboProducts).where(eq(comboProducts.comboId, data.id));

    if (prodList.length > 0) {
      await db.insert(comboProducts).values(
        prodList.map((p) => ({
          comboId: data.id,
          productId: p.productId,
          quantity: p.quantity,
        })),
      );
    }

    return { ok: true };
  });

export const setComboActive = createServerFn({ method: "POST" })
  .middleware([requireEdit("combos")])
  .inputValidator(z.object({ id: z.number().int(), active: z.boolean() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await db
      .update(combos)
      .set({ active: data.active })
      .where(and(eq(combos.id, data.id), eq(combos.companyId, user.companyId)));
    return { ok: true };
  });

export const deleteCombo = createServerFn({ method: "POST" })
  .middleware([requireEdit("combos")])
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    // Verifica ownership del combo.
    const [existing] = await db
      .select({ id: combos.id })
      .from(combos)
      .where(and(eq(combos.id, data.id), eq(combos.companyId, user.companyId)))
      .limit(1);
    if (!existing) throw new Error("Combo no encontrado");

    await db.delete(comboProducts).where(eq(comboProducts.comboId, data.id));

    await db
      .delete(combos)
      .where(and(eq(combos.id, data.id), eq(combos.companyId, user.companyId)));

    return { ok: true };
  });

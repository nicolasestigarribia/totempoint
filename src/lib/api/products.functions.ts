import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, inArray, asc } from "drizzle-orm";
import { db } from "@/db";
import { products, productIngredients, categories, ingredients } from "@/db/schema";
import { requireView, requireEdit, requireCompany } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";
import { registrarAuditoria, pesosAuditoria } from "@/lib/audit/registrar";

export interface ProductIngredientRow {
  ingredientId: number;
  name: string;
  unit: string | null;
  quantity: string | null;
  /** Si el cliente puede pedir que se lo saquen desde el tótem. */
  removable: boolean;
  /** Si el cliente puede pedir de más ("+carne"). */
  extraAllowed: boolean;
  /** Precio de una unidad extra de este ingrediente en este producto. */
  extraPrice: string | null;
  /** Cuántas unidades extra como mucho. */
  extraMax: number | null;
}

export interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  price: string;
  categoryId: number | null;
  categoryName: string | null;
  photoUrl: string | null;
  active: boolean;
  sort: number;
  stockable: boolean;
  /** Si el tótem ofrece sacarle ingredientes. Lo decide el dueño por producto. */
  customizable: boolean;
  unit: string | null;
  unitsPerBulk: string;
  ingredients: ProductIngredientRow[];
}

const ingredientInput = z.object({
  ingredientId: z.number().int(),
  quantity: z.number().nullable().optional(),
  removable: z.boolean().optional(),
  extraAllowed: z.boolean().optional(),
  extraPrice: z.number().nullable().optional(),
  extraMax: z.number().int().nullable().optional(),
});

// Valida que la categoría (si viene) pertenezca a la empresa del user.
async function assertCategoryOwned(
  categoryId: number | null | undefined,
  companyId: number,
): Promise<number | null> {
  if (categoryId === null || categoryId === undefined) return null;
  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.companyId, companyId)))
    .limit(1);
  if (!cat) throw new Error("La categoría no pertenece a tu empresa");
  return categoryId;
}

// Valida que cada ingredientId sea global (companyId null) o de la empresa del user.
// Devuelve la lista deduplicada de ingredientes válidos con su cantidad.
async function validateIngredients(
  list:
    | {
        ingredientId: number;
        quantity?: number | null;
        removable?: boolean;
        extraAllowed?: boolean;
        extraPrice?: number | null;
        extraMax?: number | null;
      }[]
    | undefined,
  companyId: number,
): Promise<
  {
    ingredientId: number;
    quantity: string | null;
    removable: boolean;
    extraAllowed: boolean;
    extraPrice: string | null;
    extraMax: number | null;
  }[]
> {
  if (!list || list.length === 0) return [];

  const dedup = new Map<
    number,
    {
      quantity?: number | null;
      removable?: boolean;
      extraAllowed?: boolean;
      extraPrice?: number | null;
      extraMax?: number | null;
    }
  >();
  for (const it of list) dedup.set(it.ingredientId, it);
  const ids = [...dedup.keys()];

  const found = await db
    .select({ id: ingredients.id, companyId: ingredients.companyId })
    .from(ingredients)
    .where(inArray(ingredients.id, ids));

  const allowed = new Set(
    found.filter((r) => r.companyId === null || r.companyId === companyId).map((r) => r.id),
  );

  for (const id of ids) {
    if (!allowed.has(id)) {
      throw new Error("Uno o más ingredientes no son válidos para tu empresa");
    }
  }

  return ids.map((id) => {
    const it = dedup.get(id);
    const q = it?.quantity;
    // El extra necesita precio y tope para poder ofrecerse; si falta alguno,
    // queda deshabilitado aunque venga marcado.
    const ep = it?.extraPrice;
    const em = it?.extraMax;
    const extraOk = (it?.extraAllowed ?? false) && ep != null && em != null && em > 0;
    return {
      ingredientId: id,
      quantity: q === null || q === undefined ? null : String(q),
      removable: it?.removable ?? false,
      extraAllowed: extraOk,
      extraPrice: extraOk ? String(ep) : null,
      extraMax: extraOk ? em! : null,
    };
  });
}

// Carga el detalle completo (con ingredientes) de un producto por id.
async function loadProductRow(productId: number, companyId: number): Promise<ProductRow> {
  const [row] = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      categoryId: products.categoryId,
      categoryName: categories.name,
      photoUrl: products.photoUrl,
      active: products.active,
      sort: products.sort,
      stockable: products.stockable,
      customizable: products.customizable,
      unit: products.unit,
      unitsPerBulk: products.unitsPerBulk,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.id, productId), eq(products.companyId, companyId)))
    .limit(1);

  if (!row) throw new Error("Producto no encontrado");

  const ings = await db
    .select({
      ingredientId: productIngredients.ingredientId,
      quantity: productIngredients.quantity,
      removable: productIngredients.removable,
      extraAllowed: productIngredients.extraAllowed,
      extraPrice: productIngredients.extraPrice,
      extraMax: productIngredients.extraMax,
      name: ingredients.name,
      unit: ingredients.unit,
    })
    .from(productIngredients)
    .innerJoin(ingredients, eq(productIngredients.ingredientId, ingredients.id))
    .where(eq(productIngredients.productId, productId))
    .orderBy(asc(ingredients.name));

  return {
    ...row,
    ingredients: ings.map((i) => ({
      ingredientId: i.ingredientId,
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      removable: i.removable,
      extraAllowed: i.extraAllowed,
      extraPrice: i.extraPrice,
      extraMax: i.extraMax,
    })),
  };
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireCompany])
  .handler(async ({ context }): Promise<ProductRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        price: products.price,
        categoryId: products.categoryId,
        categoryName: categories.name,
        photoUrl: products.photoUrl,
        active: products.active,
        sort: products.sort,
        stockable: products.stockable,
        customizable: products.customizable,
        unit: products.unit,
        unitsPerBulk: products.unitsPerBulk,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.companyId, user.companyId))
      .orderBy(asc(products.sort), asc(products.name));

    if (rows.length === 0) return [];

    const ings = await db
      .select({
        productId: productIngredients.productId,
        ingredientId: productIngredients.ingredientId,
        quantity: productIngredients.quantity,
        removable: productIngredients.removable,
        extraAllowed: productIngredients.extraAllowed,
        extraPrice: productIngredients.extraPrice,
        extraMax: productIngredients.extraMax,
        name: ingredients.name,
        unit: ingredients.unit,
      })
      .from(productIngredients)
      .innerJoin(ingredients, eq(productIngredients.ingredientId, ingredients.id))
      .where(
        inArray(
          productIngredients.productId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(ingredients.name));

    const byProduct = new Map<number, ProductIngredientRow[]>();
    for (const i of ings) {
      const arr = byProduct.get(i.productId) ?? [];
      arr.push({
        ingredientId: i.ingredientId,
        name: i.name,
        unit: i.unit,
        quantity: i.quantity,
        removable: i.removable,
        extraAllowed: i.extraAllowed,
        extraPrice: i.extraPrice,
        extraMax: i.extraMax,
      });
      byProduct.set(i.productId, arr);
    }

    return rows.map((r) => ({
      ...r,
      ingredients: byProduct.get(r.id) ?? [],
    }));
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireEdit("productos")])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1).max(120),
      description: z.string().optional(),
      price: z.union([z.number(), z.string()]),
      categoryId: z.number().int().nullable().optional(),
      photoUrl: z.string().max(500).optional(),
      sort: z.number().int().optional(),
      stockable: z.boolean().optional(),
      customizable: z.boolean().optional(),
      unit: z.string().trim().max(20).optional(),
      unitsPerBulk: z.number().positive().optional(),
      ingredients: z.array(ingredientInput).optional(),
    }),
  )
  .handler(async ({ context, data }): Promise<ProductRow> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const categoryId = await assertCategoryOwned(data.categoryId, user.companyId);
    const ingList = await validateIngredients(data.ingredients, user.companyId);

    const name = data.name.trim();
    const description = data.description?.trim() ? data.description.trim() : null;
    const photoUrl = data.photoUrl?.trim() ? data.photoUrl.trim() : null;
    const price = String(data.price);
    const sort = data.sort ?? 0;
    const stockable = data.stockable ?? false;
    const unit = data.unit?.trim() ? data.unit.trim() : null;
    const unitsPerBulk = String(data.unitsPerBulk ?? 1);

    const [{ id }] = await db
      .insert(products)
      .values({
        companyId: user.companyId,
        categoryId,
        name,
        description,
        price,
        photoUrl,
        active: true,
        sort,
        stockable,
        // Un producto de reventa no tiene receta, así que no hay nada que
        // sacarle: el interruptor no puede quedar encendido en ese caso.
        customizable: stockable ? false : (data.customizable ?? false),
        unit,
        unitsPerBulk,
      })
      .$returningId();

    if (ingList.length > 0) {
      await db.insert(productIngredients).values(
        ingList.map((i) => ({
          productId: id,
          ingredientId: i.ingredientId,
          quantity: i.quantity,
          removable: i.removable,
          extraAllowed: i.extraAllowed,
          extraPrice: i.extraPrice,
          extraMax: i.extraMax,
        })),
      );
    }

    return loadProductRow(id, user.companyId);
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireEdit("productos")])
  .inputValidator(
    z.object({
      id: z.number().int(),
      name: z.string().trim().min(1).max(120),
      description: z.string().optional(),
      price: z.union([z.number(), z.string()]),
      categoryId: z.number().int().nullable().optional(),
      photoUrl: z.string().max(500).optional(),
      active: z.boolean(),
      sort: z.number().int().optional(),
      stockable: z.boolean().optional(),
      customizable: z.boolean().optional(),
      unit: z.string().trim().max(20).optional(),
      unitsPerBulk: z.number().positive().optional(),
      ingredients: z.array(ingredientInput).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    // Verifica ownership del producto.
    const [existing] = await db
      .select({ id: products.id, name: products.name, price: products.price })
      .from(products)
      .where(and(eq(products.id, data.id), eq(products.companyId, user.companyId)))
      .limit(1);
    if (!existing) throw new Error("Producto no encontrado");

    const categoryId = await assertCategoryOwned(data.categoryId, user.companyId);
    const ingList = await validateIngredients(data.ingredients, user.companyId);

    await db
      .update(products)
      .set({
        name: data.name.trim(),
        description: data.description?.trim() ? data.description.trim() : null,
        price: String(data.price),
        categoryId,
        photoUrl: data.photoUrl?.trim() ? data.photoUrl.trim() : null,
        active: data.active,
        sort: data.sort ?? 0,
        stockable: data.stockable ?? false,
        customizable: data.stockable ? false : (data.customizable ?? false),
        unit: data.unit?.trim() ? data.unit.trim() : null,
        unitsPerBulk: String(data.unitsPerBulk ?? 1),
      })
      .where(and(eq(products.id, data.id), eq(products.companyId, user.companyId)));

    // El precio base es el que paga el cliente en toda sucursal sin precio
    // propio: cambiarlo es de lo primero que alguien quiere poder rastrear.
    if (Number(existing.price) !== Number(data.price)) {
      await registrarAuditoria(user, {
        category: "precios",
        action: "precio.base",
        summary:
          `Cambió el precio base del producto ${data.name.trim()}: ` +
          `${pesosAuditoria(existing.price)} → ${pesosAuditoria(data.price)}`,
        details: { productoId: data.id, antes: existing.price, despues: String(data.price) },
      });
    }

    // Reemplazo total de ingredientes.
    await db.delete(productIngredients).where(eq(productIngredients.productId, data.id));

    if (ingList.length > 0) {
      await db.insert(productIngredients).values(
        ingList.map((i) => ({
          productId: data.id,
          ingredientId: i.ingredientId,
          quantity: i.quantity,
          removable: i.removable,
          extraAllowed: i.extraAllowed,
          extraPrice: i.extraPrice,
          extraMax: i.extraMax,
        })),
      );
    }

    return { ok: true };
  });

export const setProductActive = createServerFn({ method: "POST" })
  .middleware([requireEdit("productos")])
  .inputValidator(z.object({ id: z.number().int(), active: z.boolean() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await db
      .update(products)
      .set({ active: data.active })
      .where(and(eq(products.id, data.id), eq(products.companyId, user.companyId)));
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireEdit("productos")])
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    // Verifica ownership del producto.
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, data.id), eq(products.companyId, user.companyId)))
      .limit(1);
    if (!existing) throw new Error("Producto no encontrado");

    await db.delete(productIngredients).where(eq(productIngredients.productId, data.id));

    await db
      .delete(products)
      .where(and(eq(products.id, data.id), eq(products.companyId, user.companyId)));

    return { ok: true };
  });

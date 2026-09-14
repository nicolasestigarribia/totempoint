import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  products,
  locations,
  locationCategories,
  locationProducts,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export interface AvailCategory {
  id: number;
  name: string;
  available: boolean;
}

export interface AvailProduct {
  id: number;
  name: string;
  categoryName: string | null;
  available: boolean;
}

export interface LocationAvailability {
  categories: AvailCategory[];
  products: AvailProduct[];
}

// Verifica que el local pertenezca a la empresa del usuario.
async function assertLocationOwned(locationId: number, companyId: number) {
  const [loc] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.companyId, companyId)))
    .limit(1);
  if (!loc) throw new Error("El local no pertenece a tu empresa");
}

export const getLocationAvailability = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator(z.object({ locationId: z.number().int() }))
  .handler(async ({ context, data }): Promise<LocationAvailability> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await assertLocationOwned(data.locationId, user.companyId);

    // Categorías de la empresa + override de disponibilidad para este local
    const cats = await db
      .select({
        id: categories.id,
        name: categories.name,
        available: locationCategories.available,
      })
      .from(categories)
      .leftJoin(
        locationCategories,
        and(
          eq(locationCategories.categoryId, categories.id),
          eq(locationCategories.locationId, data.locationId),
        ),
      )
      .where(eq(categories.companyId, user.companyId));

    // Productos de la empresa + override
    const prods = await db
      .select({
        id: products.id,
        name: products.name,
        categoryName: categories.name,
        available: locationProducts.available,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(
        locationProducts,
        and(
          eq(locationProducts.productId, products.id),
          eq(locationProducts.locationId, data.locationId),
        ),
      )
      .where(eq(products.companyId, user.companyId));

    return {
      categories: cats.map((c) => ({
        id: c.id,
        name: c.name,
        available: c.available ?? true, // sin fila = disponible
      })),
      products: prods.map((p) => ({
        id: p.id,
        name: p.name,
        categoryName: p.categoryName,
        available: p.available ?? true,
      })),
    };
  });

export const setCategoryAvailability = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({ locationId: z.number().int(), categoryId: z.number().int(), available: z.boolean() }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await assertLocationOwned(data.locationId, user.companyId);

    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, data.categoryId), eq(categories.companyId, user.companyId)))
      .limit(1);
    if (!cat) throw new Error("La categoría no pertenece a tu empresa");

    await db
      .insert(locationCategories)
      .values({ locationId: data.locationId, categoryId: data.categoryId, available: data.available })
      .onDuplicateKeyUpdate({ set: { available: data.available } });
    return { ok: true };
  });

export const setProductAvailability = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({ locationId: z.number().int(), productId: z.number().int(), available: z.boolean() }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await assertLocationOwned(data.locationId, user.companyId);

    const [prod] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, data.productId), eq(products.companyId, user.companyId)))
      .limit(1);
    if (!prod) throw new Error("El producto no pertenece a tu empresa");

    await db
      .insert(locationProducts)
      .values({ locationId: data.locationId, productId: data.productId, available: data.available })
      .onDuplicateKeyUpdate({ set: { available: data.available } });
    return { ok: true };
  });

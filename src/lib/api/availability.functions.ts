import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  products,
  combos,
  comboProducts,
  locations,
  locationCategories,
  locationProducts,
  locationCombos,
} from "@/db/schema";
import { requireView, requireEdit } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";
import { assertLocationAccess } from "@/lib/auth/scope";

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

export interface AvailCombo {
  id: number;
  name: string;
  /** El interruptor de esta pantalla: lo que el dueño apagó a mano acá. */
  available: boolean;
  /**
   * Los productos del combo que esta sucursal no tiene. Mientras haya alguno el
   * combo no se muestra en el tótem aunque el interruptor esté encendido: sin
   * el componente no hay con qué armarlo.
   */
  blockedBy: string[];
}

export interface LocationAvailability {
  categories: AvailCategory[];
  products: AvailProduct[];
  combos: AvailCombo[];
}

// Verifica que el local pertenezca a la empresa del usuario.
export const getLocationAvailability = createServerFn({ method: "GET" })
  .middleware([requireView("disponibilidad")])
  .inputValidator(z.object({ locationId: z.number().int() }))
  .handler(async ({ context, data }): Promise<LocationAvailability> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await assertLocationAccess(user, data.locationId);

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

    // Combos de la empresa + override
    const combosRows = await db
      .select({
        id: combos.id,
        name: combos.name,
        available: locationCombos.available,
      })
      .from(combos)
      .leftJoin(
        locationCombos,
        and(eq(locationCombos.comboId, combos.id), eq(locationCombos.locationId, data.locationId)),
      )
      .where(eq(combos.companyId, user.companyId));

    // Qué productos del combo le faltan a esta sucursal. Es lo mismo que mira
    // el tótem, pero acá se devuelven los nombres para poder explicarlo en
    // pantalla en vez de dejar un combo apagado sin decir por qué.
    const categoriasApagadas = new Set(cats.filter((c) => c.available === false).map((c) => c.id));
    const productosDelNegocio = new Map(
      prods.map((p) => [p.id, { name: p.name, available: p.available !== false }]),
    );

    const componentes = combosRows.length
      ? await db
          .select({
            comboId: comboProducts.comboId,
            productId: products.id,
            name: products.name,
            categoryId: products.categoryId,
            activo: products.active,
          })
          .from(comboProducts)
          .innerJoin(products, eq(products.id, comboProducts.productId))
          .where(
            inArray(
              comboProducts.comboId,
              combosRows.map((c) => c.id),
            ),
          )
      : [];

    const faltantes = new Map<number, string[]>();
    for (const c of componentes) {
      const enElNegocio = productosDelNegocio.get(c.productId);
      const falta =
        !c.activo ||
        enElNegocio?.available === false ||
        (c.categoryId !== null && categoriasApagadas.has(c.categoryId));
      if (!falta) continue;
      const lista = faltantes.get(c.comboId) ?? [];
      if (!lista.includes(c.name)) lista.push(c.name);
      faltantes.set(c.comboId, lista);
    }

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
      combos: combosRows.map((c) => ({
        id: c.id,
        name: c.name,
        available: c.available ?? true,
        blockedBy: faltantes.get(c.id) ?? [],
      })),
    };
  });

export const setCategoryAvailability = createServerFn({ method: "POST" })
  .middleware([requireEdit("disponibilidad")])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      categoryId: z.number().int(),
      available: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await assertLocationAccess(user, data.locationId);

    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, data.categoryId), eq(categories.companyId, user.companyId)))
      .limit(1);
    if (!cat) throw new Error("La categoría no pertenece a tu empresa");

    await db
      .insert(locationCategories)
      .values({
        locationId: data.locationId,
        categoryId: data.categoryId,
        available: data.available,
      })
      .onDuplicateKeyUpdate({ set: { available: data.available } });
    return { ok: true };
  });

export const setProductAvailability = createServerFn({ method: "POST" })
  .middleware([requireEdit("disponibilidad")])
  .inputValidator(
    z.object({ locationId: z.number().int(), productId: z.number().int(), available: z.boolean() }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await assertLocationAccess(user, data.locationId);

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

export const setComboAvailability = createServerFn({ method: "POST" })
  .middleware([requireEdit("disponibilidad")])
  .inputValidator(
    z.object({ locationId: z.number().int(), comboId: z.number().int(), available: z.boolean() }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await assertLocationAccess(user, data.locationId);

    const [combo] = await db
      .select({ id: combos.id })
      .from(combos)
      .where(and(eq(combos.id, data.comboId), eq(combos.companyId, user.companyId)))
      .limit(1);
    if (!combo) throw new Error("El combo no pertenece a tu empresa");

    await db
      .insert(locationCombos)
      .values({ locationId: data.locationId, comboId: data.comboId, available: data.available })
      .onDuplicateKeyUpdate({ set: { available: data.available } });
    return { ok: true };
  });

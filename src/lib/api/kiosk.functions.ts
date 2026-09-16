import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, asc, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  kioskSettings,
  categories,
  products,
  locations,
  orders,
  orderItems,
} from "@/db/schema";

// Capa pública: el tótem no tiene sesión, resuelve la empresa por slug de la URL.
// No usa requireAuth a propósito — devolvé sólo datos que puedan verse en pantalla.

export type KioskTemplate = "clasico" | "completo" | "split";

export interface KioskHome {
  companyId: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  template: KioskTemplate;
  heroImageUrl: string | null;
  eyebrow: string | null;
  title: string;
  titleAccent: string | null;
  subtitle: string | null;
  ctaLabel: string;
  badge1: string | null;
  badge2: string | null;
  accentColor: string | null;
}

// Los productos que el negocio no asignó a ninguna categoría se agrupan acá,
// para que nunca queden invisibles en el tótem.
export const UNCATEGORIZED = 0;

export interface KioskCategory {
  id: number;
  name: string;
  tagline: string | null;
  photoUrl: string | null;
  productCount: number;
}

export interface KioskProduct {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: string;
  photoUrl: string | null;
}

export interface KioskMenu {
  name: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string | null;
  categories: KioskCategory[];
  products: KioskProduct[];
}

export const getKioskHome = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().trim().min(1).max(60) }))
  .handler(async ({ data }): Promise<KioskHome> => {
    const [row] = await db
      .select({
        company: companies,
        settings: kioskSettings,
      })
      .from(companies)
      .leftJoin(kioskSettings, eq(kioskSettings.companyId, companies.id))
      .where(eq(companies.slug, data.slug))
      .limit(1);

    if (!row) throw new Error("No encontramos este comercio");
    if (!row.company.active) throw new Error("Este comercio no está disponible en este momento");

    const s = row.settings;
    return {
      companyId: row.company.id,
      name: row.company.name,
      slug: row.company.slug,
      logoUrl: row.company.logoUrl,
      primaryColor: row.company.primaryColor,
      template: (s?.template as KioskTemplate) ?? "clasico",
      heroImageUrl: s?.heroImageUrl ?? null,
      eyebrow: s?.eyebrow ?? null,
      title: s?.title?.trim() || row.company.name,
      titleAccent: s?.titleAccent ?? null,
      subtitle: s?.subtitle ?? null,
      ctaLabel: s?.ctaLabel?.trim() || "Empezar pedido",
      badge1: s?.badge1 ?? null,
      badge2: s?.badge2 ?? null,
      accentColor: s?.accentColor ?? null,
    };
  });

export const getKioskMenu = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().trim().min(1).max(60) }))
  .handler(async ({ data }): Promise<KioskMenu> => {
    const [row] = await db
      .select({ company: companies, accentColor: kioskSettings.accentColor })
      .from(companies)
      .leftJoin(kioskSettings, eq(kioskSettings.companyId, companies.id))
      .where(eq(companies.slug, data.slug))
      .limit(1);

    if (!row) throw new Error("No encontramos este comercio");
    if (!row.company.active) throw new Error("Este comercio no está disponible en este momento");

    const companyId = row.company.id;

    const [cats, prods] = await Promise.all([
      db
        .select()
        .from(categories)
        .where(and(eq(categories.companyId, companyId), eq(categories.active, true)))
        .orderBy(asc(categories.sort), asc(categories.name)),
      db
        .select({
          id: products.id,
          categoryId: products.categoryId,
          name: products.name,
          description: products.description,
          price: products.price,
          photoUrl: products.photoUrl,
        })
        .from(products)
        .where(and(eq(products.companyId, companyId), eq(products.active, true)))
        .orderBy(asc(products.sort), asc(products.name)),
    ]);

    const visibleProducts: KioskProduct[] = prods.map((p) => ({
      ...p,
      categoryId: p.categoryId ?? UNCATEGORIZED,
    }));

    const kioskCategories: KioskCategory[] = cats.map((c) => ({
      id: c.id,
      name: c.name,
      tagline: c.tagline,
      photoUrl: c.photoUrl,
      productCount: visibleProducts.filter((p) => p.categoryId === c.id).length,
    }));

    const looseCount = visibleProducts.filter((p) => p.categoryId === UNCATEGORIZED).length;
    if (looseCount > 0) {
      kioskCategories.push({
        id: UNCATEGORIZED,
        name: "Otros",
        tagline: "Del menú",
        photoUrl: null,
        productCount: looseCount,
      });
    }

    return {
      name: row.company.name,
      slug: row.company.slug,
      logoUrl: row.company.logoUrl,
      accentColor: row.accentColor ?? row.company.primaryColor,
      categories: kioskCategories.filter((c) => c.productCount > 0),
      products: visibleProducts,
    };
  });

// El tótem manda sólo qué productos y cuántos: los precios y el total se
// calculan acá con los datos de la base, nunca con lo que llega del cliente.
export const createKioskOrder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      slug: z.string().trim().min(1).max(60),
      customerName: z.string().trim().min(1).max(120),
      deliveryMethod: z.enum(["local", "mostrador"]),
      comments: z.string().trim().max(500).optional(),
      items: z
        .array(z.object({ productId: z.number().int(), quantity: z.number().int().min(1).max(50) }))
        .min(1),
    }),
  )
  .handler(async ({ data }): Promise<{ orderId: number; orderNumber: number }> => {
    const [company] = await db
      .select({ id: companies.id, active: companies.active })
      .from(companies)
      .where(eq(companies.slug, data.slug))
      .limit(1);

    if (!company) throw new Error("No encontramos este comercio");
    if (!company.active) throw new Error("Este comercio no está disponible en este momento");

    const [location] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.companyId, company.id), eq(locations.active, true)))
      .orderBy(asc(locations.id))
      .limit(1);

    if (!location) throw new Error("El comercio no tiene un local activo");

    const ids = data.items.map((i) => i.productId);
    const rows = await db
      .select({ id: products.id, name: products.name, price: products.price })
      .from(products)
      .where(
        and(
          eq(products.companyId, company.id),
          eq(products.active, true),
          inArray(products.id, ids),
        ),
      );

    if (rows.length !== ids.length) {
      throw new Error("Alguno de los productos ya no está disponible");
    }

    const priced = data.items.map((item) => {
      const product = rows.find((r) => r.id === item.productId)!;
      return {
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: item.quantity,
      };
    });

    const total = priced.reduce((t, i) => t + Number(i.unitPrice) * i.quantity, 0);

    return db.transaction(async (tx) => {
      const [{ last }] = await tx
        .select({ last: sql<number | null>`MAX(${orders.orderNumber})` })
        .from(orders)
        .where(eq(orders.locationId, location.id));

      const orderNumber = (last ?? 99) + 1;

      const [{ id: orderId }] = await tx
        .insert(orders)
        .values({
          locationId: location.id,
          orderNumber,
          customerName: data.customerName.trim(),
          deliveryMethod: data.deliveryMethod,
          comments: data.comments?.trim() || null,
          status: "nuevo",
          total: total.toFixed(2),
        })
        .$returningId();

      await tx.insert(orderItems).values(priced.map((p) => ({ orderId, ...p })));

      return { orderId, orderNumber };
    });
  });

export interface KioskOrderSummary {
  orderNumber: number;
  customerName: string;
  status: "nuevo" | "preparacion" | "listo" | "entregado";
  total: string;
  companyName: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string | null;
}

export const getKioskOrder = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().trim().min(1).max(60), orderId: z.number().int() }))
  .handler(async ({ data }): Promise<KioskOrderSummary> => {
    const [row] = await db
      .select({
        orderNumber: orders.orderNumber,
        customerName: orders.customerName,
        status: orders.status,
        total: orders.total,
        companyName: companies.name,
        slug: companies.slug,
        logoUrl: companies.logoUrl,
        primaryColor: companies.primaryColor,
        accentColor: kioskSettings.accentColor,
      })
      .from(orders)
      .innerJoin(locations, eq(locations.id, orders.locationId))
      .innerJoin(companies, eq(companies.id, locations.companyId))
      .leftJoin(kioskSettings, eq(kioskSettings.companyId, companies.id))
      .where(and(eq(orders.id, data.orderId), eq(companies.slug, data.slug)))
      .limit(1);

    if (!row) throw new Error("No encontramos ese pedido");

    return {
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      status: row.status,
      total: row.total,
      companyName: row.companyName,
      slug: row.slug,
      logoUrl: row.logoUrl,
      accentColor: row.accentColor ?? row.primaryColor,
    };
  });

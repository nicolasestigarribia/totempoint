import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  combos,
  categories,
  locationPrices,
  priceChanges,
  users,
  locations,
} from "@/db/schema";
import { requireView, requireEdit } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";
import { assertLocationAccess, companyIdOf } from "@/lib/auth/scope";
import { registrarAuditoria, pesosAuditoria } from "@/lib/audit/registrar";

type ItemType = "product" | "combo";

export interface PriceRow {
  itemType: ItemType;
  itemId: number;
  name: string;
  categoryName: string | null; // solo productos; combos = null
  basePrice: string;
  override: string | null; // null = usa el precio base
  effectivePrice: string;
}

export interface LocationPricing {
  products: PriceRow[];
  combos: PriceRow[];
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

// Devuelve el precio base del ítem si pertenece a la empresa; si no, corta.
async function basePriceOf(
  itemType: ItemType,
  itemId: number,
  companyId: number,
): Promise<string> {
  if (itemType === "product") {
    const [p] = await db
      .select({ price: products.price })
      .from(products)
      .where(and(eq(products.id, itemId), eq(products.companyId, companyId)))
      .limit(1);
    if (!p) throw new Error("El producto no pertenece a tu empresa");
    return p.price;
  }
  const [c] = await db
    .select({ price: combos.price })
    .from(combos)
    .where(and(eq(combos.id, itemId), eq(combos.companyId, companyId)))
    .limit(1);
  if (!c) throw new Error("El combo no pertenece a tu empresa");
  return c.price;
}

export const getLocationPricing = createServerFn({ method: "GET" })
  .middleware([requireView("precios")])
  .inputValidator(z.object({ locationId: z.number().int() }))
  .handler(async ({ context, data }): Promise<LocationPricing> => {
    const user = context.user as SessionUser;
    const companyId = companyIdOf(user);
    await assertLocationAccess(user, data.locationId);

    const prodRows = await db
      .select({
        id: products.id,
        name: products.name,
        categoryName: categories.name,
        basePrice: products.price,
        override: locationPrices.price,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(
        locationPrices,
        and(
          eq(locationPrices.itemType, "product"),
          eq(locationPrices.itemId, products.id),
          eq(locationPrices.locationId, data.locationId),
        ),
      )
      .where(eq(products.companyId, companyId));

    const comboRows = await db
      .select({
        id: combos.id,
        name: combos.name,
        basePrice: combos.price,
        override: locationPrices.price,
      })
      .from(combos)
      .leftJoin(
        locationPrices,
        and(
          eq(locationPrices.itemType, "combo"),
          eq(locationPrices.itemId, combos.id),
          eq(locationPrices.locationId, data.locationId),
        ),
      )
      .where(eq(combos.companyId, companyId));

    const toRow = (itemType: ItemType) => (r: {
      id: number;
      name: string;
      categoryName?: string | null;
      basePrice: string;
      override: string | null;
    }): PriceRow => ({
      itemType,
      itemId: r.id,
      name: r.name,
      categoryName: r.categoryName ?? null,
      basePrice: r.basePrice,
      override: r.override,
      effectivePrice: r.override ?? r.basePrice,
    });

    return {
      products: prodRows.map(toRow("product")),
      combos: comboRows.map(toRow("combo")),
    };
  });

// Escribe el override (o lo borra si price === null) y registra la auditoría.
async function applyPrice(
  user: SessionUser,
  companyId: number,
  locationId: number,
  itemType: ItemType,
  itemId: number,
  newPrice: number | null,
): Promise<{ antes: string; despues: string } | null> {
  const base = await basePriceOf(itemType, itemId, companyId);

  const [current] = await db
    .select({ price: locationPrices.price })
    .from(locationPrices)
    .where(
      and(
        eq(locationPrices.locationId, locationId),
        eq(locationPrices.itemType, itemType),
        eq(locationPrices.itemId, itemId),
      ),
    )
    .limit(1);
  const oldEffective = current?.price ?? base;

  if (newPrice === null) {
    // Volver al precio base: quitar el override.
    await db
      .delete(locationPrices)
      .where(
        and(
          eq(locationPrices.locationId, locationId),
          eq(locationPrices.itemType, itemType),
          eq(locationPrices.itemId, itemId),
        ),
      );
    if (oldEffective !== base) {
      await db.insert(priceChanges).values({
        companyId,
        locationId,
        itemType,
        itemId,
        oldPrice: oldEffective,
        newPrice: base,
        userId: user.id,
      });
      return { antes: oldEffective, despues: base };
    }
    return null;
  }

  const priceStr = money(newPrice);
  await db
    .insert(locationPrices)
    .values({ locationId, itemType, itemId, price: priceStr })
    .onDuplicateKeyUpdate({ set: { price: priceStr } });

  if (oldEffective !== priceStr) {
    await db.insert(priceChanges).values({
      companyId,
      locationId,
      itemType,
      itemId,
      oldPrice: oldEffective,
      newPrice: priceStr,
      userId: user.id,
    });
    return { antes: oldEffective, despues: priceStr };
  }
  return null;
}

async function nombreDeSucursal(locationId: number): Promise<string> {
  const [l] = await db
    .select({ name: locations.name })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);
  return l?.name ?? `sucursal ${locationId}`;
}

async function nombresDeItems(itemType: ItemType, ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const table = itemType === "product" ? products : combos;
  const rows = await db
    .select({ id: table.id, name: table.name })
    .from(table)
    .where(inArray(table.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export const setLocationPrice = createServerFn({ method: "POST" })
  .middleware([requireEdit("precios")])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      itemType: z.enum(["product", "combo"]),
      itemId: z.number().int(),
      price: z.number().nonnegative().nullable(), // null = vuelve al precio base
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const companyId = companyIdOf(user);
    await assertLocationAccess(user, data.locationId);
    const cambio = await applyPrice(
      user,
      companyId,
      data.locationId,
      data.itemType,
      data.itemId,
      data.price,
    );
    if (cambio) {
      const [sucursal, nombres] = await Promise.all([
        nombreDeSucursal(data.locationId),
        nombresDeItems(data.itemType, [data.itemId]),
      ]);
      const que = data.itemType === "product" ? "producto" : "combo";
      await registrarAuditoria(user, {
        category: "precios",
        action: "precio.sucursal",
        summary:
          `Cambió el precio del ${que} ${nombres.get(data.itemId) ?? data.itemId} en ${sucursal}: ` +
          `${pesosAuditoria(cambio.antes)} → ${pesosAuditoria(cambio.despues)}` +
          (data.price === null ? " (volvió al precio base)" : ""),
        details: { ...data, ...cambio },
      });
    }
    return { ok: true };
  });

// Ajuste masivo: precio unitario fijo o porcentaje sobre el precio efectivo actual.
export const bulkAdjustPrices = createServerFn({ method: "POST" })
  .middleware([requireEdit("precios")])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      itemType: z.enum(["product", "combo"]),
      itemIds: z.array(z.number().int()).min(1),
      mode: z.enum(["percent", "unit"]),
      value: z.number(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const companyId = companyIdOf(user);
    await assertLocationAccess(user, data.locationId);

    if (data.mode === "unit" && data.value < 0) {
      throw new Error("El precio no puede ser negativo");
    }

    const table = data.itemType === "product" ? products : combos;
    const owned = await db
      .select({ id: table.id, price: table.price })
      .from(table)
      .where(and(eq(table.companyId, companyId), inArray(table.id, data.itemIds)));
    const baseById = new Map(owned.map((o) => [o.id, o.price]));
    if (baseById.size !== data.itemIds.length) {
      throw new Error("Alguno de los ítems no pertenece a tu empresa");
    }

    const overrides = await db
      .select({ itemId: locationPrices.itemId, price: locationPrices.price })
      .from(locationPrices)
      .where(
        and(
          eq(locationPrices.locationId, data.locationId),
          eq(locationPrices.itemType, data.itemType),
          inArray(locationPrices.itemId, data.itemIds),
        ),
      );
    const overrideById = new Map(overrides.map((o) => [o.itemId, o.price]));

    const cambios: { itemId: number; antes: string; despues: string }[] = [];
    for (const itemId of data.itemIds) {
      const effective = Number(overrideById.get(itemId) ?? baseById.get(itemId));
      const next =
        data.mode === "unit" ? data.value : Math.max(0, effective * (1 + data.value / 100));
      const cambio = await applyPrice(
        user,
        companyId,
        data.locationId,
        data.itemType,
        itemId,
        next,
      );
      if (cambio) cambios.push({ itemId, ...cambio });
    }

    // Un ajuste masivo es una sola decisión: va como una entrada, con el
    // detalle de cada ítem adentro, y no como cuarenta líneas sueltas.
    if (cambios.length > 0) {
      const [sucursal, nombres] = await Promise.all([
        nombreDeSucursal(data.locationId),
        nombresDeItems(
          data.itemType,
          cambios.map((c) => c.itemId),
        ),
      ]);
      const que = data.itemType === "product" ? "productos" : "combos";
      const como =
        data.mode === "percent"
          ? `${data.value > 0 ? "+" : ""}${data.value}%`
          : `precio fijo ${pesosAuditoria(data.value)}`;
      const lista = cambios
        .slice(0, 5)
        .map(
          (c) =>
            `${nombres.get(c.itemId) ?? c.itemId} ${pesosAuditoria(c.antes)} → ${pesosAuditoria(c.despues)}`,
        )
        .join(", ");
      await registrarAuditoria(user, {
        category: "precios",
        action: "precio.masivo",
        summary:
          `Ajuste masivo (${como}) de ${cambios.length} ${que} en ${sucursal}: ${lista}` +
          (cambios.length > 5 ? ` y ${cambios.length - 5} más` : ""),
        details: {
          locationId: data.locationId,
          mode: data.mode,
          value: data.value,
          cambios: cambios.map((c) => ({ ...c, nombre: nombres.get(c.itemId) ?? null })),
        },
      });
    }
    return { ok: true, count: data.itemIds.length };
  });

export interface PriceHistoryRow {
  id: number;
  oldPrice: string | null;
  newPrice: string;
  userName: string;
  createdAt: string;
}

export const getPriceHistory = createServerFn({ method: "GET" })
  .middleware([requireView("precios")])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      itemType: z.enum(["product", "combo"]),
      itemId: z.number().int(),
    }),
  )
  .handler(async ({ context, data }): Promise<PriceHistoryRow[]> => {
    const user = context.user as SessionUser;
    companyIdOf(user);
    await assertLocationAccess(user, data.locationId);

    const rows = await db
      .select({
        id: priceChanges.id,
        oldPrice: priceChanges.oldPrice,
        newPrice: priceChanges.newPrice,
        email: users.email,
        username: users.username,
        createdAt: priceChanges.createdAt,
      })
      .from(priceChanges)
      .leftJoin(users, eq(priceChanges.userId, users.id))
      .where(
        and(
          eq(priceChanges.locationId, data.locationId),
          eq(priceChanges.itemType, data.itemType),
          eq(priceChanges.itemId, data.itemId),
        ),
      )
      .orderBy(desc(priceChanges.createdAt))
      .limit(50);

    return rows.map((r) => ({
      id: r.id,
      oldPrice: r.oldPrice,
      newPrice: r.newPrice,
      userName: r.username ?? r.email ?? "—",
      createdAt: r.createdAt.toISOString(),
    }));
  });

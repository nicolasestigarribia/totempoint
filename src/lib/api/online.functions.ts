import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, deliveryTiers, locations, onlineSettings, paymentSettings } from "@/db/schema";
import { requireOwner } from "@/lib/auth/middleware";
import { companyIdOf } from "@/lib/auth/scope";
import type { SessionUser } from "@/lib/auth/session";
import { registrarAuditoria, pesosAuditoria } from "@/lib/audit/registrar";

/**
 * Configuración del pedido online de cada sucursal: si toma pedidos, si hace
 * retiro y envío, el mínimo, desde dónde salen los envíos y cuánto cuestan
 * según la distancia.
 *
 * Es del dueño, como Cobros: decide por dónde entra la plata y cuánto se cobra
 * el envío. El lado público (el menú y el pedido del cliente) vive en
 * `totem.functions.ts`, el único archivo de server functions sin sesión.
 */

export interface OnlineTierView {
  id: number;
  upToKm: number;
  price: number;
}

export interface OnlineLocationConfig {
  locationId: number;
  locationName: string;
  locationSlug: string;
  /** La dirección cargada en la sucursal, para arrancar la búsqueda en el mapa. */
  locationAddress: string | null;
  enabled: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  cashEnabled: boolean;
  minOrder: string;
  /** Desde dónde salen los envíos. Null hasta que el dueño lo marca en el mapa. */
  origin: { lat: number; lng: number } | null;
  tiers: OnlineTierView[];
}

export interface OnlineConfig {
  companySlug: string;
  /** Si la empresa cobra con Mercado Pago: si no, el online solo acepta efectivo. */
  mercadoPago: boolean;
  locations: OnlineLocationConfig[];
}

/**
 * El pedido online es un adicional que habilita el superadmin. Sin él, la
 * sección no se muestra; esto es lo que lo hace valer también en el servidor.
 */
async function exigirAdicional(companyId: number) {
  const [c] = await db
    .select({ online: companies.onlineOrdering })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!c?.online) {
    throw new Error("Tu empresa no tiene el pedido online. Pedíselo a Totempoint para activarlo");
  }
}

/** La sucursal, si es de la empresa de quien llama y la empresa tiene el adicional. */
async function sucursalPropia(user: SessionUser, locationId: number) {
  const companyId = companyIdOf(user);
  await exigirAdicional(companyId);
  const [loc] = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.companyId, companyId)))
    .limit(1);
  if (!loc) throw new Error("Esa sucursal no es de tu empresa");
  return { companyId, ...loc };
}

const km = (n: number) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })} km`;

export const getOnlineConfig = createServerFn({ method: "GET" })
  .middleware([requireOwner])
  .handler(async ({ context }): Promise<OnlineConfig> => {
    const companyId = companyIdOf(context.user as SessionUser);
    await exigirAdicional(companyId);

    const [[company], locs, settings, tiers, [pago]] = await Promise.all([
      db
        .select({ slug: companies.slug })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1),
      db
        .select({
          id: locations.id,
          name: locations.name,
          slug: locations.slug,
          address: locations.address,
        })
        .from(locations)
        .where(and(eq(locations.companyId, companyId), eq(locations.active, true)))
        .orderBy(asc(locations.name)),
      db.select().from(onlineSettings).where(eq(onlineSettings.companyId, companyId)),
      db
        .select()
        .from(deliveryTiers)
        .where(eq(deliveryTiers.companyId, companyId))
        .orderBy(asc(deliveryTiers.upToKm)),
      db
        .select({ enabled: paymentSettings.mpEnabled, token: paymentSettings.mpAccessToken })
        .from(paymentSettings)
        .where(eq(paymentSettings.companyId, companyId))
        .limit(1),
    ]);

    return {
      companySlug: company?.slug ?? "",
      mercadoPago: Boolean(pago?.enabled && pago.token),
      locations: locs.map((l) => {
        const s = settings.find((x) => x.locationId === l.id);
        return {
          locationId: l.id,
          locationName: l.name,
          locationSlug: l.slug,
          locationAddress: l.address,
          // Sin fila, los mismos valores por defecto que la tabla: apagado,
          // con retiro y efectivo listos para cuando lo prendan.
          enabled: s?.enabled ?? false,
          pickupEnabled: s?.pickupEnabled ?? true,
          deliveryEnabled: s?.deliveryEnabled ?? false,
          cashEnabled: s?.cashEnabled ?? true,
          minOrder: s?.minOrder ?? "0.00",
          origin:
            s?.originLat != null && s.originLng != null
              ? { lat: Number(s.originLat), lng: Number(s.originLng) }
              : null,
          tiers: tiers
            .filter((t) => t.locationId === l.id)
            .map((t) => ({ id: t.id, upToKm: Number(t.upToKm), price: Number(t.price) })),
        };
      }),
    };
  });

/** La fila de configuración de la sucursal, creándola con los valores por defecto si no está. */
async function asegurarSettings(companyId: number, locationId: number) {
  await db
    .insert(onlineSettings)
    .values({ companyId, locationId })
    .onDuplicateKeyUpdate({ set: { locationId } });
}

export const saveOnlineSettings = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      enabled: z.boolean(),
      pickupEnabled: z.boolean(),
      deliveryEnabled: z.boolean(),
      cashEnabled: z.boolean(),
      minOrder: z.number().min(0).max(100_000_000),
    }),
  )
  .handler(async ({ context, data }) => {
    const loc = await sucursalPropia(context.user as SessionUser, data.locationId);

    if (data.enabled && !data.pickupEnabled && !data.deliveryEnabled) {
      throw new Error("Para tomar pedidos online elegí al menos retiro o envío");
    }

    await asegurarSettings(loc.companyId, loc.id);
    await db
      .update(onlineSettings)
      .set({
        enabled: data.enabled,
        pickupEnabled: data.pickupEnabled,
        deliveryEnabled: data.deliveryEnabled,
        cashEnabled: data.cashEnabled,
        minOrder: data.minOrder.toFixed(2),
      })
      .where(eq(onlineSettings.locationId, loc.id));
    return { ok: true };
  });

/** El punto de la sucursal en el mapa: desde ahí se mide la distancia de cada envío. */
export const saveDeliveryOrigin = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  )
  .handler(async ({ context, data }) => {
    const loc = await sucursalPropia(context.user as SessionUser, data.locationId);
    await asegurarSettings(loc.companyId, loc.id);
    await db
      .update(onlineSettings)
      .set({ originLat: data.lat.toFixed(6), originLng: data.lng.toFixed(6) })
      .where(eq(onlineSettings.locationId, loc.id));
    return { ok: true };
  });

export const saveDeliveryTier = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      /** Ausente = tramo nuevo. */
      id: z.number().int().optional(),
      upToKm: z.number().positive("La distancia tiene que ser mayor a 0").max(100),
      price: z.number().min(0).max(100_000_000),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const loc = await sucursalPropia(user, data.locationId);
    const distancia = data.upToKm.toFixed(2);
    const precio = data.price.toFixed(2);

    // Dos tramos con la misma distancia no se pueden distinguir: ¿cuál cobra?
    const existentes = await db
      .select()
      .from(deliveryTiers)
      .where(eq(deliveryTiers.locationId, loc.id));
    if (existentes.some((t) => t.id !== data.id && Number(t.upToKm) === Number(distancia))) {
      throw new Error(`Ya hay un tramo hasta ${km(data.upToKm)}`);
    }

    if (data.id === undefined) {
      await db.insert(deliveryTiers).values({
        companyId: loc.companyId,
        locationId: loc.id,
        upToKm: distancia,
        price: precio,
      });
      // El costo del envío es plata que paga el cliente: se audita como un precio.
      await registrarAuditoria(user, {
        category: "precios",
        action: "envio.tramo_crear",
        summary: `Creó el tramo de envío hasta ${km(data.upToKm)} de ${loc.name} a ${pesosAuditoria(precio)}`,
      });
      return { ok: true };
    }

    const antes = existentes.find((t) => t.id === data.id);
    if (!antes) throw new Error("Ese tramo no existe");

    await db
      .update(deliveryTiers)
      .set({ upToKm: distancia, price: precio })
      .where(eq(deliveryTiers.id, antes.id));

    if (Number(antes.price) !== Number(precio) || Number(antes.upToKm) !== Number(distancia)) {
      await registrarAuditoria(user, {
        category: "precios",
        action: "envio.tramo_editar",
        summary:
          `Cambió el tramo de envío de ${loc.name}: hasta ${km(Number(antes.upToKm))} a ` +
          `${pesosAuditoria(antes.price)} → hasta ${km(data.upToKm)} a ${pesosAuditoria(precio)}`,
        details: {
          antes: { upToKm: antes.upToKm, price: antes.price },
          despues: { upToKm: distancia, price: precio },
        },
      });
    }
    return { ok: true };
  });

export const deleteDeliveryTier = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(z.object({ locationId: z.number().int(), id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const loc = await sucursalPropia(user, data.locationId);
    const [tramo] = await db
      .select()
      .from(deliveryTiers)
      .where(and(eq(deliveryTiers.id, data.id), eq(deliveryTiers.locationId, loc.id)))
      .limit(1);
    if (!tramo) return { ok: true };

    // Se puede borrar: los pedidos ya tomados congelaron su costo y su distancia.
    await db.delete(deliveryTiers).where(eq(deliveryTiers.id, tramo.id));
    await registrarAuditoria(user, {
      category: "precios",
      action: "envio.tramo_borrar",
      summary: `Borró el tramo de envío hasta ${km(Number(tramo.upToKm))} de ${loc.name} (${pesosAuditoria(tramo.price)})`,
    });
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, deliveryZones, locations, onlineSettings, paymentSettings } from "@/db/schema";
import { requireOwner } from "@/lib/auth/middleware";
import { companyIdOf } from "@/lib/auth/scope";
import type { SessionUser } from "@/lib/auth/session";
import { registrarAuditoria, pesosAuditoria } from "@/lib/audit/registrar";

/**
 * Configuración del pedido online de cada sucursal: si toma pedidos, si hace
 * retiro y envío, el mínimo y las zonas de envío con su costo.
 *
 * Es del dueño, como Cobros: decide por dónde entra la plata y cuánto se cobra
 * el envío. El lado público (el menú y el pedido del cliente) vive en
 * `totem.functions.ts`, el único archivo de server functions sin sesión.
 */

export interface OnlineZoneView {
  id: number;
  name: string;
  price: string;
  active: boolean;
}

export interface OnlineLocationConfig {
  locationId: number;
  locationName: string;
  locationSlug: string;
  enabled: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  cashEnabled: boolean;
  minOrder: string;
  zones: OnlineZoneView[];
}

export interface OnlineConfig {
  companySlug: string;
  /** Si la empresa cobra con Mercado Pago: si no, el online solo acepta efectivo. */
  mercadoPago: boolean;
  locations: OnlineLocationConfig[];
}

/** La sucursal, si es de la empresa de quien llama. */
async function sucursalPropia(user: SessionUser, locationId: number) {
  const companyId = companyIdOf(user);
  const [loc] = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.companyId, companyId)))
    .limit(1);
  if (!loc) throw new Error("Esa sucursal no es de tu empresa");
  return { companyId, ...loc };
}

export const getOnlineConfig = createServerFn({ method: "GET" })
  .middleware([requireOwner])
  .handler(async ({ context }): Promise<OnlineConfig> => {
    const companyId = companyIdOf(context.user as SessionUser);

    const [[company], locs, settings, zones, [pago]] = await Promise.all([
      db
        .select({ slug: companies.slug })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1),
      db
        .select({ id: locations.id, name: locations.name, slug: locations.slug })
        .from(locations)
        .where(and(eq(locations.companyId, companyId), eq(locations.active, true)))
        .orderBy(asc(locations.name)),
      db.select().from(onlineSettings).where(eq(onlineSettings.companyId, companyId)),
      db
        .select()
        .from(deliveryZones)
        .where(eq(deliveryZones.companyId, companyId))
        .orderBy(asc(deliveryZones.sort), asc(deliveryZones.name)),
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
          // Sin fila, los mismos valores por defecto que la tabla: apagado,
          // con retiro y efectivo listos para cuando lo prendan.
          enabled: s?.enabled ?? false,
          pickupEnabled: s?.pickupEnabled ?? true,
          deliveryEnabled: s?.deliveryEnabled ?? false,
          cashEnabled: s?.cashEnabled ?? true,
          minOrder: s?.minOrder ?? "0.00",
          zones: zones
            .filter((z) => z.locationId === l.id)
            .map((z) => ({ id: z.id, name: z.name, price: z.price, active: z.active })),
        };
      }),
    };
  });

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

    const valores = {
      enabled: data.enabled,
      pickupEnabled: data.pickupEnabled,
      deliveryEnabled: data.deliveryEnabled,
      cashEnabled: data.cashEnabled,
      minOrder: data.minOrder.toFixed(2),
    };
    await db
      .insert(onlineSettings)
      .values({ companyId: loc.companyId, locationId: loc.id, ...valores })
      .onDuplicateKeyUpdate({ set: valores });
    return { ok: true };
  });

export const saveDeliveryZone = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      /** Ausente = zona nueva. */
      id: z.number().int().optional(),
      name: z.string().trim().min(1, "Poné un nombre a la zona").max(80),
      price: z.number().min(0).max(100_000_000),
      active: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const loc = await sucursalPropia(user, data.locationId);
    const precio = data.price.toFixed(2);

    if (data.id === undefined) {
      await db.insert(deliveryZones).values({
        companyId: loc.companyId,
        locationId: loc.id,
        name: data.name,
        price: precio,
        active: data.active,
      });
      // El costo del envío es plata que paga el cliente: se audita como un precio.
      await registrarAuditoria(user, {
        category: "precios",
        action: "envio.zona_crear",
        summary: `Creó la zona de envío "${data.name}" de ${loc.name} a ${pesosAuditoria(precio)}`,
      });
      return { ok: true };
    }

    const [antes] = await db
      .select()
      .from(deliveryZones)
      .where(and(eq(deliveryZones.id, data.id), eq(deliveryZones.locationId, loc.id)))
      .limit(1);
    if (!antes) throw new Error("Esa zona no existe");

    await db
      .update(deliveryZones)
      .set({ name: data.name, price: precio, active: data.active })
      .where(eq(deliveryZones.id, antes.id));

    if (Number(antes.price) !== Number(precio) || antes.name !== data.name) {
      await registrarAuditoria(user, {
        category: "precios",
        action: "envio.zona_editar",
        summary:
          `Cambió la zona de envío "${antes.name}" de ${loc.name}: ` +
          `${pesosAuditoria(antes.price)} → ${pesosAuditoria(precio)}` +
          (antes.name !== data.name ? ` (ahora "${data.name}")` : ""),
        details: {
          antes: { name: antes.name, price: antes.price },
          despues: { name: data.name, price: precio },
        },
      });
    }
    return { ok: true };
  });

export const deleteDeliveryZone = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(z.object({ locationId: z.number().int(), id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const loc = await sucursalPropia(user, data.locationId);
    const [zona] = await db
      .select()
      .from(deliveryZones)
      .where(and(eq(deliveryZones.id, data.id), eq(deliveryZones.locationId, loc.id)))
      .limit(1);
    if (!zona) return { ok: true };

    // Se puede borrar: los pedidos ya tomados congelaron el nombre y el costo.
    await db.delete(deliveryZones).where(eq(deliveryZones.id, zona.id));
    await registrarAuditoria(user, {
      category: "precios",
      action: "envio.zona_borrar",
      summary: `Borró la zona de envío "${zona.name}" de ${loc.name} (${pesosAuditoria(zona.price)})`,
    });
    return { ok: true };
  });

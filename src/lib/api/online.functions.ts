import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, deliveryTiers, locations, onlineSettings, paymentSettings } from "@/db/schema";
import { requireOwner } from "@/lib/auth/middleware";
import { companyIdOf } from "@/lib/auth/scope";
import type { SessionUser } from "@/lib/auth/session";
import { registrarAuditoria, pesosAuditoria } from "@/lib/audit/registrar";
import { isReservedSlug } from "@/lib/slug";
import { DIAS, horaValida, type Horarios } from "@/lib/horario";

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
  /** Link corto: /{alias}. Null si no eligió uno. */
  alias: string | null;
  /** Turnos por día (0 = domingo). Null = sin horario: toma pedidos siempre. */
  horarios: Horarios | null;
  /** Desde dónde salen los envíos. Null hasta que el dueño lo marca en el mapa. */
  origin: { lat: number; lng: number } | null;
  tiers: OnlineTierView[];
}

export interface OnlineConfig {
  companySlug: string;
  /** Link corto de toda la empresa (elige sucursal). Null si no tiene. */
  companyAlias: string | null;
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
        .select({ slug: companies.slug, alias: companies.onlineAlias })
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
      companyAlias: company?.alias ?? null,
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
          alias: s?.alias ?? null,
          horarios: s?.horarios ?? null,
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

/**
 * El horario del pedido online. Fuera de él el menú se sigue viendo, pero el
 * pedido no se toma: `createOnlineOrder` lo vuelve a mirar, no alcanza con lo
 * que muestre el celular.
 */
export const saveOnlineHorario = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      /** Null = sin horario: toma pedidos siempre que esté encendido. */
      horarios: z
        .array(
          z
            .array(
              z.object({
                desde: z.string().refine(horaValida, "Revisá las horas: van como 19:30"),
                hasta: z.string().refine(horaValida, "Revisá las horas: van como 23:30"),
              }),
            )
            .max(4, "Hasta 4 turnos por día"),
        )
        .length(7)
        .nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const loc = await sucursalPropia(user, data.locationId);
    data.horarios?.forEach((turnos, dia) => {
      for (const t of turnos) {
        if (t.desde === t.hasta) {
          throw new Error(`El ${DIAS[dia]} tiene un turno que empieza y termina a la misma hora`);
        }
      }
    });
    await asegurarSettings(loc.companyId, loc.id);
    await db
      .update(onlineSettings)
      .set({ horarios: data.horarios })
      .where(eq(onlineSettings.locationId, loc.id));
    return { ok: true };
  });

/**
 * El link corto de la empresa entera: /{alias} lleva a elegir sucursal según
 * la dirección. Sirve a las empresas con varias sucursales; con una sola, el
 * link de esa sucursal alcanza.
 */
export const saveCompanyOnlineAlias = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(z.object({ alias: z.string().trim().toLowerCase().max(40).nullable() }))
  .handler(async ({ context, data }) => {
    const companyId = companyIdOf(context.user as SessionUser);
    await exigirAdicional(companyId);
    const alias = data.alias || null;
    if (alias !== null) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(alias) || alias.length < 3) {
        throw new Error(
          "El link corto va con letras sin tilde, números y guiones, de al menos 3 caracteres (ej: chiqui)",
        );
      }
      if (isReservedSlug(alias))
        throw new Error(`"${alias}" está reservado por el sistema: elegí otro`);
      const [deSucursal] = await db
        .select({ locationId: onlineSettings.locationId })
        .from(onlineSettings)
        .where(eq(onlineSettings.alias, alias))
        .limit(1);
      const [deOtra] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.onlineAlias, alias))
        .limit(1);
      if (deSucursal || (deOtra && deOtra.id !== companyId)) {
        throw new Error(
          `El link "${alias}" ya está en uso: si es de una sucursal tuya, sacáselo primero`,
        );
      }
    }
    await db.update(companies).set({ onlineAlias: alias }).where(eq(companies.id, companyId));
    return { ok: true, alias };
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

/**
 * El link corto del pedido online de una sucursal: /{alias}. Lo elige el dueño
 * y es único en toda la plataforma, porque va directo después del dominio. No
 * puede chocar con una ruta del sistema (/admin, /login, /p…).
 */
export const saveOnlineAlias = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      /** Vacío o null lo saca: el pedido online sigue andando con el link largo. */
      alias: z.string().trim().toLowerCase().max(40).nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const loc = await sucursalPropia(context.user as SessionUser, data.locationId);
    const alias = data.alias || null;

    if (alias !== null) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(alias) || alias.length < 3) {
        throw new Error(
          "El link corto va con letras sin tilde, números y guiones, de al menos 3 caracteres (ej: primorosas)",
        );
      }
      if (isReservedSlug(alias))
        throw new Error(`"${alias}" está reservado por el sistema: elegí otro`);
      const [ocupado] = await db
        .select({ locationId: onlineSettings.locationId })
        .from(onlineSettings)
        .where(eq(onlineSettings.alias, alias))
        .limit(1);
      if (ocupado && ocupado.locationId !== loc.id) {
        throw new Error(`El link "${alias}" ya lo usa otro comercio: probá con otro`);
      }
      const [deEmpresa] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.onlineAlias, alias))
        .limit(1);
      if (deEmpresa) throw new Error(`El link "${alias}" ya está en uso: probá con otro`);
    }

    await asegurarSettings(loc.companyId, loc.id);
    await db.update(onlineSettings).set({ alias }).where(eq(onlineSettings.locationId, loc.id));
    return { ok: true, alias };
  });

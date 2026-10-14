import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, diningRooms, diningTables, locations, mesaSettings } from "@/db/schema";
import { requireEdit, requireOwner, requireView } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";
import { assertLocationAccess, companyIdOf } from "@/lib/auth/scope";
import { registrarAuditoria } from "@/lib/audit/registrar";
import {
  COLUMNAS,
  FILAS,
  FORMAS,
  LUGARES_MAX,
  LUGARES_MIN,
  MESA_MAX,
  SALON_MAX,
  SALON_MIN,
  errorDelPlano,
  type Forma,
} from "@/lib/salon";

/**
 * El salón de cada sucursal: cuánto mide, dónde están las mesas, qué tamaño
 * tienen, de cuántos lugares son y el token de su QR. Es del módulo "Mesas"; con el módulo apagado no se puede
 * ni ver ni guardar.
 */

export interface MesaRow {
  id: number;
  number: number;
  seats: number;
  shape: Forma;
  x: number;
  y: number;
  w: number;
  h: number;
  token: string;
  active: boolean;
}

export interface PlanoSalon {
  mesas: MesaRow[];
  /** El tamaño del salón de esta sucursal, en celdas. */
  columnas: number;
  filas: number;
  /** De la empresa, no de la sucursal: si los pedidos de mesa se aceptan solos. */
  autoAccept: boolean;
}

async function assertModuloMesas(user: SessionUser): Promise<void> {
  const [c] = await db
    .select({ mesas: companies.mesasEnabled })
    .from(companies)
    .where(eq(companies.id, companyIdOf(user)))
    .limit(1);
  if (!c?.mesas) {
    throw new Error("Tu empresa no tiene el módulo de mesas. Pedíselo a Totempoint para activarlo");
  }
}

async function autoAcceptDe(companyId: number): Promise<boolean> {
  const [s] = await db
    .select({ autoAccept: mesaSettings.autoAccept })
    .from(mesaSettings)
    .where(eq(mesaSettings.companyId, companyId))
    .limit(1);
  return s?.autoAccept ?? true;
}

async function nombreDeSucursal(locationId: number): Promise<string> {
  const [l] = await db
    .select({ name: locations.name })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);
  return l?.name ?? "la sucursal";
}

const leerMesas = (locationId: number) =>
  db
    .select({
      id: diningTables.id,
      number: diningTables.number,
      seats: diningTables.seats,
      shape: diningTables.shape,
      x: diningTables.x,
      y: diningTables.y,
      w: diningTables.w,
      h: diningTables.h,
      token: diningTables.token,
      active: diningTables.active,
    })
    .from(diningTables)
    .where(eq(diningTables.locationId, locationId))
    .orderBy(asc(diningTables.number));

export const getSalon = createServerFn({ method: "GET" })
  .middleware([requireView("salon")])
  .inputValidator(z.object({ locationId: z.number().int() }))
  .handler(async ({ context, data }): Promise<PlanoSalon> => {
    const user = context.user as SessionUser;
    await assertModuloMesas(user);
    await assertLocationAccess(user, data.locationId);
    const [sala] = await db
      .select({ columnas: diningRooms.columns, filas: diningRooms.rows })
      .from(diningRooms)
      .where(eq(diningRooms.locationId, data.locationId))
      .limit(1);
    return {
      mesas: await leerMesas(data.locationId),
      columnas: sala?.columnas ?? COLUMNAS,
      filas: sala?.filas ?? FILAS,
      autoAccept: await autoAcceptDe(companyIdOf(user)),
    };
  });

const mesaInput = z.object({
  /** Ausente en una mesa nueva. */
  id: z.number().int().optional(),
  number: z.number().int().min(1).max(999),
  seats: z.number().int().min(LUGARES_MIN).max(LUGARES_MAX),
  shape: z.enum(FORMAS),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().min(1).max(MESA_MAX),
  h: z.number().int().min(1).max(MESA_MAX),
  active: z.boolean(),
});

/**
 * Guarda el plano entero de una vez: crea las mesas nuevas, actualiza las que
 * están y borra las que el editor sacó. Los pedidos de una mesa borrada no
 * pierden nada: guardan su número en `table_number`.
 */
export const saveSalon = createServerFn({ method: "POST" })
  .middleware([requireEdit("salon")])
  .inputValidator(
    z.object({
      locationId: z.number().int(),
      columnas: z.number().int().min(SALON_MIN.columnas).max(SALON_MAX.columnas),
      filas: z.number().int().min(SALON_MIN.filas).max(SALON_MAX.filas),
      mesas: z.array(mesaInput).max(200),
      /** Las mesas que había cuando se abrió el editor. */
      idsConocidos: z.array(z.number().int()).max(200),
    }),
  )
  .handler(async ({ context, data }): Promise<MesaRow[]> => {
    const user = context.user as SessionUser;
    await assertModuloMesas(user);
    await assertLocationAccess(user, data.locationId);

    const error = errorDelPlano(data.mesas, { columnas: data.columnas, filas: data.filas });
    if (error) throw new Error(error);

    const actuales = await leerMesas(data.locationId);
    const idsActuales = new Set(actuales.map((m) => m.id));
    const conocidos = new Set(data.idsConocidos);
    const ids = data.mesas.flatMap((m) => (m.id === undefined ? [] : [m.id]));
    if (
      // Un id que no es de esta sucursal no se toca: sería editar el salón de otra.
      ids.some((id) => !idsActuales.has(id)) ||
      new Set(ids).size !== ids.length ||
      // Una mesa que alguien agregó desde otra pestaña después de que este
      // editor cargó: guardar acá la borraría sin que nadie la viera, y su QR
      // impreso quedaría muerto.
      actuales.some((m) => !conocidos.has(m.id))
    ) {
      throw new Error("El salón cambió mientras lo editabas. Recargá la página");
    }
    const quedan = new Set(data.mesas.flatMap((m) => (m.id === undefined ? [] : [m.id])));
    const borradas = actuales.filter((m) => !quedan.has(m.id));
    const nuevas = data.mesas.filter((m) => m.id === undefined);

    await db.transaction(async (tx) => {
      await tx
        .insert(diningRooms)
        .values({ locationId: data.locationId, columns: data.columnas, rows: data.filas })
        .onDuplicateKeyUpdate({ set: { columns: data.columnas, rows: data.filas } });
      if (borradas.length > 0) {
        await tx.delete(diningTables).where(
          inArray(
            diningTables.id,
            borradas.map((m) => m.id),
          ),
        );
      }
      // Números provisorios negativos: intercambiar la 1 con la 2 chocaría
      // contra la unique key (sucursal, número) a mitad de camino.
      await tx
        .update(diningTables)
        .set({ number: sql`-${diningTables.id}` })
        .where(eq(diningTables.locationId, data.locationId));
      for (const m of data.mesas) {
        const valores = {
          number: m.number,
          seats: m.seats,
          shape: m.shape,
          x: m.x,
          y: m.y,
          w: m.w,
          h: m.h,
          active: m.active,
        };
        if (m.id === undefined) {
          await tx.insert(diningTables).values({
            ...valores,
            locationId: data.locationId,
            token: randomBytes(12).toString("base64url"),
          });
        } else {
          await tx
            .update(diningTables)
            .set(valores)
            .where(and(eq(diningTables.id, m.id), eq(diningTables.locationId, data.locationId)));
        }
      }
    });

    if (nuevas.length > 0 || borradas.length > 0) {
      const sucursal = await nombreDeSucursal(data.locationId);
      const lista = (ms: { number: number }[]) =>
        `${ms.length === 1 ? "la mesa" : "las mesas"} ${ms.map((m) => m.number).join(", ")}`;
      await registrarAuditoria(user, {
        category: "sucursales",
        action: "salon.mesas",
        summary: [
          nuevas.length > 0 && `agregó ${lista(nuevas)}`,
          borradas.length > 0 && `eliminó ${lista(borradas)}`,
        ]
          .filter(Boolean)
          .join(" y ")
          .replace(/^./, (c) => c.toUpperCase())
          .concat(` en ${sucursal}`),
        details: { locationId: data.locationId },
      });
    }

    return leerMesas(data.locationId);
  });

/**
 * Vale para toda la empresa, así que lo cambia el dueño: un encargado de una
 * sola sucursal no puede decidir cómo entran los pedidos de las otras.
 */
export const setMesaAutoAccept = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(z.object({ autoAccept: z.boolean() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    await assertModuloMesas(user);
    const companyId = companyIdOf(user);
    await db
      .insert(mesaSettings)
      .values({ companyId, autoAccept: data.autoAccept })
      .onDuplicateKeyUpdate({ set: { autoAccept: data.autoAccept } });
    await registrarAuditoria(user, {
      category: "pedidos",
      action: "salon.auto_aceptar",
      summary: data.autoAccept
        ? "Los pedidos de mesa ahora entran solos a la cocina"
        : "Los pedidos de mesa ahora esperan que alguien los acepte",
    });
    return { ok: true };
  });

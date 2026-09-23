import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { totems, locations } from "@/db/schema";
import { requireCompany, requireOwner } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/audit/registrar";
import { assertLocationAccess } from "@/lib/auth/scope";

export interface TotemRow {
  id: number;
  number: number;
  label: string | null;
  active: boolean;
  printerMac: string | null;
  printerName: string | null;
}

async function nombreDeSucursal(locationId: number): Promise<string> {
  const [l] = await db
    .select({ name: locations.name })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);
  return l?.name ?? "la sucursal";
}

export const listTotems = createServerFn({ method: "GET" })
  .middleware([requireCompany])
  .inputValidator(z.object({ locationId: z.number().int() }))
  .handler(async ({ context, data }): Promise<TotemRow[]> => {
    const user = context.user as SessionUser;
    await assertLocationAccess(user, data.locationId);
    return db
      .select({
        id: totems.id,
        number: totems.number,
        label: totems.label,
        active: totems.active,
        printerMac: totems.printerMac,
        printerName: totems.printerName,
      })
      .from(totems)
      .where(eq(totems.locationId, data.locationId))
      .orderBy(asc(totems.number));
  });

export const createTotem = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({ locationId: z.number().int(), label: z.string().trim().max(60).optional() }),
  )
  .handler(async ({ context, data }): Promise<TotemRow> => {
    const user = context.user as SessionUser;
    await assertLocationAccess(user, data.locationId);

    // El número siguiente del local: 1, 2, 3… sin reusar huecos.
    const [{ last }] = await db
      .select({ last: sql<number | null>`MAX(${totems.number})` })
      .from(totems)
      .where(eq(totems.locationId, data.locationId));
    const number = (last ?? 0) + 1;
    const label = data.label?.trim() || null;

    const [{ id }] = await db
      .insert(totems)
      .values({ locationId: data.locationId, number, label, active: true })
      .$returningId();

    await registrarAuditoria(user, {
      category: "sucursales",
      action: "totem.alta",
      summary: `Agregó el tótem ${number} en ${await nombreDeSucursal(data.locationId)}`,
      details: { totemId: id, locationId: data.locationId },
    });

    return { id, number, label, active: true, printerMac: null, printerName: null };
  });

export const setTotemActive = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(z.object({ id: z.number().int(), active: z.boolean() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const [t] = await db
      .select({ locationId: totems.locationId })
      .from(totems)
      .where(eq(totems.id, data.id))
      .limit(1);
    if (!t) throw new Error("Tótem no encontrado");
    await assertLocationAccess(user, t.locationId);
    await db.update(totems).set({ active: data.active }).where(eq(totems.id, data.id));
    return { ok: true };
  });

export const setTotemPrinter = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      id: z.number().int(),
      mac: z.string().trim().max(20).nullable(),
      name: z.string().trim().max(80).nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const [t] = await db
      .select({ locationId: totems.locationId, number: totems.number })
      .from(totems)
      .where(eq(totems.id, data.id))
      .limit(1);
    if (!t) throw new Error("Tótem no encontrado");
    await assertLocationAccess(user, t.locationId);

    await db
      .update(totems)
      .set({ printerMac: data.mac, printerName: data.name })
      .where(eq(totems.id, data.id));

    await registrarAuditoria(user, {
      category: "sucursales",
      action: "totem.impresora",
      summary: data.mac
        ? `Asignó la impresora ${data.name ?? data.mac} al tótem ${t.number} de ${await nombreDeSucursal(t.locationId)}`
        : `Quitó la impresora del tótem ${t.number} de ${await nombreDeSucursal(t.locationId)}`,
      details: { totemId: data.id, mac: data.mac },
    });
    return { ok: true };
  });

export const deleteTotem = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const [t] = await db
      .select({ locationId: totems.locationId, number: totems.number })
      .from(totems)
      .where(eq(totems.id, data.id))
      .limit(1);
    if (!t) throw new Error("Tótem no encontrado");
    await assertLocationAccess(user, t.locationId);

    // No dejar un local sin ningún tótem: la URL /t/{empresa}/{local}/1 tiene que existir.
    const [{ n }] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(totems)
      .where(eq(totems.locationId, t.locationId));
    if (n <= 1) throw new Error("La sucursal tiene que tener al menos un tótem");

    await db.delete(totems).where(eq(totems.id, data.id));
    await registrarAuditoria(user, {
      category: "sucursales",
      action: "totem.baja",
      summary: `Eliminó el tótem ${t.number} de ${await nombreDeSucursal(t.locationId)}`,
      details: { totemId: data.id, locationId: t.locationId },
    });
    return { ok: true };
  });

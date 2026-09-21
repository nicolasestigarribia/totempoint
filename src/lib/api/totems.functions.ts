import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { totems } from "@/db/schema";
import { requireCompany, requireOwner } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";
import { assertLocationAccess } from "@/lib/auth/scope";

export interface TotemRow {
  id: number;
  number: number;
  label: string | null;
  active: boolean;
}

export const listTotems = createServerFn({ method: "GET" })
  .middleware([requireCompany])
  .inputValidator(z.object({ locationId: z.number().int() }))
  .handler(async ({ context, data }): Promise<TotemRow[]> => {
    const user = context.user as SessionUser;
    await assertLocationAccess(user, data.locationId);
    return db
      .select({ id: totems.id, number: totems.number, label: totems.label, active: totems.active })
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

    return { id, number, label, active: true };
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

export const deleteTotem = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const [t] = await db
      .select({ locationId: totems.locationId })
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
    if (n <= 1) throw new Error("El local tiene que tener al menos un tótem");

    await db.delete(totems).where(eq(totems.id, data.id));
    return { ok: true };
  });

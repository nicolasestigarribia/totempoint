import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { requireAuth } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export interface LocationRow {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
}

export const listLocations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<LocationRow[]> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const rows = await db
      .select({
        id: locations.id,
        name: locations.name,
        address: locations.address,
        phone: locations.phone,
        active: locations.active,
      })
      .from(locations)
      .where(eq(locations.companyId, user.companyId))
      .orderBy(desc(locations.createdAt));

    return rows;
  });

export const createLocation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1).max(120),
      address: z.string().trim().max(255).optional().nullable(),
      phone: z.string().trim().max(40).optional().nullable(),
    }),
  )
  .handler(async ({ context, data }): Promise<LocationRow> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const values = {
      companyId: user.companyId,
      name: data.name.trim(),
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      active: true,
    };

    const [{ id }] = await db.insert(locations).values(values).$returningId();

    return {
      id,
      name: values.name,
      address: values.address,
      phone: values.phone,
      active: values.active,
    };
  });

export const updateLocation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      id: z.number().int(),
      name: z.string().trim().min(1).max(120),
      address: z.string().trim().max(255).optional().nullable(),
      phone: z.string().trim().max(40).optional().nullable(),
      active: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const [existing] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, data.id), eq(locations.companyId, user.companyId)))
      .limit(1);
    if (!existing) throw new Error("Local no encontrado");

    await db
      .update(locations)
      .set({
        name: data.name.trim(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        active: data.active,
      })
      .where(and(eq(locations.id, data.id), eq(locations.companyId, user.companyId)));

    return { ok: true };
  });

export const setLocationActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(z.object({ id: z.number().int(), active: z.boolean() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");
    await db
      .update(locations)
      .set({ active: data.active })
      .where(and(eq(locations.id, data.id), eq(locations.companyId, user.companyId)));
    return { ok: true };
  });

export const deleteLocation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const [existing] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, data.id), eq(locations.companyId, user.companyId)))
      .limit(1);
    if (!existing) throw new Error("Local no encontrado");

    await db
      .delete(locations)
      .where(and(eq(locations.id, data.id), eq(locations.companyId, user.companyId)));

    return { ok: true };
  });

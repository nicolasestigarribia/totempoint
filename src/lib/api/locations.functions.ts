import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { locations, totems } from "@/db/schema";
import { requireCompany, requireOwner } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";
import { accessibleLocationIds, companyIdOf } from "@/lib/auth/scope";
import { slugify } from "@/lib/slug";

export interface LocationRow {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  active: boolean;
}

// Slug único de local dentro de una empresa.
async function uniqueLocationSlug(companyId: number, name: string): Promise<string> {
  const base = slugify(name) || "negocio";
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const [exists] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.companyId, companyId), eq(locations.slug, slug)))
      .limit(1);
    if (!exists) break;
    slug = `${base}-${i}`;
  }
  return slug;
}

export const listLocations = createServerFn({ method: "GET" })
  .middleware([requireCompany])
  .handler(async ({ context }): Promise<LocationRow[]> => {
    const user = context.user as SessionUser;
    const companyId = companyIdOf(user);

    // El owner ve todos los locales de la empresa; el encargado, solo los suyos.
    const allowed = await accessibleLocationIds(user);
    if (allowed.length === 0) return [];

    const rows = await db
      .select({
        id: locations.id,
        name: locations.name,
        slug: locations.slug,
        address: locations.address,
        phone: locations.phone,
        active: locations.active,
      })
      .from(locations)
      .where(and(eq(locations.companyId, companyId), inArray(locations.id, allowed)))
      .orderBy(desc(locations.createdAt));

    return rows;
  });

export const createLocation = createServerFn({ method: "POST" })
  .middleware([requireOwner])
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

    const slug = await uniqueLocationSlug(user.companyId, data.name);
    const values = {
      companyId: user.companyId,
      name: data.name.trim(),
      slug,
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      active: true,
    };

    const [{ id }] = await db.insert(locations).values(values).$returningId();

    // Primer tótem del local, para que su URL /t/{empresa}/{local}/1 funcione ya.
    await db.insert(totems).values({ locationId: id, number: 1, active: true });

    return {
      id,
      name: values.name,
      slug: values.slug,
      address: values.address,
      phone: values.phone,
      active: values.active,
    };
  });

export const updateLocation = createServerFn({ method: "POST" })
  .middleware([requireOwner])
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
  .middleware([requireOwner])
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
  .middleware([requireOwner])
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

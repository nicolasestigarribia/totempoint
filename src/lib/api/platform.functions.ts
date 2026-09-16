import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, or, ne, and, desc } from "drizzle-orm";

import { db } from "@/db";
import { companies, locations, users, userRoles, userLocations } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth/middleware";
import { hashPassword } from "@/lib/auth/password";

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(/^[a-zA-Z0-9_.-]+$/, "Usuario: solo letras, números, . _ -");

export interface BusinessRow {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  admin_user_id: number | null;
  admin_email: string | null;
  admin_username: string | null;
}

export const listBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSuperadmin])
  .handler(async (): Promise<BusinessRow[]> => {
    const rows = await db
      .select()
      .from(companies)
      .orderBy(desc(companies.createdAt));

    const admins = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        companyId: users.companyId,
      })
      .from(users);

    const adminByCompany = new Map<number, { id: number; email: string; username: string | null }>();
    for (const a of admins) {
      if (a.companyId && !adminByCompany.has(a.companyId)) {
        adminByCompany.set(a.companyId, { id: a.id, email: a.email, username: a.username });
      }
    }

    return rows.map((c) => {
      const admin = adminByCompany.get(c.id);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        active: c.active,
        created_at: c.createdAt.toISOString(),
        admin_user_id: admin?.id ?? null,
        admin_email: admin?.email ?? null,
        admin_username: admin?.username ?? null,
      };
    });
  });

export const createBusiness = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .inputValidator(
    z.object({
      name: z.string().trim().min(2).max(80),
      adminEmail: z.string().trim().email(),
      adminUsername: usernameSchema,
      adminPassword: z.string().min(6).max(100),
    }),
  )
  .handler(async ({ data }) => {
    const email = data.adminEmail.toLowerCase();
    const username = data.adminUsername.toLowerCase();

    const [dup] = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);
    if (dup) throw new Error("Ese email o usuario ya está en uso");

    // slug único
    const base = slugify(data.name) || "empresa";
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const [exists] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.slug, slug))
        .limit(1);
      if (!exists) break;
      slug = `${base}-${i}`;
    }

    const [{ id: companyId }] = await db
      .insert(companies)
      .values({ name: data.name.trim(), slug, active: true })
      .$returningId();

    const [{ id: locationId }] = await db
      .insert(locations)
      .values({ companyId, name: "Local principal", active: true })
      .$returningId();

    const [{ id: userId }] = await db
      .insert(users)
      .values({
        email,
        username,
        passwordHash: await hashPassword(data.adminPassword),
        companyId,
        locationId,
      })
      .$returningId();
    // El usuario que se crea con la empresa es el owner (dueno de la marca).
    await db.insert(userRoles).values({ userId, role: "owner" });
    await db.insert(userLocations).values({ userId, locationId });

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    return {
      business: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        active: company.active,
        created_at: company.createdAt.toISOString(),
        admin_user_id: userId,
        admin_email: email,
        admin_username: username,
      } as BusinessRow,
    };
  });

export const updateBusinessAdmin = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .inputValidator(
    z.object({
      userId: z.number().int(),
      email: z.string().trim().email(),
      username: usernameSchema,
      password: z.string().min(6).max(100).optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const username = data.username.toLowerCase();

    const [dup] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          ne(users.id, data.userId),
          or(eq(users.email, email), eq(users.username, username)),
        ),
      )
      .limit(1);
    if (dup) throw new Error("Ese email o usuario ya está en uso por otra cuenta");

    const set: { email: string; username: string; passwordHash?: string } = {
      email,
      username,
    };
    if (data.password) set.passwordHash = await hashPassword(data.password);

    await db.update(users).set(set).where(eq(users.id, data.userId));
    return { ok: true };
  });

export const setBusinessActive = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .inputValidator(z.object({ id: z.number().int(), active: z.boolean() }))
  .handler(async ({ data }) => {
    await db
      .update(companies)
      .set({ active: data.active })
      .where(eq(companies.id, data.id));
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { db } from "@/db";
import { businesses, users, userRoles } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth/middleware";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/auth/session";

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export interface BusinessRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  admin_email: string | null;
}

export const listBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSuperadmin])
  .handler(async (): Promise<BusinessRow[]> => {
    const rows = await db
      .select()
      .from(businesses)
      .orderBy(desc(businesses.createdAt));

    const admins = await db
      .select({ email: users.email, businessId: users.businessId })
      .from(users);

    const adminByBusiness = new Map<string, string>();
    for (const a of admins) {
      if (a.businessId && !adminByBusiness.has(a.businessId)) {
        adminByBusiness.set(a.businessId, a.email);
      }
    }

    return rows.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      active: b.active,
      created_at: b.createdAt.toISOString(),
      admin_email: adminByBusiness.get(b.id) ?? null,
    }));
  });

export const createBusiness = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .inputValidator(
    z.object({
      name: z.string().trim().min(2).max(80),
      adminEmail: z.string().trim().email(),
    }),
  )
  .handler(async ({ data }) => {
    const email = data.adminEmail.toLowerCase();

    // slug único
    const base = slugify(data.name) || "negocio";
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const [exists] = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.slug, slug))
        .limit(1);
      if (!exists) break;
      slug = `${base}-${i}`;
    }

    const businessId = newId();
    await db.insert(businesses).values({
      id: businessId,
      name: data.name.trim(),
      slug,
      active: true,
    });

    // buscar o crear usuario admin
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let tempPassword: string | null = null;

    if (existing) {
      if (existing.businessId) {
        await db.delete(businesses).where(eq(businesses.id, businessId));
        throw new Error("Ese usuario ya administra otro negocio");
      }
      await db.update(users).set({ businessId }).where(eq(users.id, existing.id));
      await db
        .insert(userRoles)
        .values({ id: newId(), userId: existing.id, role: "business_admin" })
        .onDuplicateKeyUpdate({ set: { role: "business_admin" } });
    } else {
      tempPassword = `bp-${newId().slice(0, 10)}`;
      const userId = newId();
      await db.insert(users).values({
        id: userId,
        email,
        passwordHash: await hashPassword(tempPassword),
        businessId,
      });
      await db
        .insert(userRoles)
        .values({ id: newId(), userId, role: "business_admin" });
    }

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    return {
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        active: business.active,
        created_at: business.createdAt.toISOString(),
        admin_email: email,
      } as BusinessRow,
      tempPassword,
    };
  });

export const setBusinessActive = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .inputValidator(z.object({ id: z.string(), active: z.boolean() }))
  .handler(async ({ data }) => {
    await db
      .update(businesses)
      .set({ active: data.active })
      .where(eq(businesses.id, data.id));
    return { ok: true };
  });

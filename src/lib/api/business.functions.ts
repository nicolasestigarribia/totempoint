import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireAuth } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export interface MyBusiness {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  active: boolean;
}

export const getMyBusiness = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<MyBusiness | null> => {
    const user = context.user as SessionUser;
    if (!user.companyId) return null;

    const [c] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, user.companyId))
      .limit(1);

    if (!c) return null;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      logo_url: c.logoUrl,
      primary_color: c.primaryColor,
      active: c.active,
    };
  });

export const updateMyBusiness = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1).max(120),
      logoUrl: z.string().trim().max(500).optional().nullable(),
      primaryColor: z.string().trim().max(9).optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const [c] = await db
      .select({ active: companies.active })
      .from(companies)
      .where(eq(companies.id, user.companyId))
      .limit(1);
    if (!c) throw new Error("Empresa no encontrada");
    if (!c.active) throw new Error("Cuenta suspendida");

    await db
      .update(companies)
      .set({
        name: data.name.trim(),
        logoUrl: data.logoUrl?.trim() || null,
        primaryColor: data.primaryColor || null,
      })
      .where(eq(companies.id, user.companyId));

    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { requireAuth } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

export interface MyBusiness {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
}

export const getMyBusiness = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<MyBusiness | null> => {
    const user = context.user as SessionUser;
    if (!user.businessId) return null;

    const [b] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, user.businessId))
      .limit(1);

    if (!b) return null;
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      logo_url: b.logoUrl,
      primary_color: b.primaryColor,
      phone: b.phone,
      address: b.address,
      active: b.active,
    };
  });

export const updateMyBusiness = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1).max(120),
      logoUrl: z.string().trim().max(500).optional().nullable(),
      primaryColor: z.string().trim().max(9).optional().nullable(),
      phone: z.string().trim().max(40).optional().nullable(),
      address: z.string().trim().max(255).optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    if (!user.businessId) throw new Error("Usuario sin negocio asignado");

    const [b] = await db
      .select({ active: businesses.active })
      .from(businesses)
      .where(eq(businesses.id, user.businessId))
      .limit(1);
    if (!b) throw new Error("Negocio no encontrado");
    if (!b.active) throw new Error("Cuenta suspendida");

    await db
      .update(businesses)
      .set({
        name: data.name.trim(),
        logoUrl: data.logoUrl?.trim() || null,
        primaryColor: data.primaryColor || null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
      })
      .where(eq(businesses.id, user.businessId));

    return { ok: true };
  });

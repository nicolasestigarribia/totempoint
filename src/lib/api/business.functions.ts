import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, totemSettings } from "@/db/schema";
import { requireCompany, requireOwner, requireView, requireEdit } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";
import type { TotemTemplate } from "@/lib/api/totem.functions";

export interface MyBusiness {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  active: boolean;
}

export const getMyBusiness = createServerFn({ method: "GET" })
  .middleware([requireCompany])
  .handler(async ({ context }): Promise<MyBusiness | null> => {
    const user = context.user as SessionUser;
    if (!user.companyId) return null;

    const [c] = await db.select().from(companies).where(eq(companies.id, user.companyId)).limit(1);

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

// Los datos de la empresa son del dueño: no se delegan.
export const updateMyBusiness = createServerFn({ method: "POST" })
  .middleware([requireOwner])
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

// ---------- Portada del tótem ----------

export interface MyTotemSettings {
  template: TotemTemplate;
  /** Base de color de las pantallas de adentro del tótem. */
  theme: "oscuro" | "claro" | "calido" | "noche" | "arena" | "bosque";
  /** Pareja de tipografías: cambia el aire sin tocar el contenido. */
  fontTheme: "impacto" | "elegante" | "moderno" | "redondeado" | "sobrio";
  /** Qué tan redondeadas van las cajas. */
  corners: "redondeado" | "suave" | "recto";
  heroImageUrl: string;
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  ctaLabel: string;
  badge1: string;
  badge2: string;
  accentColor: string;
}

export const getMyTotemSettings = createServerFn({ method: "GET" })
  .middleware([requireView("portada")])
  .handler(async ({ context }): Promise<MyTotemSettings | null> => {
    const user = context.user as SessionUser;
    if (!user.companyId) return null;

    const [s] = await db
      .select()
      .from(totemSettings)
      .where(eq(totemSettings.companyId, user.companyId))
      .limit(1);

    return {
      template: (s?.template as TotemTemplate) ?? "clasico",
      theme: s?.theme ?? "oscuro",
      fontTheme: s?.fontTheme ?? "impacto",
      corners: s?.corners ?? "redondeado",
      heroImageUrl: s?.heroImageUrl ?? "",
      eyebrow: s?.eyebrow ?? "",
      title: s?.title ?? "",
      titleAccent: s?.titleAccent ?? "",
      subtitle: s?.subtitle ?? "",
      ctaLabel: s?.ctaLabel ?? "Empezar pedido",
      badge1: s?.badge1 ?? "",
      badge2: s?.badge2 ?? "",
      accentColor: s?.accentColor ?? "",
    };
  });

export const updateMyTotemSettings = createServerFn({ method: "POST" })
  .middleware([requireEdit("portada")])
  .inputValidator(
    z.object({
      template: z.enum(["clasico", "completo", "split"]),
      theme: z.enum(["oscuro", "claro", "calido", "noche", "arena", "bosque"]).default("oscuro"),
      fontTheme: z
        .enum(["impacto", "elegante", "moderno", "redondeado", "sobrio"])
        .default("impacto"),
      corners: z.enum(["redondeado", "suave", "recto"]).default("redondeado"),
      heroImageUrl: z.string().trim().max(500),
      eyebrow: z.string().trim().max(60),
      title: z.string().trim().max(60),
      titleAccent: z.string().trim().max(60),
      subtitle: z.string().trim().max(255),
      ctaLabel: z.string().trim().min(1).max(40),
      badge1: z.string().trim().max(40),
      badge2: z.string().trim().max(40),
      accentColor: z.string().trim().max(9),
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

    const values = {
      template: data.template,
      theme: data.theme,
      fontTheme: data.fontTheme,
      corners: data.corners,
      heroImageUrl: data.heroImageUrl || null,
      eyebrow: data.eyebrow || null,
      title: data.title || null,
      titleAccent: data.titleAccent || null,
      subtitle: data.subtitle || null,
      ctaLabel: data.ctaLabel,
      badge1: data.badge1 || null,
      badge2: data.badge2 || null,
      accentColor: data.accentColor || null,
    };

    await db
      .insert(totemSettings)
      .values({ companyId: user.companyId, ...values })
      .onDuplicateKeyUpdate({ set: values });

    return { ok: true };
  });

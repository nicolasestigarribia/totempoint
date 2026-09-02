import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthedContext = {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
  userId: string;
};

async function assertSuperadmin(context: AuthedContext) {
  const { data, error } = await context.supabase.rpc("is_superadmin", {
    _user_id: context.userId,
  });
  if (error || data !== true) {
    throw new Error("No autorizado: se requiere rol superadmin");
  }
}

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BusinessRow[]> => {
    await assertSuperadmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: businesses, error } = await supabaseAdmin
      .from("businesses")
      .select("id, name, slug, active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, business_id")
      .not("business_id", "is", null);

    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailById = new Map((usersData?.users ?? []).map((u) => [u.id, u.email ?? null]));

    const adminByBusiness = new Map<string, string | null>();
    for (const p of profiles ?? []) {
      if (p.business_id && !adminByBusiness.has(p.business_id)) {
        adminByBusiness.set(p.business_id, emailById.get(p.user_id) ?? null);
      }
    }

    return (businesses ?? []).map((b) => ({
      ...b,
      admin_email: adminByBusiness.get(b.id) ?? null,
    }));
  });

export const createBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().trim().min(2).max(80),
      adminEmail: z.string().trim().email(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertSuperadmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.adminEmail.toLowerCase();
    const base = slugify(data.name) || "negocio";
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const { data: exists } = await supabaseAdmin
        .from("businesses")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!exists) break;
      slug = `${base}-${i}`;
    }

    const { data: business, error: bizErr } = await supabaseAdmin
      .from("businesses")
      .insert({ name: data.name.trim(), slug, active: true })
      .select("id, name, slug, active, created_at")
      .single();
    if (bizErr || !business) throw new Error(bizErr?.message ?? "No se pudo crear el negocio");

    // Buscar o crear el usuario administrador
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    let userId = (usersData?.users ?? []).find((u) => u.email?.toLowerCase() === email)?.id;
    let tempPassword: string | null = null;

    if (!userId) {
      tempPassword = `bp-${crypto.randomUUID().slice(0, 10)}`;
      const { data: created, error: userErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });
      if (userErr || !created.user) {
        await supabaseAdmin.from("businesses").delete().eq("id", business.id);
        throw new Error(userErr?.message ?? "No se pudo crear el usuario administrador");
      }
      userId = created.user.id;
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, business_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfile?.business_id) {
      await supabaseAdmin.from("businesses").delete().eq("id", business.id);
      throw new Error("Ese usuario ya administra otro negocio");
    }

    if (existingProfile) {
      await supabaseAdmin
        .from("profiles")
        .update({ business_id: business.id })
        .eq("id", existingProfile.id);
    } else {
      await supabaseAdmin
        .from("profiles")
        .insert({ user_id: userId, business_id: business.id, role: "admin" });
    }

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "business_admin" }, { onConflict: "user_id,role" });

    return {
      business: { ...business, admin_email: email } as BusinessRow,
      tempPassword,
    };
  });

export const setBusinessActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), active: z.boolean() }))
  .handler(async ({ context, data }) => {
    await assertSuperadmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("businesses")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

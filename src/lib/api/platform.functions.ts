import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, or, ne, and, desc, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { companies, locations, totems, users, userRoles, userLocations, orders } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth/middleware";
import { hashPassword } from "@/lib/auth/password";
import { passwordSchema, emailSchema } from "@/lib/auth/password-policy";
import { setActingCompany, clearActingCompany, destroyUserSessions } from "@/lib/auth/session";
import { slugify, isReservedSlug } from "@/lib/slug";

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
    const rows = await db.select().from(companies).orderBy(desc(companies.createdAt));

    // El dueño es el que tiene el rol owner, no el primer usuario que aparezca
    // de esa empresa: si el encargado se creó antes, "Credenciales" terminaba
    // editando a la persona equivocada.
    const admins = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        companyId: users.companyId,
      })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(eq(userRoles.role, "owner"))
      .orderBy(users.id);

    const adminByCompany = new Map<
      number,
      { id: number; email: string; username: string | null }
    >();
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
      adminEmail: emailSchema,
      adminUsername: usernameSchema,
      adminPassword: passwordSchema,
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

    // slug único y que no choque con rutas del sistema (/admin, /login, etc.).
    const base = slugify(data.name) || "empresa";
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const [exists] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.slug, slug))
        .limit(1);
      if (!exists && !isReservedSlug(slug)) break;
      slug = `${base}-${i}`;
    }

    const [{ id: companyId }] = await db
      .insert(companies)
      .values({ name: data.name.trim(), slug, active: true })
      .$returningId();

    // Primer negocio de la empresa. El nombre es solo el inicial: el dueño lo
    // cambia desde Negocios (por ejemplo, "PrimoRosas Cariló").
    const [{ id: locationId }] = await db
      .insert(locations)
      .values({ companyId, name: "Casa central", slug: "casa-central", active: true })
      .$returningId();

    // Primer tótem del local, para que la URL /t/{empresa}/{local}/1 funcione ya.
    await db.insert(totems).values({ locationId, number: 1, active: true });

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

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);

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
      email: emailSchema,
      username: usernameSchema,
      password: passwordSchema.optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const username = data.username.toLowerCase();

    const [dup] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(ne(users.id, data.userId), or(eq(users.email, email), eq(users.username, username))),
      )
      .limit(1);
    if (dup) throw new Error("Ese email o usuario ya está en uso por otra cuenta");

    const set: { email: string; username: string; passwordHash?: string } = {
      email,
      username,
    };
    if (data.password) set.passwordHash = await hashPassword(data.password);

    await db.update(users).set(set).where(eq(users.id, data.userId));
    // Si le cambiamos la clave al dueño, su sesión abierta deja de valer.
    if (data.password) await destroyUserSessions(data.userId);
    return { ok: true };
  });

/**
 * Le da un dueño a una empresa que no tiene.
 *
 * Pasa cuando el alta quedó a medias, o cuando el dueño se borró. Sin esto la
 * empresa queda muerta: el superadmin puede entrar, pero nadie del negocio.
 * Si ya hay un owner no se crea otro — para cambiarle el mail o la clave está
 * Credenciales.
 */
export const assignBusinessOwner = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .inputValidator(
    z.object({
      companyId: z.number().int(),
      email: emailSchema,
      username: usernameSchema,
      password: passwordSchema,
    }),
  )
  .handler(async ({ data }) => {
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, data.companyId))
      .limit(1);
    if (!company) throw new Error("No encontramos esa empresa");

    const [yaHay] = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(and(eq(users.companyId, data.companyId), eq(userRoles.role, "owner")))
      .limit(1);
    if (yaHay) throw new Error("Esa empresa ya tiene dueño. Cambiale los datos desde Credenciales");

    const email = data.email.toLowerCase();
    const username = data.username.toLowerCase();
    const [dup] = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);
    if (dup) throw new Error("Ese email o usuario ya está en uso");

    // Lo dejamos parado en el primer negocio de la empresa, como en el alta.
    const [primerNegocio] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.companyId, data.companyId))
      .orderBy(locations.id)
      .limit(1);

    const [{ id: userId }] = await db
      .insert(users)
      .values({
        email,
        username,
        passwordHash: await hashPassword(data.password),
        companyId: data.companyId,
        locationId: primerNegocio?.id ?? null,
      })
      .$returningId();

    await db.insert(userRoles).values({ userId, role: "owner" });
    if (primerNegocio) {
      await db.insert(userLocations).values({ userId, locationId: primerNegocio.id });
    }

    return { ok: true };
  });

/**
 * Cambia la dirección del tótem de una empresa.
 *
 * El slug se genera del nombre al dar de alta y hasta ahora no se podía tocar,
 * así que un negocio que se renombraba quedaba con la URL vieja para siempre.
 * Cambiarlo rompe el enlace anterior y el QR impreso: eso se avisa en pantalla
 * y por eso lo hace el superadmin, no el dueño.
 */
export const updateBusinessSlug = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .inputValidator(
    z.object({
      companyId: z.number().int(),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .min(3, "Al menos 3 caracteres")
        .max(50)
        .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones")
        .regex(/^[a-z0-9]/, "Tiene que empezar con letra o número")
        .regex(/[a-z0-9]$/, "No puede terminar en guion"),
    }),
  )
  .handler(async ({ data }) => {
    if (isReservedSlug(data.slug)) {
      throw new Error("Esa dirección está reservada por el sistema");
    }
    const [ocupado] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.slug, data.slug), ne(companies.id, data.companyId)))
      .limit(1);
    if (ocupado) throw new Error("Esa dirección ya la usa otra empresa");

    await db.update(companies).set({ slug: data.slug }).where(eq(companies.id, data.companyId));
    return { ok: true };
  });

export const setBusinessActive = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .inputValidator(z.object({ id: z.number().int(), active: z.boolean() }))
  .handler(async ({ data }) => {
    await db.update(companies).set({ active: data.active }).where(eq(companies.id, data.id));

    // Dar de baja una empresa tiene que sacar a su gente del panel ahora, no
    // cuando venza la sesión: la sesión solo mira si el usuario está activo, no
    // si la empresa lo está.
    if (!data.active) {
      const gente = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.companyId, data.id));
      for (const u of gente) await destroyUserSessions(u.id);
    }
    return { ok: true };
  });

/**
 * El superadmin entra al panel de una empresa para verla/operarla como el dueño.
 * Mientras esté "adentro", sus server functions trabajan con ese companyId.
 */
export const enterBusiness = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .inputValidator(z.object({ companyId: z.number().int() }))
  .handler(async ({ data }) => {
    const [company] = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.id, data.companyId))
      .limit(1);
    if (!company) throw new Error("La empresa no existe");

    setActingCompany(company.id);
    return { id: company.id, name: company.name };
  });

/** Vuelve al panel de superadmin. */
export const exitBusiness = createServerFn({ method: "POST" })
  .middleware([requireSuperadmin])
  .handler(async () => {
    clearActingCompany();
    return { ok: true };
  });

/**
 * Facturación por empresa, para el panel de plataforma. Suma los pedidos de
 * todos los locales de cada empresa en el rango pedido.
 *
 * No discrimina por forma de pago porque todavía no existe: `orders` guarda un
 * `paid` booleano y nada más. Cuando se integren los pagos, la columna se suma
 * acá sin tocar la pantalla.
 */
export interface CompanyRevenueRow {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  orders: number;
  total: string;
  avgTicket: string;
  lastOrderAt: string | null;
}

export const getPlatformRevenue = createServerFn({ method: "GET" })
  .middleware([requireSuperadmin])
  .inputValidator(
    z.object({
      from: z.string().optional().nullable(),
      to: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }): Promise<CompanyRevenueRow[]> => {
    const range = [
      data.from ? gte(orders.createdAt, new Date(data.from)) : undefined,
      data.to ? lte(orders.createdAt, new Date(data.to)) : undefined,
    ].filter(Boolean);

    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        active: companies.active,
        orders: sql<number>`COUNT(${orders.id})`,
        total: sql<string | null>`SUM(${orders.total})`,
        lastOrderAt: sql<Date | null>`MAX(${orders.createdAt})`,
      })
      .from(companies)
      .leftJoin(locations, eq(locations.companyId, companies.id))
      .leftJoin(orders, and(eq(orders.locationId, locations.id), ...range))
      .groupBy(companies.id, companies.name, companies.slug, companies.active)
      .orderBy(desc(sql`SUM(${orders.total})`));

    return rows.map((r) => {
      const count = Number(r.orders ?? 0);
      const total = Number(r.total ?? 0);
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        active: r.active,
        orders: count,
        total: total.toFixed(2),
        avgTicket: count > 0 ? (total / count).toFixed(2) : "0.00",
        lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt).toISOString() : null,
      };
    });
  });

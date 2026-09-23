import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, inArray, ne, or, desc } from "drizzle-orm";

import { db } from "@/db";
import {
  users,
  userRoles,
  userLocations,
  userPermissions,
  locations,
  PANEL_SECTIONS,
} from "@/db/schema";
import { requireOwner } from "@/lib/auth/middleware";
import { hashPassword } from "@/lib/auth/password";
import type { SessionUser, PanelSection, PermissionLevel } from "@/lib/auth/session";
import { destroyUserSessions } from "@/lib/auth/session";
import { companyIdOf } from "@/lib/auth/scope";
import { passwordSchema, emailSchema } from "@/lib/auth/password-policy";
import { SECTION_LABEL } from "@/lib/auth/permissions";
import { registrarAuditoria } from "@/lib/audit/registrar";

/**
 * Operadores de una empresa: el owner da de alta encargados y les asigna los
 * negocios que van a manejar (reglas de negocio, punto 3).
 */

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(/^[a-zA-Z0-9_.-]+$/, "Usuario: solo letras, números, . _ -");

// El owner no puede crear otros owners ni superadmins desde el panel.
const assignableRoleSchema = z.enum(["encargado", "kitchen"]);

// Permisos que el dueño reparte sección por sección. Resumen, Negocios y
// Operadores no están en la lista: son del dueño y no se delegan.
const permissionsSchema = z
  .array(
    z.object({
      section: z.enum(PANEL_SECTIONS),
      level: z.enum(["ver", "editar"]),
    }),
  )
  .default([]);

export interface OperatorRow {
  id: number;
  email: string;
  username: string | null;
  roles: string[];
  locationIds: number[];
  permissions: Partial<Record<PanelSection, PermissionLevel>>;
  active: boolean;
  createdAt: string;
  isSelf: boolean;
}

/** Ids de los locales de la empresa, para validar asignaciones. */
async function companyLocationIds(companyId: number): Promise<number[]> {
  const rows = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.companyId, companyId));
  return rows.map((r) => r.id);
}

/**
 * Valida que el usuario objetivo exista y sea un operador de la misma empresa.
 * El owner no puede tocar a otro dueño; el superadmin sí, porque ve todo.
 */
async function loadTargetUser(userId: number, companyId: number, caller: SessionUser) {
  const [target] = await db
    .select({ id: users.id, companyId: users.companyId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target || target.companyId !== companyId) {
    throw new Error("Ese usuario no pertenece a tu empresa");
  }
  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  const roleNames = roles.map((r) => r.role);
  const callerIsSuperadmin = caller.roles.includes("superadmin");
  if (roleNames.includes("superadmin")) {
    throw new Error("No podés modificar a un superusuario desde este panel");
  }
  if (roleNames.includes("owner") && !callerIsSuperadmin) {
    throw new Error("No podés modificar a un dueño desde este panel");
  }
  return { ...target, roles: roleNames };
}

async function assertEmailUsernameFree(email: string, username: string, exceptUserId?: number) {
  const dupWhere = or(eq(users.email, email), eq(users.username, username));
  const [dup] = await db
    .select({ id: users.id })
    .from(users)
    .where(exceptUserId ? and(ne(users.id, exceptUserId), dupWhere) : dupWhere)
    .limit(1);
  if (dup) throw new Error("Ese email o usuario ya está en uso");
}

/** Reemplaza los permisos de un operador por los que mandó el dueño. */
async function replacePermissions(
  userId: number,
  wanted: { section: PanelSection; level: PermissionLevel }[],
) {
  await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
  const unique = new Map(wanted.map((p) => [p.section, p.level]));
  if (unique.size > 0) {
    await db
      .insert(userPermissions)
      .values([...unique].map(([section, level]) => ({ userId, section, level })));
  }
}

/** Reemplaza los locales asignados a un usuario, validando que sean de la empresa. */
async function replaceAssignedLocations(userId: number, companyId: number, wanted: number[]) {
  const valid = new Set(await companyLocationIds(companyId));
  const unique = [...new Set(wanted)];
  for (const id of unique) {
    if (!valid.has(id)) throw new Error("Una de las sucursales no pertenece a tu empresa");
  }

  await db.delete(userLocations).where(eq(userLocations.userId, userId));
  if (unique.length > 0) {
    await db.insert(userLocations).values(unique.map((locationId) => ({ userId, locationId })));
  }
}

const ROL_LABEL: Record<string, string> = {
  encargado: "encargado",
  kitchen: "cocina",
  owner: "dueño",
};

/** Lo que define qué puede hacer un operador, para comparar antes y después. */
async function accesoDe(userId: number) {
  const [u] = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  const locs = await db
    .select({ id: userLocations.locationId })
    .from(userLocations)
    .where(eq(userLocations.userId, userId));
  const perms = await db
    .select({ section: userPermissions.section, level: userPermissions.level })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));
  return {
    email: u?.email ?? "",
    username: u?.username ?? null,
    roles: roles.map((r) => r.role).sort(),
    locationIds: locs.map((l) => l.id).sort((a, b) => a - b),
    permissions: Object.fromEntries(perms.map((p) => [p.section, p.level])) as Partial<
      Record<PanelSection, PermissionLevel>
    >,
  };
}

async function nombresDeSucursales(ids: number[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ name: locations.name })
    .from(locations)
    .where(inArray(locations.id, ids));
  return rows.map((r) => r.name);
}

function describirPermisos(p: Partial<Record<PanelSection, PermissionLevel>>): string {
  const partes = PANEL_SECTIONS.filter((s) => p[s]).map(
    (s) => `${SECTION_LABEL[s]} (${p[s] === "editar" ? "editar" : "ver"})`,
  );
  return partes.length ? partes.join(", ") : "ninguno";
}

export const listOperators = createServerFn({ method: "GET" })
  .middleware([requireOwner])
  .handler(async ({ context }): Promise<OperatorRow[]> => {
    const user = context.user as SessionUser;
    const companyId = companyIdOf(user);

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.companyId, companyId))
      .orderBy(desc(users.createdAt));

    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);

    const roleRows = await db
      .select({ userId: userRoles.userId, role: userRoles.role })
      .from(userRoles)
      .where(inArray(userRoles.userId, ids));

    const locRows = await db
      .select({ userId: userLocations.userId, locationId: userLocations.locationId })
      .from(userLocations)
      .where(inArray(userLocations.userId, ids));

    const permRows = await db
      .select({
        userId: userPermissions.userId,
        section: userPermissions.section,
        level: userPermissions.level,
      })
      .from(userPermissions)
      .where(inArray(userPermissions.userId, ids));

    const permsByUser = new Map<number, Partial<Record<PanelSection, PermissionLevel>>>();
    for (const p of permRows) {
      const map = permsByUser.get(p.userId) ?? {};
      map[p.section] = p.level;
      permsByUser.set(p.userId, map);
    }

    const rolesByUser = new Map<number, string[]>();
    for (const r of roleRows) {
      const list = rolesByUser.get(r.userId) ?? [];
      list.push(r.role);
      rolesByUser.set(r.userId, list);
    }

    const locsByUser = new Map<number, number[]>();
    for (const l of locRows) {
      const list = locsByUser.get(l.userId) ?? [];
      list.push(l.locationId);
      locsByUser.set(l.userId, list);
    }

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      username: r.username,
      roles: rolesByUser.get(r.id) ?? [],
      locationIds: locsByUser.get(r.id) ?? [],
      permissions: permsByUser.get(r.id) ?? {},
      active: r.active,
      createdAt: r.createdAt.toISOString(),
      isSelf: r.id === user.id,
    }));
  });

export const createOperator = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      email: emailSchema,
      username: usernameSchema,
      password: passwordSchema,
      role: assignableRoleSchema,
      locationIds: z.array(z.number().int()).default([]),
      permissions: permissionsSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const companyId = companyIdOf(user);

    const email = data.email.toLowerCase();
    const username = data.username.toLowerCase();
    await assertEmailUsernameFree(email, username);

    if (data.role === "encargado" && data.locationIds.length === 0) {
      throw new Error("Asigná al menos una sucursal al encargado");
    }

    const [{ id: userId }] = await db
      .insert(users)
      .values({
        email,
        username,
        passwordHash: await hashPassword(data.password),
        companyId,
        locationId: data.locationIds[0] ?? null,
        active: true,
      })
      .$returningId();

    await db.insert(userRoles).values({ userId, role: data.role });
    await replaceAssignedLocations(userId, companyId, data.locationIds);
    await replacePermissions(userId, data.permissions);

    const despues = await accesoDe(userId);
    const sucursales = await nombresDeSucursales(despues.locationIds);
    await registrarAuditoria(user, {
      category: "permisos",
      action: "operador.alta",
      summary:
        `Dio de alta a ${email} como ${ROL_LABEL[data.role] ?? data.role}` +
        (sucursales.length ? ` en ${sucursales.join(", ")}` : "") +
        `. Permisos: ${describirPermisos(despues.permissions)}`,
      details: { despues: { ...despues, sucursales } },
    });

    return { id: userId };
  });

export const updateOperator = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      userId: z.number().int(),
      email: emailSchema,
      username: usernameSchema,
      password: passwordSchema.optional().nullable(),
      role: assignableRoleSchema,
      locationIds: z.array(z.number().int()).default([]),
      permissions: permissionsSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const companyId = companyIdOf(user);
    await loadTargetUser(data.userId, companyId, user);
    const antes = await accesoDe(data.userId);

    const email = data.email.toLowerCase();
    const username = data.username.toLowerCase();
    await assertEmailUsernameFree(email, username, data.userId);

    if (data.role === "encargado" && data.locationIds.length === 0) {
      throw new Error("Asigná al menos una sucursal al encargado");
    }

    const set: {
      email: string;
      username: string;
      locationId: number | null;
      passwordHash?: string;
    } = {
      email,
      username,
      locationId: data.locationIds[0] ?? null,
    };
    if (data.password) set.passwordHash = await hashPassword(data.password);

    await db.update(users).set(set).where(eq(users.id, data.userId));

    // Cambiarle la contraseña a alguien es, casi siempre, sacarlo: se fue de la
    // empresa o se la vieron. Si la sesión que tenía abierta sigue viva, el
    // cambio no hizo nada hasta que esa sesión caduque sola.
    if (data.password) await destroyUserSessions(data.userId);

    await db.delete(userRoles).where(eq(userRoles.userId, data.userId));
    await db.insert(userRoles).values({ userId: data.userId, role: data.role });

    await replaceAssignedLocations(data.userId, companyId, data.locationIds);
    await replacePermissions(data.userId, data.permissions);

    // Se registra qué cambió y no el formulario entero: el dueño guarda el
    // mismo formulario para corregir un mail que para darle Precios a alguien,
    // y lo que importa encontrar después es lo segundo.
    const despues = await accesoDe(data.userId);
    const cambios: string[] = [];
    if (antes.email !== despues.email) cambios.push(`mail ${antes.email} → ${despues.email}`);
    if (antes.username !== despues.username) {
      cambios.push(`usuario ${antes.username ?? "—"} → ${despues.username ?? "—"}`);
    }
    if (antes.roles.join() !== despues.roles.join()) {
      const r = (l: string[]) => l.map((x) => ROL_LABEL[x] ?? x).join(", ") || "—";
      cambios.push(`rol ${r(antes.roles)} → ${r(despues.roles)}`);
    }
    if (antes.locationIds.join() !== despues.locationIds.join()) {
      const [a, d] = await Promise.all([
        nombresDeSucursales(antes.locationIds),
        nombresDeSucursales(despues.locationIds),
      ]);
      cambios.push(`sucursales ${a.join(", ") || "ninguna"} → ${d.join(", ") || "ninguna"}`);
    }
    const permisosAntes = describirPermisos(antes.permissions);
    const permisosDespues = describirPermisos(despues.permissions);
    if (permisosAntes !== permisosDespues) {
      cambios.push(`permisos ${permisosAntes} → ${permisosDespues}`);
    }
    if (data.password) cambios.push("le cambió la contraseña y cerró sus sesiones");

    if (cambios.length > 0) {
      await registrarAuditoria(user, {
        category: "permisos",
        action: data.password && cambios.length === 1 ? "operador.clave" : "operador.cambio",
        summary: `Modificó a ${despues.email}: ${cambios.join("; ")}`,
        details: { antes, despues, cambioClave: Boolean(data.password) },
      });
    }

    return { ok: true };
  });

export const setOperatorActive = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(z.object({ userId: z.number().int(), active: z.boolean() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const companyId = companyIdOf(user);
    if (data.userId === user.id) throw new Error("No podés desactivar tu propio usuario");
    await loadTargetUser(data.userId, companyId, user);

    await db.update(users).set({ active: data.active }).where(eq(users.id, data.userId));
    // Desactivar tiene que surtir efecto ya, no en el próximo login.
    if (!data.active) await destroyUserSessions(data.userId);

    const { email } = await accesoDe(data.userId);
    await registrarAuditoria(user, {
      category: "permisos",
      action: data.active ? "operador.activar" : "operador.desactivar",
      summary: data.active
        ? `Reactivó el acceso de ${email}`
        : `Desactivó a ${email} y cerró sus sesiones`,
    });
    return { ok: true };
  });

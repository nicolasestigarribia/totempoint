import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, inArray, ne, or, desc } from "drizzle-orm";

import { db } from "@/db";
import { users, userRoles, userLocations, locations } from "@/db/schema";
import { requireOwner } from "@/lib/auth/middleware";
import { hashPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session";
import { companyIdOf } from "@/lib/auth/scope";

/**
 * Operadores de una empresa: el owner da de alta encargados y les asigna los
 * locales que van a manejar (reglas de negocio, punto 3).
 */

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(/^[a-zA-Z0-9_.-]+$/, "Usuario: solo letras, números, . _ -");

const passwordSchema = z.string().min(6).max(100);

// El owner no puede crear otros owners ni superadmins desde el panel.
const assignableRoleSchema = z.enum(["encargado", "kitchen"]);

export interface OperatorRow {
  id: number;
  email: string;
  username: string | null;
  roles: string[];
  locationIds: number[];
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

/** Reemplaza los locales asignados a un usuario, validando que sean de la empresa. */
async function replaceAssignedLocations(userId: number, companyId: number, wanted: number[]) {
  const valid = new Set(await companyLocationIds(companyId));
  const unique = [...new Set(wanted)];
  for (const id of unique) {
    if (!valid.has(id)) throw new Error("Uno de los locales no pertenece a tu empresa");
  }

  await db.delete(userLocations).where(eq(userLocations.userId, userId));
  if (unique.length > 0) {
    await db.insert(userLocations).values(unique.map((locationId) => ({ userId, locationId })));
  }
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
      active: r.active,
      createdAt: r.createdAt.toISOString(),
      isSelf: r.id === user.id,
    }));
  });

export const createOperator = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      email: z.string().trim().email(),
      username: usernameSchema,
      password: passwordSchema,
      role: assignableRoleSchema,
      locationIds: z.array(z.number().int()).default([]),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const companyId = companyIdOf(user);

    const email = data.email.toLowerCase();
    const username = data.username.toLowerCase();
    await assertEmailUsernameFree(email, username);

    if (data.role === "encargado" && data.locationIds.length === 0) {
      throw new Error("Asigná al menos un local al encargado");
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

    return { id: userId };
  });

export const updateOperator = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      userId: z.number().int(),
      email: z.string().trim().email(),
      username: usernameSchema,
      password: passwordSchema.optional().nullable(),
      role: assignableRoleSchema,
      locationIds: z.array(z.number().int()).default([]),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    const companyId = companyIdOf(user);
    await loadTargetUser(data.userId, companyId, user);

    const email = data.email.toLowerCase();
    const username = data.username.toLowerCase();
    await assertEmailUsernameFree(email, username, data.userId);

    if (data.role === "encargado" && data.locationIds.length === 0) {
      throw new Error("Asigná al menos un local al encargado");
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

    await db.delete(userRoles).where(eq(userRoles.userId, data.userId));
    await db.insert(userRoles).values({ userId: data.userId, role: data.role });

    await replaceAssignedLocations(data.userId, companyId, data.locationIds);

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
    return { ok: true };
  });

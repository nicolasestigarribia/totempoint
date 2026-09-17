import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles, userLocations, userPermissions } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";
import type { PanelSection, PermissionLevel } from "@/lib/auth/session";

export interface AuthUser {
  id: number;
  email: string;
  companyId: number | null;
  locationId: number | null;
  roles: string[];
  /** Empresa que el superadmin esta mirando; null para todos los demas. */
  actingCompanyId: number | null;
  /** Negocios asignados (vacio para owner y superadmin: no se limitan por negocio). */
  locationIds: number[];
  /** Qué puede hacer en cada sección del panel. Vacío = puede todo (dueño). */
  permissions: Partial<Record<PanelSection, PermissionLevel>>;
}

export const login = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      identifier: z.string().trim().min(1),
      password: z.string().min(1),
    }),
  )
  .handler(async ({ data }): Promise<AuthUser> => {
    const identifier = data.identifier.toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier)))
      .limit(1);

    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      throw new Error("Usuario o contraseña incorrectos");
    }

    if (!user.active) {
      throw new Error("Tu usuario está desactivado. Contactate con el dueño de la empresa");
    }

    await createSession(user.id);

    const roles = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, user.id));

    const assigned = await db
      .select({ locationId: userLocations.locationId })
      .from(userLocations)
      .where(eq(userLocations.userId, user.id));

    const perms = await db
      .select({ section: userPermissions.section, level: userPermissions.level })
      .from(userPermissions)
      .where(eq(userPermissions.userId, user.id));
    const permissions: Partial<Record<PanelSection, PermissionLevel>> = {};
    for (const p of perms) permissions[p.section] = p.level;

    return {
      id: user.id,
      email: user.email,
      companyId: user.companyId,
      locationId: user.locationId,
      roles: roles.map((r) => r.role),
      actingCompanyId: null,
      locationIds: assigned.map((a) => a.locationId),
      permissions,
    };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true };
});

export const me = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthUser | null> => {
    return getSessionUser();
  },
);

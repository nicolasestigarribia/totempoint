import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles, userLocations, userPermissions } from "@/db/schema";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { passwordSchema } from "@/lib/auth/password-policy";
import { requireAuth } from "@/lib/auth/middleware";
import { checkLock, registerFailure, clearFailures, LOCK_MESSAGE } from "@/lib/auth/throttle";
import {
  createSession,
  destroySession,
  getSessionUser,
  destroyUserSessions,
  currentSessionToken,
} from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/session";
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

    const lock = await checkLock(identifier);
    if (lock.locked) throw new Error(LOCK_MESSAGE(lock.minutesLeft));

    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier)))
      .limit(1);

    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      await registerFailure(identifier);
      throw new Error("Usuario o contraseña incorrectos");
    }

    if (!user.active) {
      throw new Error("Tu usuario está desactivado. Contactate con el dueño de la empresa");
    }

    await clearFailures(identifier);

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

export const me = createServerFn({ method: "GET" }).handler(async (): Promise<AuthUser | null> => {
  return getSessionUser();
});

/**
 * Cambiar la propia contraseña.
 *
 * Hasta acá la única forma de cambiarla era pedírselo a alguien de arriba: el
 * dueño reseteaba a sus encargados y el superadmin a los dueños. Eso obliga a
 * decir la contraseña en voz alta y a que alguien más la conozca.
 *
 * Pide la actual aunque haya sesión iniciada: si alguien se sienta en la
 * tablet que quedó abierta, no tiene que poder dejar al dueño afuera de su
 * propia empresa. Y al terminar se cierran las demás sesiones, que es lo que
 * uno espera cuando cambia una contraseña porque piensa que se la vieron.
 */
export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      currentPassword: z.string().min(1, "Escribí tu contraseña actual"),
      newPassword: passwordSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    const session = context.user as SessionUser;

    const [row] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);
    if (!row) throw new Error("No encontramos tu usuario");

    if (!(await verifyPassword(data.currentPassword, row.passwordHash))) {
      throw new Error("La contraseña actual no es correcta");
    }
    if (await verifyPassword(data.newPassword, row.passwordHash)) {
      throw new Error("La nueva contraseña tiene que ser distinta de la actual");
    }

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(data.newPassword) })
      .where(eq(users.id, session.id));

    await destroyUserSessions(session.id, currentSessionToken());

    return { ok: true };
  });

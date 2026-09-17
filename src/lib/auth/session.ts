import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { setCookie, getCookie, deleteCookie } from "@tanstack/react-start/server";
import { db } from "@/db";
import { sessions, users, userRoles, userLocations, userPermissions } from "@/db/schema";
import type { PanelSection, PermissionLevel, PermissionMap } from "./permissions";

const COOKIE_NAME = "session";
// El superadmin puede "entrar" a una empresa para verla como si fuera propia.
// Guardamos esa empresa en su propia cookie, no en la sesion, para que salir
// sea tan simple como borrarla y no toque la sesion real.
const ACTING_COOKIE = "acting_company";
const SESSION_DAYS = 30;

// Roles del sistema (ver reglas de negocio):
// superadmin = equipo de desarrollo, owner = dueno de la empresa,
// encargado = administrador de uno o mas locales.
export type Role = "superadmin" | "owner" | "encargado" | "kitchen";

export type { PanelSection, PermissionLevel, PermissionMap };

export interface SessionUser {
  id: number;
  email: string;
  companyId: number | null;
  /** Local por defecto (legacy). El alcance real esta en locationIds. */
  locationId: number | null;
  roles: string[];
  /**
   * Empresa que el superadmin esta mirando. Para el resto siempre es null.
   * Cuando esta seteada, companyId apunta a esa empresa.
   */
  actingCompanyId: number | null;
  /**
   * Locales que el usuario puede operar. Para un owner se resuelve en cada
   * server function contra su empresa; aca viaja lo que tiene asignado en
   * user_locations (lo que le importa al encargado).
   */
  locationIds: number[];
  /**
   * Qué puede hacer en cada sección del panel. Vacío para el dueño y el
   * superadmin, que pueden todo sin necesidad de filas.
   */
  permissions: PermissionMap;
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return token;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(COOKIE_NAME);
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      companyId: users.companyId,
      locationId: users.locationId,
      active: users.active,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }
  // Un usuario dado de baja pierde la sesion al instante. Solo damos de baja
  // ante un false/0 explicito: si el driver devolviera algo raro, preferimos
  // dejar pasar al usuario antes que borrarle la sesion por las dudas.
  const isActive = row.active === null || row.active === undefined ? true : Boolean(row.active);
  if (!isActive) {
    await db.delete(sessions).where(eq(sessions.userId, row.userId));
    return null;
  }

  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, row.userId));

  const assigned = await db
    .select({ locationId: userLocations.locationId })
    .from(userLocations)
    .where(eq(userLocations.userId, row.userId));

  const perms = await db
    .select({ section: userPermissions.section, level: userPermissions.level })
    .from(userPermissions)
    .where(eq(userPermissions.userId, row.userId));
  const permissions: PermissionMap = {};
  for (const p of perms) permissions[p.section] = p.level;

  const roleNames = roles.map((r) => r.role);

  // El superadmin ve todo: si entro a una empresa, trabaja con ese companyId y
  // el resto del sistema no se entera de la diferencia.
  let actingCompanyId: number | null = null;
  if (roleNames.includes("superadmin")) {
    const raw = getCookie(ACTING_COOKIE);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isInteger(parsed) && parsed > 0) actingCompanyId = parsed;
  }

  return {
    id: row.userId,
    email: row.email,
    companyId: actingCompanyId ?? row.companyId,
    locationId: row.locationId,
    roles: roleNames,
    actingCompanyId,
    locationIds: assigned.map((a) => a.locationId),
    permissions,
  };
}

/** El superadmin entra a una empresa (soporte). Solo se llama desde server fns con requireSuperadmin. */
export function setActingCompany(companyId: number): void {
  setCookie(ACTING_COOKIE, String(companyId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearActingCompany(): void {
  deleteCookie(ACTING_COOKIE, { path: "/" });
}

export async function destroySession(): Promise<void> {
  clearActingCompany();
  const token = getCookie(COOKIE_NAME);
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
  }
  deleteCookie(COOKIE_NAME, { path: "/" });
}

export function newId(): string {
  return randomUUID();
}

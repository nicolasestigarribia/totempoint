import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema";
import type { SessionUser } from "./session";

/** El usuario pertenece a una empresa (owner o encargado) y devuelve su id. */
export function companyIdOf(user: SessionUser): number {
  if (!user.companyId) throw new Error("Usuario sin empresa asignada");
  return user.companyId;
}

export function isOwner(user: SessionUser): boolean {
  return user.roles.includes("owner");
}

/**
 * Locales que el usuario puede ver/operar.
 * - owner: todos los locales de su empresa.
 * - encargado: solo los que le asignaron en user_locations (y que sigan siendo
 *   de su empresa, por si lo movieron de empresa).
 */
export async function accessibleLocationIds(user: SessionUser): Promise<number[]> {
  const companyId = companyIdOf(user);

  if (isOwner(user)) {
    const rows = await db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.companyId, companyId));
    return rows.map((r) => r.id);
  }

  if (user.locationIds.length === 0) return [];

  const rows = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.companyId, companyId), inArray(locations.id, user.locationIds)));
  return rows.map((r) => r.id);
}

/**
 * Corta la ejecución si el usuario no tiene acceso a ese local. Usar en toda
 * server function que reciba un locationId del cliente.
 */
export async function assertLocationAccess(user: SessionUser, locationId: number): Promise<void> {
  const allowed = await accessibleLocationIds(user);
  if (!allowed.includes(locationId)) {
    throw new Error("No tenés acceso a ese local");
  }
}

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

/**
 * Freno para el login: sin esto se pueden probar contraseñas de a miles contra
 * un usuario conocido. Se cuenta por identificador (usuario o email), no por
 * IP, porque la IP no es confiable detrás del proxy de Railway.
 *
 * El costo de esto es que alguien puede dejar bloqueado a un usuario ajeno un
 * rato tirando fallos a propósito, por eso el bloqueo es corto.
 */
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

export interface LockState {
  locked: boolean;
  minutesLeft: number;
}

export async function checkLock(identifier: string): Promise<LockState> {
  const [row] = await db
    .select({ lockedUntil: loginAttempts.lockedUntil })
    .from(loginAttempts)
    .where(eq(loginAttempts.identifier, identifier))
    .limit(1);

  if (!row?.lockedUntil) return { locked: false, minutesLeft: 0 };

  const msLeft = row.lockedUntil.getTime() - Date.now();
  if (msLeft <= 0) return { locked: false, minutesLeft: 0 };

  return { locked: true, minutesLeft: Math.max(1, Math.ceil(msLeft / 60000)) };
}

/** Suma un fallo y bloquea el identificador si ya son demasiados. */
export async function registerFailure(identifier: string): Promise<void> {
  const [row] = await db
    .select({ failedCount: loginAttempts.failedCount })
    .from(loginAttempts)
    .where(eq(loginAttempts.identifier, identifier))
    .limit(1);

  const failedCount = (row?.failedCount ?? 0) + 1;
  const lockedUntil =
    failedCount >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null;

  await db
    .insert(loginAttempts)
    .values({ identifier, failedCount, lockedUntil })
    .onDuplicateKeyUpdate({
      set: {
        failedCount: lockedUntil ? 0 : sql`${loginAttempts.failedCount} + 1`,
        lockedUntil,
      },
    });
}

/** Un login correcto limpia la cuenta de fallos. */
export async function clearFailures(identifier: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.identifier, identifier));
}

export const LOCK_MESSAGE = (minutes: number) =>
  `Demasiados intentos fallidos. Probá de nuevo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`;

/**
 * Endurece el acceso:
 *  1. sessions.last_seen_at, para cerrar por inactividad las sesiones que
 *     quedaron abiertas (la tablet del mostrador, sobre todo).
 *  2. login_attempts, para frenar a quien prueba contraseñas en serie.
 *
 * Correr con:  bun run src/db/migrate-login-hardening.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = (await db.execute(
    sql`SELECT COUNT(*) AS n FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ${table} AND column_name = ${column}`,
  )) as unknown as [Array<{ n: number }>];
  return Number(rows[0]?.n ?? 0) > 0;
}

async function main() {
  console.log("1/2 · sessions.last_seen_at");
  if (await columnExists("sessions", "last_seen_at")) {
    console.log("     ya existía, se saltea");
  } else {
    await db.execute(
      sql`ALTER TABLE sessions ADD COLUMN last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    // Las sesiones que ya estaban abiertas arrancan contando desde ahora.
    await db.execute(sql`UPDATE sessions SET last_seen_at = NOW()`);
    console.log("     agregada");
  }

  console.log("2/2 · tabla login_attempts");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS login_attempts (
      identifier VARCHAR(255) PRIMARY KEY,
      failed_count INT NOT NULL DEFAULT 0,
      locked_until TIMESTAMP NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("     lista");

  console.log("\nMigración terminada.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

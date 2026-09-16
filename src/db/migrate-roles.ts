/**
 * Migración del modelo de roles a las reglas de negocio del tótem:
 * superadmin (desarrollo) / owner (dueño de la empresa) / encargado (uno o más locales).
 *
 * Qué hace, en orden y de forma idempotente:
 *  1. Agrega users.active (baja lógica de operadores).
 *  2. Crea user_locations (locales asignados a un usuario, 1 a N).
 *  3. Amplía el enum de user_roles para que convivan admin + owner + encargado.
 *  4. Renombra los roles admin existentes a owner.
 *  5. Deja el enum final sin admin.
 *  6. Copia users.location_id a user_locations para no perder las asignaciones viejas.
 *
 * Correr con:  bun run src/db/migrate-roles.ts
 * Apunta a la DATABASE_URL de .env.local, que es la base compartida de Railway.
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
  console.log("1/6 · users.active");
  if (await columnExists("users", "active")) {
    console.log("     ya existía, se saltea");
  } else {
    await db.execute(sql`ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE`);
    console.log("     agregada");
  }

  console.log("2/6 · tabla user_locations");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      location_id INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY user_locations_user_location_uq (user_id, location_id),
      KEY user_locations_location_idx (location_id)
    )
  `);
  console.log("     lista");

  console.log("3/6 · enum de user_roles (transitorio, con admin y owner)");
  await db.execute(sql`
    ALTER TABLE user_roles
    MODIFY COLUMN role ENUM('superadmin','admin','owner','encargado','kitchen') NOT NULL
  `);

  console.log("4/6 · admin → owner");
  const [res] = (await db.execute(
    sql`UPDATE user_roles SET role = 'owner' WHERE role = 'admin'`,
  )) as unknown as [{ affectedRows: number }];
  console.log(`     ${res?.affectedRows ?? 0} usuario(s) pasaron a owner`);

  console.log("5/6 · enum final sin admin");
  await db.execute(sql`
    ALTER TABLE user_roles
    MODIFY COLUMN role ENUM('superadmin','owner','encargado','kitchen') NOT NULL
  `);

  console.log("6/6 · backfill de user_locations desde users.location_id");
  const [back] = (await db.execute(sql`
    INSERT IGNORE INTO user_locations (user_id, location_id)
    SELECT u.id, u.location_id
    FROM users u
    JOIN locations l ON l.id = u.location_id
    WHERE u.location_id IS NOT NULL
  `)) as unknown as [{ affectedRows: number }];
  console.log(`     ${back?.affectedRows ?? 0} asignación(es) copiadas`);

  console.log("\nMigración terminada.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

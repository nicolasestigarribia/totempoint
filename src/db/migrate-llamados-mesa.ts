/**
 * Crea `table_calls`: "llamar al mozo" y "pedir la cuenta" desde el celular de
 * la mesa. La comandera los muestra hasta que alguien los marca atendidos.
 *
 * Aditivo e idempotente. Correrlo en producción ANTES de desplegar.
 *
 * Correr con:  bun run src/db/migrate-llamados-mesa.ts
 * (y en producción: bun --env-file=.env.produccion.local run src/db/migrate-llamados-mesa.ts)
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS table_calls (
      id INT AUTO_INCREMENT PRIMARY KEY,
      location_id INT NOT NULL,
      table_id INT NOT NULL,
      table_number INT NOT NULL,
      tipo ENUM('mozo', 'cuenta') NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      attended_at TIMESTAMP NULL,
      INDEX table_calls_location_idx (location_id, attended_at),
      INDEX table_calls_table_idx (table_id)
    )
  `);
  console.log("table_calls lista.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

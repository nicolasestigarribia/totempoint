/**
 * Crea la tabla `logs`: errores y excepciones del sistema, diferenciados por
 * empresa/sucursal cuando se conocen. La escribe `registrarError`.
 *
 * Es aditivo e idempotente: si la tabla ya existe, no hace nada.
 *
 * Correr con:  bun run src/db/migrate-logs.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [existe] = await db.execute(sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'logs'
  `);
  if ((existe as unknown as unknown[]).length > 0) {
    console.log("Tabla logs ya existe, no hay nada que hacer.");
    process.exit(0);
  }

  await db.execute(sql`
    CREATE TABLE logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      context VARCHAR(120) NOT NULL,
      message TEXT NOT NULL,
      stack TEXT NULL,
      company_id INT NULL,
      location_id INT NULL,
      user_id INT NULL,
      user_email VARCHAR(255) NULL,
      extra TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX logs_created_idx (created_at),
      INDEX logs_company_idx (company_id)
    )
  `);
  console.log("Creada tabla logs.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

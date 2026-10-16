/**
 * `mesa_settings.cash_enabled`: si en la mesa se puede elegir pagar en
 * efectivo. Arranca prendido para todas, así nada cambia al migrar.
 *
 * Correr después de `migrate-mesas.ts`. Idempotente.
 *
 * Correr con:  bun run src/db/migrate-mesa-efectivo.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [filas] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'mesa_settings' AND column_name = 'cash_enabled'
  `);
  if ((filas as unknown as unknown[]).length === 0) {
    await db.execute(sql`
      ALTER TABLE mesa_settings ADD COLUMN cash_enabled BOOLEAN NOT NULL DEFAULT TRUE
    `);
    console.log("Agregada mesa_settings.cash_enabled.");
  }
  console.log("Listo.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

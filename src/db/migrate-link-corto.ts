/**
 * Agrega el link corto del pedido online: `online_settings.alias`, para que el
 * link de una sucursal sea /{alias} (por ejemplo /primorosas) en vez de
 * /p/{empresa}/{sucursal}. Único en toda la plataforma.
 *
 * Es aditivo e idempotente: si la columna ya existe, no hace nada.
 *
 * Correr con:  bun run src/db/migrate-link-corto.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [existe] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'online_settings' AND column_name = 'alias'
  `);
  if ((existe as unknown as unknown[]).length > 0) {
    console.log("online_settings.alias ya existe, no hay nada que hacer.");
    process.exit(0);
  }

  await db.execute(
    sql`ALTER TABLE online_settings ADD COLUMN alias VARCHAR(40) NULL AFTER origin_lng`,
  );
  await db.execute(
    sql`ALTER TABLE online_settings ADD UNIQUE KEY online_settings_alias_uq (alias)`,
  );
  console.log("Agregada online_settings.alias (link corto del pedido online).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

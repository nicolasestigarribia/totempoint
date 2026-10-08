/**
 * Agrega `companies.online_alias`: el link corto de la empresa entera para el
 * pedido online (/{alias} → elegir sucursal según la dirección). Único.
 *
 * Es aditivo e idempotente.
 *
 * Correr con:  bun run src/db/migrate-alias-empresa.ts
 * (y en producción: bun --env-file=.env.produccion.local run src/db/migrate-alias-empresa.ts)
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [existe] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'companies' AND column_name = 'online_alias'
  `);
  if ((existe as unknown as unknown[]).length > 0) {
    console.log("companies.online_alias ya existe, no hay nada que hacer.");
    process.exit(0);
  }
  await db.execute(sql`ALTER TABLE companies ADD COLUMN online_alias VARCHAR(40) NULL`);
  await db.execute(
    sql`ALTER TABLE companies ADD UNIQUE KEY companies_online_alias_uq (online_alias)`,
  );
  console.log("Agregada companies.online_alias.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

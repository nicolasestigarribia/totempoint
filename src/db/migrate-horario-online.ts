/**
 * Agrega `online_settings.horarios`: los turnos en que cada sucursal toma
 * pedidos online. Null = siempre que el canal esté encendido, como hasta ahora,
 * así que no cambia nada hasta que el dueño cargue un horario.
 *
 * Es aditivo e idempotente.
 *
 * Correr con:  bun run src/db/migrate-horario-online.ts
 * (y en producción: bun --env-file=.env.produccion.local run src/db/migrate-horario-online.ts)
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [existe] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'online_settings' AND column_name = 'horarios'
  `);
  if ((existe as unknown as unknown[]).length > 0) {
    console.log("online_settings.horarios ya existe, no hay nada que hacer.");
    process.exit(0);
  }
  await db.execute(sql`ALTER TABLE online_settings ADD COLUMN horarios JSON NULL AFTER alias`);
  console.log("Agregada online_settings.horarios.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

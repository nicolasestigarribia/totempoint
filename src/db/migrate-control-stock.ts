/**
 * Agrega `artistock.control_desde`: desde cuándo se controla el stock de ese
 * ítem en esa sucursal. Con fecha, lo que se agota deja de venderse; sin fecha
 * (nadie cargó nunca stock de eso acá), se vende como hasta ahora.
 *
 * Las filas que ya tienen ingresos cargados quedan controladas desde su última
 * actualización: alguien contó ese stock, así que se respeta. Las que solo
 * tienen ventas (el stock nunca se cargó) quedan sin controlar.
 *
 * Es aditivo e idempotente: si la columna ya existe, no hace nada.
 *
 * Correr con:  bun run src/db/migrate-control-stock.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [existe] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'artistock' AND column_name = 'control_desde'
  `);
  if ((existe as unknown as unknown[]).length > 0) {
    console.log("artistock.control_desde ya existe, no hay nada que hacer.");
    process.exit(0);
  }

  await db.execute(sql`ALTER TABLE artistock ADD COLUMN control_desde TIMESTAMP NULL`);
  const [res] = await db.execute(
    sql`UPDATE artistock SET control_desde = updated_at WHERE ip_local > 0`,
  );
  const n = (res as unknown as { affectedRows: number }).affectedRows;
  console.log(
    `Agregada artistock.control_desde. ${n} fila(s) con stock cargado quedan controladas.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

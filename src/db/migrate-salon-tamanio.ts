/**
 * El tamaño del salón y de cada mesa, elegidos por el dueño en el editor.
 *
 * - `dining_tables.w` y `h`: las celdas que ocupa la mesa. Hasta ahora salían
 *   de la forma y los lugares; las mesas que ya existen se quedan con ese mismo
 *   tamaño, así que el plano no cambia al migrar.
 * - `dining_rooms`: columnas y filas del salón de cada sucursal. Sin fila, el
 *   salón mide lo de siempre (24 × 16).
 *
 * Correr después de `migrate-mesas.ts`. Idempotente.
 *
 * Correr con:  bun run src/db/migrate-salon-tamanio.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function hay(q: ReturnType<typeof sql>): Promise<boolean> {
  const [filas] = await db.execute(q);
  return (filas as unknown as unknown[]).length > 0;
}

async function main() {
  const hayW = await hay(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'dining_tables' AND column_name = 'w'
  `);
  if (!hayW) {
    await db.execute(sql`
      ALTER TABLE dining_tables
        ADD COLUMN w INT NOT NULL DEFAULT 2 AFTER y,
        ADD COLUMN h INT NOT NULL DEFAULT 2 AFTER w
    `);
    // El mismo tamaño que calculaba `tamanio()` antes de esta migración.
    await db.execute(sql`
      UPDATE dining_tables SET
        w = CASE
          WHEN shape = 'rectangular' THEN GREATEST(2, CEIL(seats / 2))
          WHEN seats <= 2 THEN 1
          WHEN seats <= 4 THEN 2
          ELSE 3 END,
        h = CASE
          WHEN shape = 'rectangular' THEN 2
          WHEN seats <= 2 THEN 1
          WHEN seats <= 4 THEN 2
          ELSE 3 END
    `);
    console.log("Agregadas dining_tables.w y h, con el tamaño que tenía cada mesa.");
  }

  const hayRooms = await hay(sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'dining_rooms'
  `);
  if (!hayRooms) {
    await db.execute(sql`
      CREATE TABLE dining_rooms (
        location_id INT PRIMARY KEY,
        grid_columns INT NOT NULL,
        grid_rows INT NOT NULL
      )
    `);
    console.log("Creada dining_rooms.");
  }

  console.log("Listo.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

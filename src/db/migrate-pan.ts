/**
 * Agrega el pan de los sándwiches: `products.pan` (blanco, negro o ambos —el
 * cliente elige—, null si no aplica) y `order_items.pan` (el pan con que se
 * hace esa línea, congelado como el nombre).
 *
 * Es aditivo e idempotente: lo que ya existe no se toca.
 *
 * Correr con:  bun run src/db/migrate-pan.ts
 * (y en producción: bun --env-file=.env.produccion.local run src/db/migrate-pan.ts)
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function existe(tabla: string, columna: string) {
  const [r] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = ${tabla} AND column_name = ${columna}
  `);
  return (r as unknown as unknown[]).length > 0;
}

async function main() {
  if (await existe("products", "pan")) {
    console.log("products.pan ya existe.");
  } else {
    await db.execute(
      sql`ALTER TABLE products ADD COLUMN pan ENUM('blanco','negro','ambos') NULL AFTER customizable`,
    );
    console.log("Agregada products.pan.");
  }
  if (await existe("order_items", "pan")) {
    console.log("order_items.pan ya existe.");
  } else {
    await db.execute(sql`ALTER TABLE order_items ADD COLUMN pan ENUM('blanco','negro') NULL`);
    console.log("Agregada order_items.pan.");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Agrega los tamaños: `products.tamanios` (JSON con nombre y precio de cada
 * uno: "Grande" $29.000, "Chica" $26.500) y `order_items.tamanio` (el que eligió
 * el cliente, congelado como el nombre).
 *
 * Es aditivo e idempotente: lo que ya existe no se toca.
 *
 * Correr con:  bun run src/db/migrate-tamanios.ts
 * (y en producción: bun --env-file=.env.produccion.local run src/db/migrate-tamanios.ts)
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
  if (await existe("products", "tamanios")) {
    console.log("products.tamanios ya existe.");
  } else {
    await db.execute(sql`ALTER TABLE products ADD COLUMN tamanios JSON NULL AFTER pan`);
    console.log("Agregada products.tamanios.");
  }
  if (await existe("order_items", "tamanio")) {
    console.log("order_items.tamanio ya existe.");
  } else {
    await db.execute(sql`ALTER TABLE order_items ADD COLUMN tamanio VARCHAR(40) NULL AFTER pan`);
    console.log("Agregada order_items.tamanio.");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

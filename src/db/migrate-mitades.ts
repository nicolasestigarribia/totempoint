/**
 * Pizza mitad y mitad:
 * - `categories.mitades`: en esta categoría se puede pedir un producto con la
 *   otra mitad de otro gusto de la misma categoría.
 * - `order_items.mitad_product_id`: el producto de la otra mitad (el nombre de
 *   la línea ya queda congelado como "½ Muzzarella + ½ Napolitana").
 *
 * Aditivo e idempotente. Correrlo en producción ANTES de desplegar: el código
 * nuevo lee y escribe las dos columnas.
 *
 * Correr con:  bun run src/db/migrate-mitades.ts
 * (y en producción: bun --env-file=.env.produccion.local run src/db/migrate-mitades.ts)
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function existe(tabla: string, columna: string): Promise<boolean> {
  const [r] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = ${tabla} AND column_name = ${columna}
  `);
  return (r as unknown as unknown[]).length > 0;
}

async function main() {
  if (await existe("categories", "mitades")) {
    console.log("categories.mitades ya existe.");
  } else {
    await db.execute(
      sql`ALTER TABLE categories ADD COLUMN mitades BOOLEAN NOT NULL DEFAULT FALSE AFTER regalo_cantidad`,
    );
    console.log("Agregada categories.mitades.");
  }
  if (await existe("order_items", "mitad_product_id")) {
    console.log("order_items.mitad_product_id ya existe.");
  } else {
    await db.execute(
      sql`ALTER TABLE order_items ADD COLUMN mitad_product_id INT NULL AFTER tamanio`,
    );
    console.log("Agregada order_items.mitad_product_id.");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

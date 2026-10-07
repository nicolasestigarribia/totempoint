/**
 * "Cada 12, 2 de regalo" y bajadas largas en las categorías:
 * - `categories.tagline` pasa de 60 a 255 caracteres;
 * - `categories.regalo_cada` / `regalo_cantidad`: la regla del regalo;
 * - `orders.regalo_unidades`: las de regalo que el cliente no agregó (las pone el local);
 * - `orders.regalo_descuento`: lo que se descontó por las que sí agregó.
 *
 * Es aditivo e idempotente.
 *
 * Correr con:  bun run src/db/migrate-regalo.ts
 * (y en producción: bun --env-file=.env.produccion.local run src/db/migrate-regalo.ts)
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function columna(tabla: string, nombre: string) {
  const [r] = await db.execute(sql`
    SELECT character_maximum_length largo FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = ${tabla} AND column_name = ${nombre}
  `);
  return (r as unknown as { largo: number | null }[])[0] ?? null;
}

async function main() {
  const tagline = await columna("categories", "tagline");
  if (tagline && Number(tagline.largo) < 255) {
    await db.execute(sql`ALTER TABLE categories MODIFY tagline VARCHAR(255) NULL`);
    console.log("categories.tagline ahora admite 255 caracteres.");
  }
  if (!(await columna("categories", "regalo_cada"))) {
    await db.execute(
      sql`ALTER TABLE categories ADD COLUMN regalo_cada INT NULL, ADD COLUMN regalo_cantidad INT NULL`,
    );
    console.log("Agregadas categories.regalo_cada y regalo_cantidad.");
  }
  if (!(await columna("orders", "regalo_unidades"))) {
    await db.execute(sql`ALTER TABLE orders ADD COLUMN regalo_unidades INT NOT NULL DEFAULT 0`);
    console.log("Agregada orders.regalo_unidades.");
  }
  if (!(await columna("orders", "regalo_descuento"))) {
    await db.execute(
      sql`ALTER TABLE orders ADD COLUMN regalo_descuento DECIMAL(10,2) NOT NULL DEFAULT 0`,
    );
    console.log("Agregada orders.regalo_descuento.");
  }
  console.log("Listo.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

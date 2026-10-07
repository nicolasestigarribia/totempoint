/**
 * Combos a elección: `combos.grupos` (lo que el cliente elige: "18 empanadas
 * clásicas") y `order_item_elecciones` (los gustos que eligió en cada pedido).
 *
 * Es aditivo e idempotente: los combos existentes quedan como estaban.
 *
 * Correr con:  bun run src/db/migrate-combos-a-eleccion.ts
 * (y en producción: bun --env-file=.env.produccion.local run src/db/migrate-combos-a-eleccion.ts)
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function existe(consulta: ReturnType<typeof sql>) {
  const [r] = await db.execute(consulta);
  return (r as unknown as unknown[]).length > 0;
}

async function main() {
  if (
    !(await existe(sql`SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'combos' AND column_name = 'grupos'`))
  ) {
    await db.execute(sql`ALTER TABLE combos ADD COLUMN grupos JSON NULL AFTER sort`);
    console.log("Agregada combos.grupos.");
  }
  if (
    !(await existe(sql`SELECT 1 FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'order_item_elecciones'`))
  ) {
    await db.execute(sql`
      CREATE TABLE order_item_elecciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_item_id INT NOT NULL,
        grupo VARCHAR(120) NOT NULL,
        product_id INT NULL,
        product_name VARCHAR(120) NOT NULL,
        quantity INT NOT NULL,
        INDEX order_item_elecciones_item_idx (order_item_id)
      )`);
    console.log("Creada order_item_elecciones.");
  }
  console.log("Listo.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

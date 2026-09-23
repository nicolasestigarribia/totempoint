/**
 * Personalización por producto: el "sin cebolla" del tótem.
 *
 * Agrega tres cosas y ninguna cambia lo que ya está cargado:
 *   - `products.customizable`: si el cliente puede sacarle ingredientes. Nace
 *     apagado, así que ningún producto se vuelve configurable solo.
 *   - `product_ingredients.removable`: qué ingrediente se puede sacar. También
 *     nace apagado: la carne de una hamburguesa no se saca.
 *   - `order_item_removals`: qué sacó el cliente en cada línea del pedido.
 *
 * Va como script propio y no con `drizzle-kit push` por lo mismo que
 * `migrate-location-combos.ts`: push compara el schema entero contra la base y
 * propone tocar tablas que este cambio no pidió. Acá se agregan dos columnas
 * con default y se crea una tabla nueva, así que es seguro sobre datos reales.
 *
 * Es idempotente: lo que ya existe se saltea.
 *
 * Correr con:  bun run src/db/migrate-personalizacion.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

/** `execute` tipa el resultado como header de INSERT; un SHOW devuelve filas. */
async function filas(consulta: ReturnType<typeof sql>): Promise<unknown[]> {
  const [r] = await db.execute(consulta);
  return r as unknown as unknown[];
}

async function main() {
  const hechos: string[] = [];

  if ((await filas(sql`SHOW COLUMNS FROM products LIKE 'customizable'`)).length === 0) {
    await db.execute(
      sql`ALTER TABLE products ADD COLUMN customizable BOOLEAN NOT NULL DEFAULT FALSE AFTER stockable`,
    );
    hechos.push("products.customizable");
  }

  if ((await filas(sql`SHOW COLUMNS FROM product_ingredients LIKE 'removable'`)).length === 0) {
    await db.execute(
      sql`ALTER TABLE product_ingredients ADD COLUMN removable BOOLEAN NOT NULL DEFAULT FALSE`,
    );
    hechos.push("product_ingredients.removable");
  }

  if ((await filas(sql`SHOW TABLES LIKE 'order_item_removals'`)).length === 0) {
    await db.execute(sql`
      CREATE TABLE order_item_removals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_item_id INT NOT NULL,
        ingredient_id INT NOT NULL,
        ingredient_name VARCHAR(120) NOT NULL,
        UNIQUE KEY order_item_removals_uq (order_item_id, ingredient_id),
        KEY order_item_removals_item_idx (order_item_id)
      )
    `);
    hechos.push("order_item_removals");
  }

  // La venta automática necesita saber de qué pedido salió, para poder
  // devolver exactamente eso si el pedido se cancela.
  if ((await filas(sql`SHOW COLUMNS FROM movements LIKE 'order_id'`)).length === 0) {
    await db.execute(sql`ALTER TABLE movements ADD COLUMN order_id INT NULL AFTER location_id`);
    await db.execute(sql`CREATE INDEX movements_order_idx ON movements (order_id)`);
    hechos.push("movements.order_id");
  }

  if (hechos.length === 0) {
    console.log("Ya estaba todo, no hubo nada que hacer.");
  } else {
    console.log(`Listo: ${hechos.join(", ")}.`);
    console.log("Todo nace apagado: ningún producto se vuelve configurable por sí solo.");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

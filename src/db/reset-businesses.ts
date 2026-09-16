/**
 * Deja la plataforma en cero: borra todas las empresas y todo lo que cuelga de
 * ellas (locales, catálogo, stock, movimientos, pedidos, portadas e imágenes).
 *
 * NO toca:
 *  - el superadmin ni ningún usuario (eso lo hace reset-users.ts),
 *  - las filas globales del sistema (ingredientes, categorías de ingredientes y
 *    códigos de acción con company_id NULL), que administra el superadmin.
 *
 * Correr con:  bun run src/db/reset-businesses.ts
 * Apunta a la DATABASE_URL de .env.local, que es la base compartida de Railway.
 * Es destructivo y no se puede deshacer.
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

// De las hojas hacia la raíz, para no dejar filas huérfanas por el camino.
const steps: Array<[string, ReturnType<typeof sql>]> = [
  ["order_items", sql`DELETE FROM order_items`],
  ["orders", sql`DELETE FROM orders`],
  ["movements", sql`DELETE FROM movements`],
  ["artistock", sql`DELETE FROM artistock`],
  ["stock_limits", sql`DELETE FROM stock_limits`],
  ["combo_products", sql`DELETE FROM combo_products`],
  ["combos", sql`DELETE FROM combos`],
  ["product_ingredients", sql`DELETE FROM product_ingredients`],
  ["location_products", sql`DELETE FROM location_products`],
  ["location_categories", sql`DELETE FROM location_categories`],
  ["products", sql`DELETE FROM products`],
  ["categories", sql`DELETE FROM categories`],
  ["ingredients (de empresa)", sql`DELETE FROM ingredients WHERE company_id IS NOT NULL`],
  [
    "ingredient_categories (de empresa)",
    sql`DELETE FROM ingredient_categories WHERE company_id IS NOT NULL`,
  ],
  ["action_codes (de empresa)", sql`DELETE FROM action_codes WHERE company_id IS NOT NULL`],
  ["totem_settings", sql`DELETE FROM totem_settings`],
  ["images", sql`DELETE FROM images`],
  ["locations", sql`DELETE FROM locations`],
  ["companies", sql`DELETE FROM companies`],
];

async function main() {
  for (const [label, statement] of steps) {
    const [res] = (await db.execute(statement)) as unknown as [{ affectedRows: number }];
    console.log(`${label}: ${res?.affectedRows ?? 0} fila(s) borradas`);
  }

  const [rows] = (await db.execute(
    sql`SELECT
          (SELECT COUNT(*) FROM companies) AS empresas,
          (SELECT COUNT(*) FROM locations) AS locales,
          (SELECT COUNT(*) FROM products) AS productos,
          (SELECT COUNT(*) FROM users) AS usuarios`,
  )) as unknown as [Array<Record<string, unknown>>];
  console.log("\nQuedó:", rows[0]);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

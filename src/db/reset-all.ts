/**
 * Deja la base completamente vacía salvo el superadmin.
 *
 * Borra todo: empresas, locales, catálogo, stock, movimientos, pedidos,
 * portadas, imágenes, y también las filas globales del sistema (ingredientes,
 * categorías de ingredientes y códigos de acción con company_id NULL).
 * Lo único que sobrevive es el usuario superadmin con su rol y su sesión.
 *
 * Correr con:  bun run src/db/reset-all.ts
 * Apunta a la DATABASE_URL de .env.local, que es la base compartida de Railway.
 * Es destructivo y no se puede deshacer.
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [supers] = (await db.execute(
    sql`SELECT u.id, u.email, u.username
        FROM users u
        JOIN user_roles r ON r.user_id = u.id AND r.role = 'superadmin'`,
  )) as unknown as [Array<{ id: number; email: string; username: string | null }>];

  if (supers.length === 0) {
    throw new Error("No hay ningún superadmin en la base: no borro nada.");
  }
  const keepIds = supers.map((s) => s.id);
  console.log("Se conservan estos superadmins:", supers);

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
    ["ingredients", sql`DELETE FROM ingredients`],
    ["ingredient_categories", sql`DELETE FROM ingredient_categories`],
    ["action_codes", sql`DELETE FROM action_codes`],
    ["totem_settings", sql`DELETE FROM totem_settings`],
    ["images", sql`DELETE FROM images`],
    ["locations", sql`DELETE FROM locations`],
    ["companies", sql`DELETE FROM companies`],
    ["user_locations", sql`DELETE FROM user_locations`],
    ["user_roles (no superadmin)", sql`DELETE FROM user_roles WHERE role <> 'superadmin'`],
    ["sessions (de otros usuarios)", sql`DELETE FROM sessions WHERE user_id NOT IN ${keepIds}`],
    ["users (menos el superadmin)", sql`DELETE FROM users WHERE id NOT IN ${keepIds}`],
  ];

  for (const [label, statement] of steps) {
    const [res] = (await db.execute(statement)) as unknown as [{ affectedRows: number }];
    console.log(`${label}: ${res?.affectedRows ?? 0} fila(s) borradas`);
  }

  const [rows] = (await db.execute(
    sql`SELECT
          (SELECT COUNT(*) FROM companies) AS empresas,
          (SELECT COUNT(*) FROM locations) AS locales,
          (SELECT COUNT(*) FROM products) AS productos,
          (SELECT COUNT(*) FROM categories) AS categorias,
          (SELECT COUNT(*) FROM ingredients) AS ingredientes,
          (SELECT COUNT(*) FROM action_codes) AS codigos,
          (SELECT COUNT(*) FROM images) AS imagenes,
          (SELECT COUNT(*) FROM orders) AS pedidos,
          (SELECT COUNT(*) FROM users) AS usuarios`,
  )) as unknown as [Array<Record<string, unknown>>];
  console.log("\nQuedó:", rows[0]);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

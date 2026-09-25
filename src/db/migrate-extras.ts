/**
 * Extras por ingrediente: pedir de más ("+carne", "+queso").
 *
 * Espeja el "se puede sacar" pero con precio y tope, y sumando stock en vez de
 * restarlo. Agrega a `product_ingredients` las columnas de extra y crea
 * `order_item_extras`, el detalle congelado de lo que se agregó a cada línea.
 *
 * Va como script propio y no con `drizzle-kit push` a propósito: push compara el
 * schema entero y podría proponer tocar tablas que este cambio no pidió.
 *
 * Es idempotente: tolera "ya existe" en cada paso.
 *
 * Correr con:  bun run src/db/migrate-extras.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

// Tolera columnas/índices ya aplicados: 1060 = columna duplicada, 1061 = índice
// duplicado, 1050 = tabla ya existe.
async function ddl(query: string, okErrnos: number[] = []) {
  try {
    await db.execute(sql.raw(query));
    console.log("  ok:", query.slice(0, 70).replace(/\s+/g, " "));
  } catch (e) {
    const errno = (e as { errno?: number }).errno;
    if (errno && okErrnos.includes(errno)) {
      console.log("  skip (ya aplicado):", query.slice(0, 60).replace(/\s+/g, " "));
    } else {
      throw e;
    }
  }
}

async function main() {
  console.log("== product_ingredients: columnas de extra ==");
  await ddl(
    "ALTER TABLE `product_ingredients` ADD COLUMN `extra_allowed` boolean NOT NULL DEFAULT false",
    [1060],
  );
  await ddl(
    "ALTER TABLE `product_ingredients` ADD COLUMN `extra_price` decimal(10,2) NULL",
    [1060],
  );
  await ddl("ALTER TABLE `product_ingredients` ADD COLUMN `extra_max` int NULL", [1060]);

  console.log("== order_item_extras ==");
  await ddl(
    `CREATE TABLE \`order_item_extras\` (
      \`id\` int AUTO_INCREMENT PRIMARY KEY,
      \`order_item_id\` int NOT NULL,
      \`ingredient_id\` int NOT NULL,
      \`ingredient_name\` varchar(120) NOT NULL,
      \`quantity\` int NOT NULL,
      \`unit_price\` decimal(10,2) NOT NULL,
      UNIQUE KEY \`order_item_extras_uq\` (\`order_item_id\`,\`ingredient_id\`),
      KEY \`order_item_extras_item_idx\` (\`order_item_id\`)
    )`,
    [1050],
  );

  console.log("Extras listos.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

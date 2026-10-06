/**
 * Agrega `orders.delivery_approx`: el punto del envío es solo la calle, porque
 * el mapa no tenía la altura (OpenStreetMap no tiene la numeración de Cariló).
 * Con eso la comandera navega por la dirección escrita y no por el punto.
 *
 * Es aditivo e idempotente: si la columna ya existe, no hace nada.
 *
 * Correr con:  bun run src/db/migrate-direccion-aproximada.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [existe] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_approx'
  `);
  if ((existe as unknown as unknown[]).length > 0) {
    console.log("orders.delivery_approx ya existe, no hay nada que hacer.");
    process.exit(0);
  }

  await db.execute(
    sql`ALTER TABLE orders ADD COLUMN delivery_approx BOOLEAN NOT NULL DEFAULT FALSE AFTER delivery_lng`,
  );
  console.log("Agregada orders.delivery_approx.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

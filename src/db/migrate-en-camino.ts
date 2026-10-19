/**
 * Agrega `orders.dispatched_at`: cuándo salió el repartidor con un pedido de
 * envío, para que el seguimiento del cliente diga "En camino".
 *
 * Es aditivo e idempotente. Correrlo en producción ANTES de desplegar: el
 * código nuevo lee la columna en cada pedido.
 *
 * Correr con:  bun run src/db/migrate-en-camino.ts
 * (y en producción: bun --env-file=.env.produccion.local run src/db/migrate-en-camino.ts)
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [r] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'dispatched_at'
  `);
  if ((r as unknown as unknown[]).length > 0) {
    console.log("orders.dispatched_at ya existe.");
  } else {
    await db.execute(
      sql`ALTER TABLE orders ADD COLUMN dispatched_at TIMESTAMP NULL AFTER eta_minutes`,
    );
    console.log("Agregada orders.dispatched_at.");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

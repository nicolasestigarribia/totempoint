/**
 * Agrega `orders.clave` y su índice único por sucursal: la clave que manda el
 * carrito con cada intento de pedido. Si el pedido llegó pero la respuesta se
 * perdió (señal mala) y el cliente vuelve a tocar "Enviar", el servidor
 * reconoce la clave y devuelve el pedido que ya tomó en vez de duplicarlo.
 *
 * Aditivo e idempotente. Correrlo en producción ANTES de desplegar: el código
 * nuevo escribe la columna en cada pedido.
 *
 * Correr con:  bun run src/db/migrate-clave-pedido.ts
 * (y en producción: bun --env-file=.env.produccion.local run src/db/migrate-clave-pedido.ts)
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [col] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'clave'
  `);
  if ((col as unknown as unknown[]).length > 0) {
    console.log("orders.clave ya existe.");
  } else {
    await db.execute(sql`ALTER TABLE orders ADD COLUMN clave VARCHAR(40) NULL AFTER codigo`);
    console.log("Agregada orders.clave.");
  }
  const [idx] = await db.execute(sql`
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'orders_location_clave_uq'
  `);
  if ((idx as unknown as unknown[]).length > 0) {
    console.log("El índice orders_location_clave_uq ya existe.");
  } else {
    await db.execute(
      sql`CREATE UNIQUE INDEX orders_location_clave_uq ON orders (location_id, clave)`,
    );
    console.log("Creado orders_location_clave_uq.");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Agrega `orders.codigo`: el código de verificación de 4 caracteres que el
 * cliente muestra al retirar (ver src/lib/codigo-pedido.ts). Los pedidos
 * viejos quedan sin código.
 *
 * Es aditivo e idempotente. Correrlo en producción ANTES de desplegar: el
 * código nuevo lo escribe al tomar cada pedido.
 *
 * Correr con:  bun run src/db/migrate-codigo-pedido.ts
 * (y en producción: bun --env-file=.env.produccion.local run src/db/migrate-codigo-pedido.ts)
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [r] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'codigo'
  `);
  if ((r as unknown as unknown[]).length > 0) {
    console.log("orders.codigo ya existe.");
  } else {
    await db.execute(sql`ALTER TABLE orders ADD COLUMN codigo VARCHAR(8) NULL AFTER order_number`);
    console.log("Agregada orders.codigo.");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Crea `order_sequences`, el contador de numeración de pedidos por local y
 * jornada.
 *
 * La numeración visible del pedido se sacaba con MAX(order_number)+1 dentro de
 * la transacción, pero esa lectura no bloquea: dos pedidos simultáneos del
 * mismo local leen el mismo máximo y el segundo choca contra la unique key
 * `orders_location_date_number_uq`. Con muchos locales tomando pedidos a la vez
 * eso es un pedido perdido cada tanto. Esta tabla se incrementa de forma
 * atómica (INSERT ... ON DUPLICATE KEY UPDATE con LAST_INSERT_ID) y su lock de
 * fila serializa solo los pedidos del mismo local y día.
 *
 * Al crearla se siembra con el máximo ya usado por cada local y jornada, para
 * que un deploy a mitad del día no reinicie la numeración y choque contra los
 * pedidos que ya existen.
 *
 * Va como script propio y no con `drizzle-kit push` a propósito: push compara el
 * schema entero y podría proponer tocar tablas que este cambio no pidió.
 *
 * Es idempotente: si la tabla ya existe, no hace nada.
 *
 * Correr con:  bun run src/db/migrate-order-sequences.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [existe] = await db.execute(sql`SHOW TABLES LIKE 'order_sequences'`);
  if ((existe as unknown as unknown[]).length > 0) {
    console.log("La tabla order_sequences ya existe, no hay nada que hacer.");
    process.exit(0);
  }

  await db.execute(sql`
    CREATE TABLE order_sequences (
      location_id INT NOT NULL,
      business_date DATE NOT NULL,
      last_number INT NOT NULL,
      UNIQUE KEY order_sequences_location_date_uq (location_id, business_date)
    )
  `);

  // Siembra con lo ya usado por local y jornada: si hoy ya hay pedidos, el
  // contador arranca donde quedaron y no se pisa con ellos.
  await db.execute(sql`
    INSERT INTO order_sequences (location_id, business_date, last_number)
    SELECT location_id, business_date, MAX(order_number)
    FROM orders
    GROUP BY location_id, business_date
  `);

  console.log("Tabla order_sequences creada y sembrada desde los pedidos existentes.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

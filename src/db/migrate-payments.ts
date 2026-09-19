/**
 * Circuito de caja: forma de pago, cancelaciones y numeración diaria.
 *
 * Qué agrega a orders:
 *  - business_date: el día al que pertenece el pedido. Hace falta para reiniciar
 *    la numeración cada mañana (punto 10 de las reglas) y para el cierre de caja.
 *  - payment_method / payment_status: efectivo o Mercado Pago, y si ya se cobró.
 *    Reemplazan al booleano `paid`, que nunca se usó y no alcanzaba para
 *    "pendiente de reembolso".
 *  - cancelado como estado, con quién y cuándo.
 *
 * Y cambia la clave única: el número de pedido se repite todos los días, así que
 * ahora es único por (local, día, número) y no por (local, número).
 *
 * Correr con:  bun run src/db/migrate-payments.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function tieneColumna(tabla: string, columna: string): Promise<boolean> {
  const [rows] = (await db.execute(
    sql`SELECT COUNT(*) AS n FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ${tabla} AND column_name = ${columna}`,
  )) as unknown as [Array<{ n: number }>];
  return Number(rows[0]?.n ?? 0) > 0;
}

async function tieneIndice(tabla: string, indice: string): Promise<boolean> {
  const [rows] = (await db.execute(
    sql`SELECT COUNT(*) AS n FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = ${tabla} AND index_name = ${indice}`,
  )) as unknown as [Array<{ n: number }>];
  return Number(rows[0]?.n ?? 0) > 0;
}

async function main() {
  if (!(await tieneColumna("orders", "business_date"))) {
    await db.execute(sql`ALTER TABLE orders ADD COLUMN business_date DATE NULL`);
    // Los pedidos que ya estaban se quedan con el día en que se hicieron.
    await db.execute(sql`UPDATE orders SET business_date = DATE(created_at)`);
    await db.execute(sql`ALTER TABLE orders MODIFY business_date DATE NOT NULL`);
    console.log("business_date agregada y completada con la fecha de cada pedido.");
  } else {
    console.log("business_date ya existía.");
  }

  if (!(await tieneColumna("orders", "payment_method"))) {
    await db.execute(
      sql`ALTER TABLE orders
          ADD COLUMN payment_method ENUM('efectivo','mercadopago') NOT NULL DEFAULT 'efectivo'`,
    );
    console.log("payment_method agregada (los pedidos viejos quedan en efectivo).");
  } else {
    console.log("payment_method ya existía.");
  }

  if (!(await tieneColumna("orders", "payment_status"))) {
    await db.execute(
      sql`ALTER TABLE orders
          ADD COLUMN payment_status ENUM('pendiente','pagado','reembolso_pendiente')
          NOT NULL DEFAULT 'pendiente'`,
    );
    // Lo que ya se entregó se cobró: no tendría sentido dejarlo pendiente.
    await db.execute(sql`UPDATE orders SET payment_status = 'pagado' WHERE status = 'entregado'`);
    console.log("payment_status agregada; los pedidos entregados quedaron como pagados.");
  } else {
    console.log("payment_status ya existía.");
  }

  if (await tieneColumna("orders", "paid")) {
    await db.execute(sql`ALTER TABLE orders DROP COLUMN paid`);
    console.log("Columna paid eliminada: la reemplaza payment_status.");
  }

  if (!(await tieneColumna("orders", "cancelled_at"))) {
    await db.execute(sql`ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMP NULL`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN cancelled_by INT NULL`);
    console.log("cancelled_at y cancelled_by agregadas.");
  } else {
    console.log("cancelled_at ya existía.");
  }

  // El enum de estado necesita el valor nuevo antes de que nadie lo escriba.
  await db.execute(
    sql`ALTER TABLE orders
        MODIFY status ENUM('recibido','preparacion','entregado','cancelado')
        NOT NULL DEFAULT 'recibido'`,
  );
  console.log("Estado 'cancelado' habilitado.");

  if (await tieneIndice("orders", "orders_location_number_uq")) {
    await db.execute(sql`ALTER TABLE orders DROP INDEX orders_location_number_uq`);
    console.log("Índice único viejo (local, número) eliminado.");
  }
  if (!(await tieneIndice("orders", "orders_location_date_number_uq"))) {
    await db.execute(
      sql`ALTER TABLE orders
          ADD UNIQUE INDEX orders_location_date_number_uq (location_id, business_date, order_number)`,
    );
    console.log("Índice único nuevo (local, día, número) creado.");
  }

  // La sección de cierre de caja es nueva, así que entra al enum de permisos.
  await db.execute(
    sql`ALTER TABLE user_permissions
        MODIFY section ENUM('portada','categorias','productos','combos','ingredientes',
        'disponibilidad','stock','movimientos','codigos','comandera','caja') NOT NULL`,
  );
  console.log("Permiso 'caja' habilitado.");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

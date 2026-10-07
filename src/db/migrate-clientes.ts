/**
 * Clientes del pedido online: perfil global por teléfono (sin contraseña), para
 * que cada dueño arme su base de clientes. Crea la tabla `customers` y agrega
 * `orders.customer_id` para ligar cada pedido a su cliente.
 *
 * Es aditivo e idempotente: lo que ya exista se saltea.
 *
 * Correr con:  bun run src/db/migrate-clientes.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function tablaExiste(nombre: string): Promise<boolean> {
  const [r] = await db.execute(sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = ${nombre}
  `);
  return (r as unknown as unknown[]).length > 0;
}

async function columnaExiste(tabla: string, columna: string): Promise<boolean> {
  const [r] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = ${tabla} AND column_name = ${columna}
  `);
  return (r as unknown as unknown[]).length > 0;
}

async function main() {
  if (await tablaExiste("customers")) {
    console.log("Tabla customers ya existe.");
  } else {
    await db.execute(sql`
      CREATE TABLE customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(40) NOT NULL,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY customers_phone_uq (phone)
      )
    `);
    console.log("Creada tabla customers.");
  }

  if (await columnaExiste("orders", "customer_id")) {
    console.log("orders.customer_id ya existe.");
  } else {
    await db.execute(sql`ALTER TABLE orders ADD COLUMN customer_id INT NULL AFTER channel`);
    await db.execute(sql`CREATE INDEX orders_customer_idx ON orders (customer_id)`);
    console.log("Agregada orders.customer_id.");
  }

  console.log("Listo: clientes del pedido online.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

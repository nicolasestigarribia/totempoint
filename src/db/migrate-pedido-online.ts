/**
 * Prepara la base para el canal de pedido online: el link que el cliente abre
 * en su celular para pedir con retiro o envío.
 *
 * - Crea `online_settings` (cómo toma pedidos online cada sucursal) y
 *   `delivery_zones` (zonas de envío con su costo).
 * - Suma a `orders` el canal, los datos del cliente y del envío, la aceptación
 *   del local y el código de la página de seguimiento.
 * - Agrega "envio" al enum `delivery_method`, al final, sin tocar los valores
 *   que ya existen.
 *
 * Todo es aditivo: ninguna columna existente cambia de tipo y ningún pedido se
 * reescribe. Los pedidos viejos quedan como `channel = 'totem'`, que es lo que
 * fueron.
 *
 * Va como script propio y no con `drizzle-kit push` a propósito: push compara el
 * schema entero y podría proponer tocar tablas que este cambio no pidió.
 *
 * Es idempotente: cada paso mira si ya está hecho antes de hacerlo.
 *
 * Correr con:  bun run src/db/migrate-pedido-online.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function existeTabla(nombre: string): Promise<boolean> {
  const [filas] = await db.execute(sql`SHOW TABLES LIKE ${nombre}`);
  return (filas as unknown as unknown[]).length > 0;
}

async function existeColumna(tabla: string, columna: string): Promise<boolean> {
  const [filas] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = ${tabla} AND column_name = ${columna}
  `);
  return (filas as unknown as unknown[]).length > 0;
}

async function existeIndice(tabla: string, indice: string): Promise<boolean> {
  const [filas] = await db.execute(sql`
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = ${tabla} AND index_name = ${indice}
  `);
  return (filas as unknown as unknown[]).length > 0;
}

/** Columnas nuevas de `orders`, en el orden en que se agregan. */
const COLUMNAS_ORDERS: [string, string][] = [
  ["channel", "ENUM('totem','online') NOT NULL DEFAULT 'totem' AFTER order_number"],
  ["customer_phone", "VARCHAR(40) NULL AFTER delivery_method"],
  ["delivery_zone_name", "VARCHAR(80) NULL AFTER customer_phone"],
  ["delivery_fee", "DECIMAL(10,2) NULL AFTER delivery_zone_name"],
  ["delivery_address", "VARCHAR(255) NULL AFTER delivery_fee"],
  ["delivery_lat", "DECIMAL(9,6) NULL AFTER delivery_address"],
  ["delivery_lng", "DECIMAL(9,6) NULL AFTER delivery_lat"],
  ["cash_pays_with", "DECIMAL(10,2) NULL AFTER delivery_lng"],
  ["accepted_at", "TIMESTAMP NULL AFTER cash_pays_with"],
  ["eta_minutes", "INT NULL AFTER accepted_at"],
  ["tracking_token", "VARCHAR(40) NULL AFTER eta_minutes"],
];

async function main() {
  if (!(await existeTabla("online_settings"))) {
    await db.execute(sql`
      CREATE TABLE online_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        location_id INT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        cash_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        min_order DECIMAL(10,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY online_settings_location_uq (location_id)
      )
    `);
    console.log("Creada online_settings.");
  }

  if (!(await existeTabla("delivery_zones"))) {
    await db.execute(sql`
      CREATE TABLE delivery_zones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        location_id INT NOT NULL,
        name VARCHAR(80) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        sort INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY delivery_zones_location_idx (location_id)
      )
    `);
    console.log("Creada delivery_zones.");
  }

  // El enum se amplía agregando "envio" al final: los valores existentes no se
  // mueven, así que ningún pedido cambia de significado.
  const [tipo] = await db.execute(sql`
    SELECT column_type AS t FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_method'
  `);
  const columnType = String((tipo as unknown as { t: string }[])[0]?.t ?? "");
  if (!columnType.includes("'envio'")) {
    await db.execute(sql`
      ALTER TABLE orders MODIFY delivery_method ENUM('local','mostrador','envio') NOT NULL
    `);
    console.log("delivery_method ahora acepta 'envio'.");
  }

  for (const [columna, definicion] of COLUMNAS_ORDERS) {
    if (await existeColumna("orders", columna)) continue;
    await db.execute(sql.raw(`ALTER TABLE orders ADD COLUMN ${columna} ${definicion}`));
    console.log(`Agregada orders.${columna}.`);
  }

  if (!(await existeIndice("orders", "orders_tracking_token_uq"))) {
    await db.execute(
      sql`ALTER TABLE orders ADD UNIQUE KEY orders_tracking_token_uq (tracking_token)`,
    );
    console.log("Agregado el índice único de tracking_token.");
  }

  console.log("Listo: la base está preparada para el pedido online.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

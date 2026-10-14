/**
 * Pedido en mesa: el salón de cada sucursal, el módulo y lo que el pedido
 * guarda de la mesa.
 *
 * - `dining_tables`: las mesas, ubicadas en la grilla del salón, con el token
 *   que va en su QR.
 * - `mesa_settings`: si los pedidos de mesa se aceptan solos o esperan.
 * - `companies.mesas_enabled`: el módulo, apagado para todas.
 * - `orders.channel` suma 'mesa'; `orders.table_id` y `table_number`.
 *
 * Después correr `migrate-panel-sections.ts`, que suma la sección "salon" al
 * enum de permisos.
 *
 * Idempotente: cada paso mira si ya está hecho.
 *
 * Correr con:  bun run src/db/migrate-mesas.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function hay(q: ReturnType<typeof sql>): Promise<boolean> {
  const [filas] = await db.execute(q);
  return (filas as unknown as unknown[]).length > 0;
}

const existeTabla = (tabla: string) =>
  hay(sql`SELECT 1 FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = ${tabla}`);

const existeColumna = (tabla: string, columna: string) =>
  hay(sql`SELECT 1 FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = ${tabla} AND column_name = ${columna}`);

async function main() {
  if (!(await existeTabla("dining_tables"))) {
    await db.execute(sql`
      CREATE TABLE dining_tables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        location_id INT NOT NULL,
        number INT NOT NULL,
        seats INT NOT NULL,
        shape ENUM('redonda','cuadrada','rectangular') NOT NULL,
        x INT NOT NULL,
        y INT NOT NULL,
        token VARCHAR(24) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY dining_tables_location_number_uq (location_id, number),
        UNIQUE KEY dining_tables_token_uq (token),
        KEY dining_tables_location_idx (location_id)
      )
    `);
    console.log("Creada dining_tables.");
  }

  if (!(await existeTabla("mesa_settings"))) {
    await db.execute(sql`
      CREATE TABLE mesa_settings (
        company_id INT PRIMARY KEY,
        auto_accept BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);
    console.log("Creada mesa_settings.");
  }

  if (!(await existeColumna("companies", "mesas_enabled"))) {
    await db.execute(sql`
      ALTER TABLE companies ADD COLUMN mesas_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER totem_enabled
    `);
    console.log("Agregada companies.mesas_enabled (apagado para todas).");
  }

  const [[canal]] = (await db.execute(sql`
    SELECT column_type AS tipo FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'channel'
  `)) as unknown as [{ tipo: string }[]];
  if (!canal.tipo.includes("'mesa'")) {
    await db.execute(sql`
      ALTER TABLE orders MODIFY channel ENUM('totem','online','mesa') NOT NULL DEFAULT 'totem'
    `);
    console.log("orders.channel suma 'mesa'.");
  }

  if (!(await existeColumna("orders", "table_id"))) {
    await db.execute(sql`
      ALTER TABLE orders
        ADD COLUMN table_id INT NULL AFTER channel,
        ADD COLUMN table_number INT NULL AFTER table_id,
        ADD KEY orders_table_idx (table_id)
    `);
    console.log("Agregadas orders.table_id y table_number.");
  }

  console.log("Listo.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

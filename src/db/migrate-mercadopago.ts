/**
 * Cobro con Mercado Pago desde el tótem.
 *
 * Crea payment_settings, una fila por empresa con su access token. Las
 * credenciales van en tabla aparte y no en `companies` porque son un secreto
 * que mueve plata: separarlas hace difícil devolverlas por accidente junto con
 * los datos de marca, que sí son públicos.
 *
 * Y agrega a orders el rastro del cobro: qué preferencia se creó y qué pago la
 * terminó pagando, que es lo que evita acreditar dos veces el mismo pedido.
 *
 * Correr con:  bun run src/db/migrate-mercadopago.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function tieneTabla(tabla: string): Promise<boolean> {
  const [rows] = (await db.execute(
    sql`SELECT COUNT(*) AS n FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ${tabla}`,
  )) as unknown as [Array<{ n: number }>];
  return Number(rows[0]?.n ?? 0) > 0;
}

async function tieneColumna(tabla: string, columna: string): Promise<boolean> {
  const [rows] = (await db.execute(
    sql`SELECT COUNT(*) AS n FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ${tabla} AND column_name = ${columna}`,
  )) as unknown as [Array<{ n: number }>];
  return Number(rows[0]?.n ?? 0) > 0;
}

async function main() {
  if (!(await tieneTabla("payment_settings"))) {
    await db.execute(sql`
      CREATE TABLE payment_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        mp_access_token VARCHAR(255) NULL,
        mp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY payment_settings_company_uq (company_id)
      )
    `);
    console.log("Tabla payment_settings creada.");
  } else {
    console.log("payment_settings ya existía.");
  }

  if (!(await tieneColumna("orders", "mp_preference_id"))) {
    await db.execute(sql`ALTER TABLE orders ADD COLUMN mp_preference_id VARCHAR(80) NULL`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN mp_payment_id VARCHAR(40) NULL`);
    await db.execute(sql`ALTER TABLE orders ADD INDEX orders_mp_preference_idx (mp_preference_id)`);
    console.log("Columnas de Mercado Pago agregadas a orders.");
  } else {
    console.log("Las columnas de Mercado Pago ya existían.");
  }

  if (!(await tieneColumna("payment_settings", "mp_test_account"))) {
    await db.execute(
      sql`ALTER TABLE payment_settings ADD COLUMN mp_test_account BOOLEAN NOT NULL DEFAULT FALSE`,
    );
    console.log("Columna mp_test_account agregada.");
  } else {
    console.log("mp_test_account ya existía.");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

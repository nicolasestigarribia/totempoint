/**
 * Crea `audit_log`, la auditoría de cambios críticos del panel.
 *
 * Script propio y no `drizzle-kit push` por lo mismo que las otras
 * migraciones: push compara el schema entero y puede proponer tocar tablas que
 * este cambio no pidió. Acá se crea una tabla nueva y nada más.
 *
 * Es idempotente: si la tabla ya existe, no hace nada.
 *
 * Correr con:  bun run src/db/migrate-audit-log.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [existe] = await db.execute(sql`SHOW TABLES LIKE 'audit_log'`);
  if ((existe as unknown as unknown[]).length > 0) {
    console.log("La tabla audit_log ya existe, no hay nada que hacer.");
    process.exit(0);
  }

  await db.execute(sql`
    CREATE TABLE audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      user_id INT NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      as_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
      category ENUM('permisos','precios','cobros','pedidos','sucursales','empresa') NOT NULL,
      action VARCHAR(60) NOT NULL,
      summary VARCHAR(500) NOT NULL,
      details TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY audit_log_company_date_idx (company_id, created_at)
    )
  `);

  console.log("Tabla audit_log creada.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

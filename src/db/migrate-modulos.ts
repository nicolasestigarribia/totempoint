/**
 * Convierte el tótem y el pedido online en módulos que se venden por separado.
 *
 * Una empresa puede contratar el tótem, el pedido online o los dos. Lo que es
 * de la empresa —menú, precios, stock, comandera, cobros, apariencia— sirve
 * para cualquiera; lo propio de cada canal depende de su módulo. El superadmin
 * los prende y apaga por empresa.
 *
 * - `companies.totem_enabled`: prendido por defecto y para todas las empresas
 *   que ya existen, que hoy son todas clientes del tótem.
 * - `companies.online_ordering`: apagado por defecto, salvo para las empresas
 *   que ya tienen el pedido online prendido en alguna sucursal. Si no, la
 *   migración les cortaría de golpe un canal que hoy están usando.
 *
 * Es idempotente: cada columna se agrega solo si no está.
 *
 * Correr con:  bun run src/db/migrate-modulos.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function existeColumna(columna: string): Promise<boolean> {
  const [filas] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'companies' AND column_name = ${columna}
  `);
  return (filas as unknown as unknown[]).length > 0;
}

async function main() {
  if (!(await existeColumna("totem_enabled"))) {
    await db.execute(sql`
      ALTER TABLE companies ADD COLUMN totem_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER active
    `);
    console.log("Agregada companies.totem_enabled (todas las empresas existentes con tótem).");
  }

  if (!(await existeColumna("online_ordering"))) {
    await db.execute(sql`
      ALTER TABLE companies ADD COLUMN online_ordering BOOLEAN NOT NULL DEFAULT FALSE AFTER totem_enabled
    `);
    const [r] = await db.execute(sql`
      UPDATE companies SET online_ordering = TRUE
      WHERE id IN (SELECT company_id FROM online_settings WHERE enabled = TRUE)
    `);
    const n = (r as unknown as { affectedRows?: number }).affectedRows ?? 0;
    console.log(
      `Agregada companies.online_ordering. ${n} empresa(s) que ya lo usaban quedaron habilitadas.`,
    );
  }

  console.log("Listo: el tótem y el pedido online son módulos por empresa.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

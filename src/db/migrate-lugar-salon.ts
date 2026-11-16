/**
 * Balnearios:
 * - `companies.balneario`: el interruptor del superadmin. Todas las empresas
 *   existentes quedan en false, así que ninguna ve cambios.
 * - `dining_rooms.lugar`: cómo se llama donde se sienta el cliente que pide con
 *   el QR de esa sucursal — mesa, carpa o sombrilla. Solo se usa en empresas
 *   balneario; las demás siempre dicen "Mesa".
 *
 * Correr después de `migrate-salon-tamanio.ts`. Idempotente. En producción,
 * correrla ANTES de desplegar: el código nuevo lee las dos columnas.
 *
 * Correr con:  bun run src/db/migrate-lugar-salon.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function hayColumna(tabla: string, columna: string): Promise<boolean> {
  const [filas] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = ${tabla} AND column_name = ${columna}
  `);
  return (filas as unknown as unknown[]).length > 0;
}

async function main() {
  if (await hayColumna("companies", "balneario")) {
    console.log("companies.balneario ya existe.");
  } else {
    await db.execute(sql`
      ALTER TABLE companies ADD COLUMN balneario BOOLEAN NOT NULL DEFAULT FALSE
    `);
    console.log("Agregada companies.balneario (todas las empresas quedan en false).");
  }

  if (await hayColumna("dining_rooms", "lugar")) {
    console.log("dining_rooms.lugar ya existe.");
  } else {
    await db.execute(sql`
      ALTER TABLE dining_rooms
        ADD COLUMN lugar ENUM('mesa', 'carpa', 'sombrilla') NOT NULL DEFAULT 'mesa'
    `);
    console.log("Agregada dining_rooms.lugar (todas las sucursales quedan en 'mesa').");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

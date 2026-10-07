/**
 * Agrega `locations.lat` y `locations.lng`: el punto de la sucursal en el mapa,
 * elegido al cargarla con la ayuda de Google. Se usa como origen de los envíos
 * online (se sincroniza a `online_settings`).
 *
 * Es aditivo e idempotente: lo que ya exista se saltea.
 *
 * Correr con:  bun run src/db/migrate-sucursal-punto.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function columnaExiste(columna: string): Promise<boolean> {
  const [r] = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'locations' AND column_name = ${columna}
  `);
  return (r as unknown as unknown[]).length > 0;
}

async function main() {
  if (await columnaExiste("lat")) {
    console.log("locations.lat ya existe.");
  } else {
    await db.execute(sql`ALTER TABLE locations ADD COLUMN lat DECIMAL(9,6) NULL AFTER address`);
    console.log("Agregada locations.lat.");
  }
  if (await columnaExiste("lng")) {
    console.log("locations.lng ya existe.");
  } else {
    await db.execute(sql`ALTER TABLE locations ADD COLUMN lng DECIMAL(9,6) NULL AFTER lat`);
    console.log("Agregada locations.lng.");
  }
  console.log("Listo: punto de la sucursal.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Crea `location_combos`, la disponibilidad de combo por negocio.
 *
 * Va como script propio y no con `drizzle-kit push` a propósito: push compara
 * el schema entero contra la base y, si algo quedó distinto de cuando se
 * generó, propone tocar tablas que este cambio no pidió. Acá se crea una tabla
 * nueva y nada más, así que es seguro correrlo sobre la base con datos.
 *
 * Es idempotente: si la tabla ya existe, no hace nada.
 *
 * Correr con:  bun run src/db/migrate-location-combos.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  // `execute` tipa el resultado como el header de un INSERT; un SHOW devuelve
  // filas, así que se pasa por unknown para poder contarlas.
  const [existe] = await db.execute(sql`SHOW TABLES LIKE 'location_combos'`);
  if ((existe as unknown as unknown[]).length > 0) {
    console.log("La tabla location_combos ya existe, no hay nada que hacer.");
    process.exit(0);
  }

  await db.execute(sql`
    CREATE TABLE location_combos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      location_id INT NOT NULL,
      combo_id INT NOT NULL,
      available BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE KEY location_combos_uq (location_id, combo_id),
      KEY location_combos_location_idx (location_id)
    )
  `);

  console.log("Tabla location_combos creada.");
  console.log(
    "Ausencia de fila significa disponible, así que ningún combo cambia de estado por esto.",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

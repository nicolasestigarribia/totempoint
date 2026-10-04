/**
 * Pasa el envío del pedido online de zonas elegidas por el cliente a costo por
 * distancia, como PedidosYa o Rappi.
 *
 * La primera versión le hacía elegir al cliente una zona de una lista
 * ("Centro", "Playa norte"), y eso no le sirve al repartidor: necesita una
 * dirección y un punto en el mapa. Ahora el cliente marca dónde está, y el
 * costo sale de la distancia entre ese punto y la sucursal.
 *
 * - Agrega a `online_settings` el punto de la sucursal (origin_lat/lng).
 * - Crea `delivery_tiers`: tramos "hasta X km, $Y".
 * - Agrega a `orders` las indicaciones para el repartidor y la distancia.
 * - Con `--limpiar`, borra `delivery_zones` si está vacía. Va aparte porque
 *   la versión anterior del código la lee: se borra recién cuando esa versión
 *   ya no está desplegada. Si alguien llegó a cargar zonas, la deja y avisa:
 *   no se borran datos de nadie sin mirarlos.
 *
 * Es idempotente: cada paso mira si ya está hecho antes de hacerlo.
 *
 * Correr con:  bun run src/db/migrate-envio-por-distancia.ts
 * Y, ya desplegado el código nuevo:  bun run src/db/migrate-envio-por-distancia.ts --limpiar
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

const COLUMNAS: [string, string, string][] = [
  ["online_settings", "origin_lat", "DECIMAL(9,6) NULL AFTER min_order"],
  ["online_settings", "origin_lng", "DECIMAL(9,6) NULL AFTER origin_lat"],
  ["orders", "delivery_details", "VARCHAR(255) NULL AFTER delivery_address"],
  ["orders", "delivery_distance_km", "DECIMAL(6,2) NULL AFTER delivery_lng"],
];

async function main() {
  for (const [tabla, columna, definicion] of COLUMNAS) {
    if (await existeColumna(tabla, columna)) continue;
    await db.execute(sql.raw(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`));
    console.log(`Agregada ${tabla}.${columna}.`);
  }

  if (!(await existeTabla("delivery_tiers"))) {
    await db.execute(sql`
      CREATE TABLE delivery_tiers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        location_id INT NOT NULL,
        up_to_km DECIMAL(5,2) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY delivery_tiers_location_idx (location_id)
      )
    `);
    console.log("Creada delivery_tiers.");
  }

  if (process.argv.includes("--limpiar") && (await existeTabla("delivery_zones"))) {
    const [filas] = await db.execute(sql`SELECT COUNT(*) AS n FROM delivery_zones`);
    const n = Number((filas as unknown as { n: number }[])[0].n);
    if (n === 0) {
      await db.execute(sql`DROP TABLE delivery_zones`);
      console.log("Borrada delivery_zones (estaba vacía).");
    } else {
      console.log(
        `delivery_zones tiene ${n} filas: no la borro. Revisalas y borrala a mano si ya no sirven.`,
      );
    }
  }

  console.log("Listo: el envío ya se cobra por distancia.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Agrega totem_settings.theme: la base de color de las pantallas de adentro del
 * tótem (menú, carrito, checkout), que hasta ahora eran negro plano para todos.
 *
 * Correr con:  bun run src/db/migrate-totem-theme.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [rows] = (await db.execute(
    sql`SELECT COUNT(*) AS n FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'totem_settings' AND column_name = 'theme'`,
  )) as unknown as [Array<{ n: number }>];

  if (Number(rows[0]?.n ?? 0) > 0) {
    console.log("La columna theme ya existía, no hay nada que hacer.");
  } else {
    await db.execute(
      sql`ALTER TABLE totem_settings
          ADD COLUMN theme ENUM('oscuro','claro','calido') NOT NULL DEFAULT 'oscuro'`,
    );
    console.log("Columna theme agregada. Las portadas existentes quedan en 'oscuro'.");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

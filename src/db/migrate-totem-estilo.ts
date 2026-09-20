/**
 * Más opciones de estilo para el tótem: tipografía, esquinas y bases de color.
 *
 * Hasta ahora el negocio elegía su color de marca y poco más. Esto le agrega
 * las dos cosas que más cambian el aire de una pantalla sin tocar el contenido
 * —la tipografía y las esquinas— y suma bases de color, que antes eran tres.
 *
 * Las tipografías van como una lista cerrada de parejas ya probadas y no como
 * "elegí la fuente que quieras": un menú tiene que leerse de parado a un metro
 * de distancia, y ahí una fuente mal elegida arruina la venta.
 *
 * Correr con:  bun run src/db/migrate-totem-estilo.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function tieneColumna(tabla: string, columna: string): Promise<boolean> {
  const [rows] = (await db.execute(
    sql`SELECT COUNT(*) AS n FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ${tabla} AND column_name = ${columna}`,
  )) as unknown as [Array<{ n: number }>];
  return Number(rows[0]?.n ?? 0) > 0;
}

async function main() {
  // Las bases nuevas se suman a las que ya estaban: nadie pierde su elección.
  await db.execute(
    sql`ALTER TABLE totem_settings
        MODIFY theme ENUM('oscuro','claro','calido','noche','arena','bosque')
        NOT NULL DEFAULT 'oscuro'`,
  );
  console.log("Bases de color ampliadas a seis.");

  if (!(await tieneColumna("totem_settings", "font_theme"))) {
    await db.execute(
      sql`ALTER TABLE totem_settings
          ADD COLUMN font_theme ENUM('impacto','elegante','moderno','redondeado','sobrio')
          NOT NULL DEFAULT 'impacto'`,
    );
    console.log("Columna font_theme agregada (las portadas existentes quedan en 'impacto').");
  } else {
    console.log("font_theme ya existía.");
  }

  if (!(await tieneColumna("totem_settings", "corners"))) {
    await db.execute(
      sql`ALTER TABLE totem_settings
          ADD COLUMN corners ENUM('redondeado','suave','recto')
          NOT NULL DEFAULT 'redondeado'`,
    );
    console.log("Columna corners agregada.");
  } else {
    console.log("corners ya existía.");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Agrega la tipografía "geometrica" (Montserrat) a `totem_settings.font_theme`.
 * Es aditivo: solo amplía el enum, ninguna empresa cambia de fuente.
 *
 * Correr con:  bun run src/db/migrate-fuente-geometrica.ts
 * (y en producción: bun --env-file=.env.produccion.local run src/db/migrate-fuente-geometrica.ts)
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  const [r] = await db.execute(sql`
    SELECT column_type t FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'totem_settings' AND column_name = 'font_theme'
  `);
  const tipo = String((r as unknown as { t: string }[])[0]?.t ?? "");
  if (tipo.includes("'geometrica'")) {
    console.log("font_theme ya tiene 'geometrica'.");
    process.exit(0);
  }
  await db.execute(sql`
    ALTER TABLE totem_settings MODIFY font_theme
      ENUM('impacto','elegante','moderno','redondeado','sobrio','geometrica') NOT NULL DEFAULT 'impacto'
  `);
  console.log("Agregada la tipografía 'geometrica'.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

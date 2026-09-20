/**
 * Deja el enum `user_permissions.section` igual a PANEL_SECTIONS.
 *
 * Por qué existe: cada vez que alguien suma una sección al panel hay que
 * extender ese enum a mano, y hasta ahora cada migración lo reescribía entero
 * con la lista que conocía en ese momento. Con dos personas trabajando en
 * paralelo eso termina como terminó: una migración agregó "caja" y de paso
 * borró "precios", que había sumado la otra rama. El síntoma no aparece al
 * compilar ni al arrancar, sino recién cuando alguien intenta darle ese
 * permiso a un encargado y MySQL lo rechaza.
 *
 * Acá el enum se construye desde PANEL_SECTIONS, así que la fuente de verdad
 * es el código y no lo que recordaba el último script. Es idempotente: si ya
 * coincide, no toca nada.
 *
 * Correr con:  bun run src/db/migrate-panel-sections.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";
import { PANEL_SECTIONS } from "@/lib/auth/permissions";

async function main() {
  const [rows] = (await db.execute(
    sql`SELECT COLUMN_TYPE AS tipo FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'user_permissions'
          AND column_name = 'section'`,
  )) as unknown as [Array<{ tipo: string }>];

  const actual = rows[0]?.tipo ?? "";
  const esperado = `enum(${PANEL_SECTIONS.map((s) => `'${s}'`).join(",")})`;

  if (actual.replace(/\s/g, "") === esperado) {
    console.log("El enum ya coincide con PANEL_SECTIONS, no hay nada que hacer.");
    process.exit(0);
  }

  const faltan = PANEL_SECTIONS.filter((s) => !actual.includes(`'${s}'`));
  console.log("Enum actual: ", actual);
  console.log("Secciones que faltaban:", faltan.length ? faltan.join(", ") : "(ninguna)");

  // Antes de tocar nada: si en la base hay permisos de secciones que el código
  // ya no conoce, se quedarían sin valor válido y el ALTER los rompería.
  const [huerfanos] = (await db.execute(
    sql`SELECT DISTINCT section FROM user_permissions`,
  )) as unknown as [Array<{ section: string }>];
  const desconocidas = huerfanos
    .map((h) => h.section)
    .filter((s) => !PANEL_SECTIONS.includes(s as (typeof PANEL_SECTIONS)[number]));

  if (desconocidas.length > 0) {
    console.error(
      `Hay permisos guardados de secciones que el código no conoce: ${desconocidas.join(", ")}.`,
    );
    console.error("Revisalos antes de seguir: este script no los borra por las suyas.");
    process.exit(1);
  }

  await db.execute(sql.raw(`ALTER TABLE user_permissions MODIFY section ${esperado} NOT NULL`));
  console.log("Enum actualizado:", esperado);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

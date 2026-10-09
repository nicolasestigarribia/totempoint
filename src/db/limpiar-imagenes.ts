/**
 * Borra las imágenes que ya no usa nadie.
 *
 * Cada subida crea una fila nueva y nada borra la anterior cuando se cambia una
 * foto, así que la tabla junta imágenes que ningún producto, categoría, combo,
 * logo ni portada referencia (en test eran 32 de 71, más de la mitad de los
 * bytes). No se borran al reemplazar porque una misma imagen la comparten
 * varias filas (86 productos usaban ~30 fotos): lo seguro es mirar qué quedó
 * sin ninguna referencia.
 *
 * Respeta las imágenes de las últimas 24 h: alguien puede haber subido una
 * foto y todavía no haber guardado el producto.
 *
 * Antes de borrar revisa todas las columnas de texto de la base buscando links
 * .../img/... que este script no conozca; si los hay, aborta. Quien agregue un
 * campo de imagen nuevo tiene que sumarlo a REFERENCIAS.
 *
 * Por defecto solo muestra lo que borraría. Para borrar:
 *   bun run src/db/limpiar-imagenes.ts --aplicar
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

/** Las columnas que guardan un link /img/:id. */
const REFERENCIAS = [
  ["companies", "logo_url"],
  ["totem_settings", "hero_image_url"],
  ["categories", "photo_url"],
  ["products", "photo_url"],
  ["combos", "photo_url"],
] as const;

type Fila = Record<string, unknown>;
const filas = async (q: ReturnType<typeof sql>) => (await db.execute(q))[0] as unknown as Fila[];

async function main() {
  const aplicar = process.argv.includes("--aplicar");

  // ¿Hay alguna otra columna de texto con links /img/ que no esté en REFERENCIAS?
  const conocidas = new Set(REFERENCIAS.map(([t, c]) => `${t}.${c}`));
  const candidatas = await filas(sql`
    SELECT table_name AS t, column_name AS c FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name <> 'images'
      AND data_type IN ('varchar', 'text', 'mediumtext', 'longtext', 'json')
  `);
  for (const { t, c } of candidatas) {
    if (conocidas.has(`${t}.${c}`)) continue;
    const [uso] = await filas(
      sql`SELECT COUNT(*) AS n FROM ${sql.identifier(String(t))} WHERE ${sql.identifier(String(c))} LIKE '%/img/%'`,
    );
    if (Number(uso.n) > 0) {
      console.error(`Abortado: ${t}.${c} tiene links /img/ y no está en REFERENCIAS.`);
      process.exit(1);
    }
  }

  const usadas = sql.join(
    REFERENCIAS.map(
      ([t, c]) =>
        // También la URL completa (https://…/img/45): el campo deja pegarla.
        sql`SELECT CAST(SUBSTRING_INDEX(${sql.identifier(c)}, '/img/', -1) AS UNSIGNED) FROM ${sql.identifier(t)} WHERE ${sql.identifier(c)} LIKE '%/img/%'`,
    ),
    sql` UNION `,
  );
  const sinUso = sql`id NOT IN (${usadas}) AND created_at < NOW() - INTERVAL 1 DAY`;

  const [total] = await filas(sql`SELECT COUNT(*) AS n, SUM(LENGTH(data)) AS bytes FROM images`);
  const [huerfanas] = await filas(
    sql`SELECT COUNT(*) AS n, SUM(LENGTH(data)) AS bytes FROM images WHERE ${sinUso}`,
  );
  const mb = (b: unknown) => (Number(b ?? 0) / 1048576).toFixed(1);
  console.log(
    `${huerfanas.n} de ${total.n} imágenes sin uso: ${mb(huerfanas.bytes)} de ${mb(total.bytes)} MB.`,
  );

  if (!aplicar) {
    console.log("No se borró nada. Para borrarlas: --aplicar");
    process.exit(0);
  }

  await db.execute(sql`DELETE FROM images WHERE ${sinUso}`);
  // Sin esto MySQL se queda con el espacio de las filas borradas.
  await db.execute(sql`OPTIMIZE TABLE images`);
  console.log("Borradas, y la tabla compactada.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

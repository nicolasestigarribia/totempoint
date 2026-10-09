/**
 * Pasa `images.data` de base64 en un MEDIUMTEXT a los bytes en un MEDIUMBLOB.
 *
 * El base64 ocupa un 33% más que el archivo; guardar los bytes le saca un 25%
 * a la tabla sin tocar ninguna imagen. Al final corre OPTIMIZE TABLE, que
 * reconstruye la tabla y le devuelve al disco el espacio que MySQL tenía
 * reservado (en test eran 19 MB libres contra 9 MB de datos).
 *
 * Orden: **primero esta migración, después el deploy del código nuevo.** El
 * código nuevo escribe bytes, y en un MEDIUMTEXT eso falla ("Incorrect string
 * value"): las subidas quedarían rotas hasta migrar. Al revés es seguro: el
 * server viejo escribe base64 en el blob y `bytesDe` (src/lib/images.ts) lo
 * decodifica al servirlo.
 *
 * También corrige `mime_type` donde no coincide con el archivo.
 *
 * Idempotente: si la columna ya es MEDIUMBLOB solo corrige tipos, y si una corrida
 * anterior se cortó a la mitad retoma desde la columna temporal. Si alguna
 * fila no es base64 válido, aborta sin borrar nada.
 *
 * Correr con:  bun run src/db/migrate-images-blob.ts
 */
import { sql } from "drizzle-orm";
import { db } from "./index";
import { formatoDeImagen } from "@/lib/image-format";

type Fila = Record<string, unknown>;
const filas = async (q: ReturnType<typeof sql>) => (await db.execute(q))[0] as unknown as Fila[];

async function tamanio(): Promise<string> {
  // MySQL 8 cachea estas estadísticas hasta 24 h; ANALYZE las refresca.
  await db.execute(sql`ANALYZE TABLE images`);
  const [t] = await filas(sql`
    SELECT ROUND(data_length / 1048576, 1) AS datos, ROUND(data_free / 1048576, 1) AS libre
    FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'images'
  `);
  return `${t.datos} MB de datos, ${t.libre} MB libres`;
}

/**
 * Corrige `mime_type` según los bytes: lo subido desde Safari decía WebP y era
 * PNG. Los navegadores lo muestran igual, pero la etiqueta tiene que ser cierta.
 */
async function corregirTipos() {
  const todas = await filas(
    sql`SELECT id, mime_type AS tipo, LEFT(data, 256) AS inicio FROM images`,
  );
  let corregidas = 0;
  for (const { id, tipo, inicio } of todas) {
    const real = formatoDeImagen(inicio as Buffer);
    if (real && real !== tipo) {
      await db.execute(sql`UPDATE images SET mime_type = ${real} WHERE id = ${id}`);
      corregidas++;
    }
  }
  console.log(`Tipos corregidos: ${corregidas}.`);
}

async function main() {
  const columnas = await filas(sql`
    SELECT column_name AS nombre, data_type AS tipo FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'images' AND column_name IN ('data', 'data_bin')
  `);
  const tipo = (n: string) => columnas.find((c) => c.nombre === n)?.tipo;

  if (tipo("data") === "mediumblob" && !tipo("data_bin")) {
    console.log("images.data ya es MEDIUMBLOB.");
    await corregirTipos();
    process.exit(0);
  }

  console.log(`Antes: ${await tamanio()}`);

  if (!tipo("data_bin")) {
    await db.execute(sql`ALTER TABLE images ADD COLUMN data_bin MEDIUMBLOB NULL AFTER data`);
  }
  const convertir = () =>
    db.execute(sql`UPDATE images SET data_bin = FROM_BASE64(data) WHERE data_bin IS NULL`);
  await convertir();

  // FROM_BASE64 devuelve NULL si el texto no es base64: esa imagen se perdería.
  const malas = await filas(sql`SELECT id FROM images WHERE data_bin IS NULL`);
  if (malas.length > 0) {
    console.error(
      `Abortado: ${malas.length} imágenes no son base64 válido (ids ${malas.map((m) => m.id).join(", ")}). No se borró nada.`,
    );
    process.exit(1);
  }

  // Otra vez, pegado al ALTER: el server viejo pudo haber subido algo mientras
  // tanto, y esa fila tendría data_bin en NULL.
  await convertir();
  await db.execute(
    sql`ALTER TABLE images DROP COLUMN data, CHANGE COLUMN data_bin data MEDIUMBLOB NOT NULL`,
  );
  await db.execute(sql`OPTIMIZE TABLE images`);

  console.log(`Después: ${await tamanio()}`);
  await corregirTipos();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

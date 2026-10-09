import { eq } from "drizzle-orm";
import { db } from "@/db";
import { images } from "@/db/schema";
import { formatoDeImagen } from "@/lib/image-format";

/**
 * Los bytes de la imagen tal como salen de la columna.
 *
 * Hoy `data` es un MEDIUMBLOB con los bytes. Antes de migrate-images-blob.ts
 * era base64 en texto, y entre el deploy y la migración (o si un server viejo
 * sube algo después de migrar) puede venir base64 todavía: si los bytes no
 * tienen firma de imagen se prueban como base64. Así el orden en que se hagan
 * deploy y migración no rompe ninguna imagen.
 */
function bytesDe(data: Buffer | string): Buffer {
  const crudo = typeof data === "string" ? Buffer.from(data, "latin1") : data;
  if (formatoDeImagen(crudo)) return crudo;
  const decodificado = Buffer.from(crudo.toString("latin1"), "base64");
  return formatoDeImagen(decodificado) ? decodificado : crudo;
}

// Sirve /img/:id. El id nunca se reutiliza (cada subida crea una fila nueva),
// así que la respuesta se puede cachear para siempre.
export async function serveImage(id: number): Promise<Response> {
  const [row] = await db
    .select({ mimeType: images.mimeType, data: images.data })
    .from(images)
    .where(eq(images.id, id))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytesDe(row.data)), {
    headers: {
      "content-type": row.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

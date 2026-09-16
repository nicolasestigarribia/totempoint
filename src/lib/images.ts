import { eq } from "drizzle-orm";
import { db } from "@/db";
import { images } from "@/db/schema";

// Sirve /img/:id. El id nunca se reutiliza (cada subida crea una fila nueva),
// así que la respuesta se puede cachear para siempre.
export async function serveImage(id: number): Promise<Response> {
  const [row] = await db
    .select({ mimeType: images.mimeType, data: images.data })
    .from(images)
    .where(eq(images.id, id))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(row.data, "base64"), {
    headers: {
      "content-type": row.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

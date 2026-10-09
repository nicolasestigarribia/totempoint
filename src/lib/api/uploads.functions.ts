import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { images } from "@/db/schema";
import { requireCompany } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";
import { formatoDeImagen } from "@/lib/image-format";

// Tope de lo que aceptamos guardar en la base. El navegador comprime antes de
// llamar acá, así que una foto de celular entra holgada.
const MAX_BYTES = 1_500_000;

export const uploadImage = createServerFn({ method: "POST" })
  .middleware([requireCompany])
  .inputValidator(
    z.object({
      mimeType: z.enum(["image/webp", "image/jpeg", "image/png"]),
      data: z.string().min(1),
    }),
  )
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    if (Math.floor((data.data.length * 3) / 4) > MAX_BYTES)
      throw new Error("La imagen es demasiado pesada, probá con una más chica");

    // Viaja en base64 porque es JSON, pero se guardan los bytes: un 25% menos.
    // El tipo se toma del archivo y no del que declara el navegador, que en
    // Safari dice WebP y manda PNG. SVG no: puede llevar scripts.
    const bytes = Buffer.from(data.data, "base64");
    const mimeType = formatoDeImagen(bytes);
    if (!mimeType || mimeType === "image/svg+xml")
      throw new Error("El archivo no es una imagen JPG, PNG o WEBP");

    const [{ id }] = await db
      .insert(images)
      .values({ companyId: user.companyId, mimeType, data: bytes })
      .$returningId();

    return { url: `/img/${id}` };
  });

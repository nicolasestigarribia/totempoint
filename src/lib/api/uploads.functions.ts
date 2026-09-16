import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { images } from "@/db/schema";
import { requireAuth } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";

// Tope de lo que aceptamos guardar en la base. El navegador comprime antes de
// llamar acá, así que una foto de celular entra holgada.
const MAX_BYTES = 1_500_000;

export const uploadImage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      mimeType: z.enum(["image/webp", "image/jpeg", "image/png"]),
      data: z.string().min(1),
    }),
  )
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    const user = context.user as SessionUser;
    if (!user.companyId) throw new Error("Usuario sin empresa asignada");

    const bytes = Math.floor((data.data.length * 3) / 4);
    if (bytes > MAX_BYTES)
      throw new Error("La imagen es demasiado pesada, probá con una más chica");

    const [{ id }] = await db
      .insert(images)
      .values({ companyId: user.companyId, mimeType: data.mimeType, data: data.data })
      .$returningId();

    return { url: `/img/${id}` };
  });

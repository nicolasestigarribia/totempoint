import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentSettings } from "@/db/schema";
import { requireOwner } from "@/lib/auth/middleware";
import { companyIdOf } from "@/lib/auth/scope";
import type { SessionUser } from "@/lib/auth/session";
import { pareceClavePublica, verificarCredencial } from "@/lib/payments/mercadopago";
import { registrarAuditoria } from "@/lib/audit/registrar";

/**
 * Credenciales de cobro de la empresa.
 *
 * Es cosa del dueño, no de un encargado: son las llaves de la cuenta donde
 * entra la plata. Por eso van con `requireOwner` y no con un permiso delegable.
 */

export interface PaymentSettingsView {
  mpEnabled: boolean;
  /** Si hay token guardado. El token en sí nunca se devuelve. */
  mpConfigurado: boolean;
  /** Los últimos caracteres, solo para reconocer cuál está puesto. */
  mpTokenPista: string | null;
  /** Si el token es de una cuenta de prueba: no puede cobrarle a nadie real. */
  mpDePrueba: boolean;
}

/** Deja ver que hay un token sin mostrarlo: "…a1b2c3". */
function pista(token: string | null): string | null {
  if (!token) return null;
  return `…${token.slice(-6)}`;
}

export const getPaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireOwner])
  .handler(async ({ context }): Promise<PaymentSettingsView> => {
    const companyId = companyIdOf(context.user as SessionUser);

    const [row] = await db
      .select()
      .from(paymentSettings)
      .where(eq(paymentSettings.companyId, companyId))
      .limit(1);

    return {
      mpEnabled: row?.mpEnabled ?? false,
      mpConfigurado: Boolean(row?.mpAccessToken),
      mpTokenPista: pista(row?.mpAccessToken ?? null),
      mpDePrueba: row?.mpTestAccount ?? false,
    };
  });

export const updatePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      /**
       * Vacío o ausente significa "dejá el que está": así se puede prender y
       * apagar el cobro sin tener que volver a pegar el token cada vez.
       */
      mpAccessToken: z.string().trim().max(255).optional(),
      mpEnabled: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const companyId = companyIdOf(context.user as SessionUser);
    const token = data.mpAccessToken?.trim() || null;

    if (token && !/^(APP_USR-|TEST-)/.test(token)) {
      throw new Error(
        "Ese no parece una credencial de Mercado Pago: tiene que empezar con APP_USR- o TEST-",
      );
    }

    // La Public Key y el Access Token empiezan igual, y pegar la que no es
    // termina en un "UNAUTHORIZED" recién cuando alguien intenta pagar.
    if (token && pareceClavePublica(token)) {
      throw new Error(
        "Eso es la Public Key, no el Access Token. En el panel de Mercado Pago están una al lado " +
          "de la otra: copiá la que dice Access Token, que es bastante más larga.",
      );
    }

    const [existente] = await db
      .select()
      .from(paymentSettings)
      .where(eq(paymentSettings.companyId, companyId))
      .limit(1);

    const tokenFinal = token ?? existente?.mpAccessToken ?? null;

    if (data.mpEnabled && !tokenFinal) {
      throw new Error("Para cobrar con Mercado Pago primero cargá el access token");
    }

    // Se prueba contra Mercado Pago antes de guardar: si la credencial no
    // sirve, tiene que enterarse ahora el dueño y no después un cliente.
    let esDePrueba = existente?.mpTestAccount ?? false;
    if (token) {
      const prueba = await verificarCredencial(token);
      if (!prueba.ok) throw new Error(prueba.motivo);
      esDePrueba = prueba.esDePrueba;
    }

    if (existente) {
      await db
        .update(paymentSettings)
        .set({
          mpAccessToken: tokenFinal,
          mpEnabled: data.mpEnabled,
          mpTestAccount: esDePrueba,
        })
        .where(eq(paymentSettings.companyId, companyId));
    } else {
      await db.insert(paymentSettings).values({
        companyId,
        mpAccessToken: tokenFinal,
        mpEnabled: data.mpEnabled,
        mpTestAccount: esDePrueba,
      });
    }

    // Nunca el token en la auditoría: sólo que cambió. Es la llave de la
    // cuenta de la empresa y la auditoría la puede leer más gente.
    const cambios: string[] = [];
    if (token && token !== existente?.mpAccessToken) {
      cambios.push(`cargó una credencial nueva${esDePrueba ? " (de prueba)" : ""}`);
    }
    const estabaPrendido = existente?.mpEnabled ?? false;
    if (data.mpEnabled !== estabaPrendido) {
      cambios.push(data.mpEnabled ? "activó el cobro" : "desactivó el cobro");
    }
    if (cambios.length > 0) {
      await registrarAuditoria(context.user as SessionUser, {
        category: "cobros",
        action: "mp.config",
        summary: `Mercado Pago: ${cambios.join(" y ")}`,
        details: { antes: { activo: estabaPrendido }, despues: { activo: data.mpEnabled } },
      });
    }

    return { ok: true };
  });

/** Borra las credenciales y apaga el cobro. */
export const clearPaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .handler(async ({ context }) => {
    const companyId = companyIdOf(context.user as SessionUser);
    await db
      .update(paymentSettings)
      .set({ mpAccessToken: null, mpEnabled: false, mpTestAccount: false })
      .where(eq(paymentSettings.companyId, companyId));
    await registrarAuditoria(context.user as SessionUser, {
      category: "cobros",
      action: "mp.borrar",
      summary: "Mercado Pago: borró la credencial y apagó el cobro",
    });
    return { ok: true };
  });

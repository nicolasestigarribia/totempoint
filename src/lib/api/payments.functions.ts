import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentSettings } from "@/db/schema";
import { requireOwner } from "@/lib/auth/middleware";
import { companyIdOf } from "@/lib/auth/scope";
import type { SessionUser } from "@/lib/auth/session";

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
        "Ese no parece un access token de Mercado Pago: tiene que empezar con APP_USR- o TEST-",
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

    if (existente) {
      await db
        .update(paymentSettings)
        .set({ mpAccessToken: tokenFinal, mpEnabled: data.mpEnabled })
        .where(eq(paymentSettings.companyId, companyId));
    } else {
      await db
        .insert(paymentSettings)
        .values({ companyId, mpAccessToken: tokenFinal, mpEnabled: data.mpEnabled });
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
      .set({ mpAccessToken: null, mpEnabled: false })
      .where(eq(paymentSettings.companyId, companyId));
    return { ok: true };
  });

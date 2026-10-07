import { db } from "@/db";
import { logs } from "@/db/schema";

export interface DatosError {
  /** Dónde / qué operación falló, ej. "orders.devolverVenta", "request". */
  context: string;
  /** El error cacheado. Se extrae su mensaje y su stack. */
  error: unknown;
  /** Empresa afectada, si el error la conoce. */
  companyId?: number | null;
  /** Sucursal afectada, si el error la conoce. */
  locationId?: number | null;
  userId?: number | null;
  userEmail?: string | null;
  /** Ids/datos sueltos para reproducir. Se serializa a JSON. */
  extra?: unknown;
}

/**
 * Deja asentado un error o excepción del sistema en la tabla `logs`.
 *
 * Vive fuera de los `*.functions.ts` por la misma razón que `registrarAuditoria`:
 * una función común exportada desde ahí se queda en el bundle del navegador y se
 * lleva puesto al driver de MySQL.
 *
 * **Nunca tira.** Si guardar el log falla, no puede tumbar lo que ya venía
 * fallando: se cae a `console.error` y sigue. Siempre loguea a la consola además
 * de a la base, para no perder visibilidad en desarrollo.
 */
export async function registrarError(d: DatosError): Promise<void> {
  const message = d.error instanceof Error ? d.error.message : String(d.error);
  const stack = d.error instanceof Error ? (d.error.stack ?? null) : null;
  // Siempre a la consola del servidor, falle o no el guardado.
  console.error(`[${d.context}]`, d.error);
  try {
    await db.insert(logs).values({
      context: d.context.slice(0, 120),
      message: message.slice(0, 4000),
      stack: stack ? stack.slice(0, 8000) : null,
      companyId: d.companyId ?? null,
      locationId: d.locationId ?? null,
      userId: d.userId ?? null,
      userEmail: d.userEmail ?? null,
      extra: d.extra === undefined ? null : JSON.stringify(d.extra).slice(0, 8000),
    });
  } catch (err) {
    console.error("No se pudo registrar el error en logs:", err);
  }
}

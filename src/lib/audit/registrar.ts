import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import type { AuditCategory } from "./categorias";

export interface EntradaAuditoria {
  category: AuditCategory;
  /** Identificador estable de la acción, ej. "operador.permisos". */
  action: string;
  /** Frase que se muestra en la lista: quién ya se ve al lado, esto es qué. */
  summary: string;
  /** Antes y después, o lo que sirva para reconstruir el cambio. */
  details?: unknown;
  /** Empresa afectada. Por defecto, la de quien hace el cambio. */
  companyId?: number | null;
}

/**
 * Deja asentado un cambio crítico del panel.
 *
 * Vive fuera de los `*.functions.ts` por la misma razón que `acreditarPedido`:
 * una función común exportada desde ahí se queda en el bundle del navegador y
 * se lleva puesto al driver de MySQL.
 *
 * Nunca tira: si la auditoría falla, el cambio que la originó ya está hecho y
 * devolverle un error a quien lo hizo sólo lo llevaría a repetirlo. Se deja en
 * el log del servidor para que no pase en silencio.
 */
export async function registrarAuditoria(user: SessionUser, e: EntradaAuditoria): Promise<void> {
  try {
    await db.insert(auditLog).values({
      companyId: e.companyId === undefined ? user.companyId : e.companyId,
      userId: user.id,
      userEmail: user.email,
      asSuperadmin: user.roles.includes("superadmin"),
      category: e.category,
      action: e.action,
      summary: e.summary.slice(0, 500),
      details: e.details === undefined ? null : JSON.stringify(e.details),
    });
  } catch (err) {
    console.error("No se pudo registrar la auditoría:", e.action, err);
  }
}

/** "$1.500,00", para las frases de la auditoría. */
export function pesosAuditoria(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

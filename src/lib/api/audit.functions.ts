import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, desc, eq, gte, lt, like, or } from "drizzle-orm";

import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireOwner } from "@/lib/auth/middleware";
import { companyIdOf } from "@/lib/auth/scope";
import type { SessionUser } from "@/lib/auth/session";
import { AUDIT_CATEGORIES, type AuditCategory } from "@/lib/audit/categorias";

export interface AuditRow {
  id: number;
  createdAt: string;
  userEmail: string;
  asSuperadmin: boolean;
  category: AuditCategory;
  action: string;
  summary: string;
  details: string | null;
}

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Tope por consulta: la lista es para revisar, no para exportar. */
const LIMITE = 300;

/**
 * Auditoría de la empresa: quién cambió permisos, precios, cobros y accesos.
 *
 * Solo el dueño (y el superadmin adentro de la empresa): es justamente el
 * registro de lo que hicieron los demás, así que no se delega.
 *
 * Las fechas son días calendario de Argentina. `hasta` incluye el día entero.
 */
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireOwner])
  .inputValidator(
    z.object({
      desde: dia,
      hasta: dia,
      category: z.enum(AUDIT_CATEGORIES).nullable(),
      buscar: z.string().trim().max(100).optional(),
    }),
  )
  .handler(async ({ context, data }): Promise<{ rows: AuditRow[]; truncado: boolean }> => {
    const companyId = companyIdOf(context.user as SessionUser);

    // La base guarda en UTC; el dueño piensa en días de acá (UTC-3).
    const desde = new Date(`${data.desde}T00:00:00-03:00`);
    const hasta = new Date(`${data.hasta}T00:00:00-03:00`);
    hasta.setDate(hasta.getDate() + 1);

    const filtros = [
      eq(auditLog.companyId, companyId),
      gte(auditLog.createdAt, desde),
      lt(auditLog.createdAt, hasta),
    ];
    if (data.category) filtros.push(eq(auditLog.category, data.category));
    if (data.buscar) {
      const patron = `%${data.buscar.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      filtros.push(or(like(auditLog.summary, patron), like(auditLog.userEmail, patron))!);
    }

    const rows = await db
      .select()
      .from(auditLog)
      .where(and(...filtros))
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(LIMITE + 1);

    return {
      truncado: rows.length > LIMITE,
      rows: rows.slice(0, LIMITE).map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        userEmail: r.userEmail,
        asSuperadmin: r.asSuperadmin,
        category: r.category,
        action: r.action,
        summary: r.summary,
        details: r.details,
      })),
    };
  });

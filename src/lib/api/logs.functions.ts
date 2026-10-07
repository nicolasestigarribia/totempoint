import { createServerFn } from "@tanstack/react-start";
import { desc, lt, eq } from "drizzle-orm";
import { db } from "@/db";
import { logs, companies, locations } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth/middleware";

export interface LogRow {
  id: number;
  createdAt: string;
  context: string;
  message: string;
  stack: string | null;
  companyName: string | null;
  locationName: string | null;
  userEmail: string | null;
  extra: string | null;
}

/** Cuántos días se guardan los logs antes de purgarse solos. */
const RETENCION_DIAS = 90;

/**
 * Los errores del sistema, para el superadmin. Antes de devolverlos purga los
 * de más de 90 días: la tabla no tiene que crecer para siempre, y un error de
 * hace meses ya no dice nada que se pueda arreglar.
 */
export const listLogs = createServerFn({ method: "GET" })
  .middleware([requireSuperadmin])
  .handler(async (): Promise<LogRow[]> => {
    const corte = new Date(Date.now() - RETENCION_DIAS * 24 * 60 * 60 * 1000);
    await db.delete(logs).where(lt(logs.createdAt, corte));

    const rows = await db
      .select({
        id: logs.id,
        createdAt: logs.createdAt,
        context: logs.context,
        message: logs.message,
        stack: logs.stack,
        companyName: companies.name,
        locationName: locations.name,
        userEmail: logs.userEmail,
        extra: logs.extra,
      })
      .from(logs)
      .leftJoin(companies, eq(companies.id, logs.companyId))
      .leftJoin(locations, eq(locations.id, logs.locationId))
      .orderBy(desc(logs.createdAt))
      .limit(300);

    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }));
  });

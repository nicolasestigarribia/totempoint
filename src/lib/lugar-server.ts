/**
 * El lugar (mesa / carpa / sombrilla) de cada sucursal, leído de la base. Es un
 * módulo común y no un `*.functions.ts` por la regla del bundle: un export
 * común de esos archivos llega al navegador con la base adentro.
 *
 * Solo una empresa balneario (`companies.balneario`, lo prende el superadmin)
 * tiene carpas o sombrillas. Cualquier otra dice siempre "mesa", aunque haya un
 * lugar guardado: así ninguna empresa que no lo pidió ve un cambio.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { companies, diningRooms, locations } from "@/db/schema";
import { lugarDe, lugarEfectivo, type Lugar } from "@/lib/lugar";

export { lugarEfectivo };

/** Sucursal → lugar. Una sucursal sin salón guardado, o de una empresa que no es balneario, es "mesa". */
export async function lugaresDe(locationIds: number[]): Promise<Map<number, Lugar>> {
  const ids = [...new Set(locationIds)];
  const mapa = new Map<number, Lugar>(ids.map((id) => [id, "mesa"]));
  if (ids.length === 0) return mapa;
  const filas = await db
    .select({
      locationId: locations.id,
      lugar: diningRooms.lugar,
      balneario: companies.balneario,
    })
    .from(locations)
    .innerJoin(companies, eq(companies.id, locations.companyId))
    .leftJoin(diningRooms, eq(diningRooms.locationId, locations.id))
    .where(inArray(locations.id, ids));
  for (const f of filas) mapa.set(f.locationId, lugarEfectivo(f.balneario, f.lugar));
  return mapa;
}

/** El lugar guardado en el salón de la sucursal, sin mirar si la empresa es balneario. */
export async function lugarGuardado(locationId: number): Promise<Lugar> {
  const [f] = await db
    .select({ lugar: diningRooms.lugar })
    .from(diningRooms)
    .where(eq(diningRooms.locationId, locationId))
    .limit(1);
  return lugarDe(f?.lugar);
}

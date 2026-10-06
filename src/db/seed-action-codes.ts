/**
 * Carga los motivos de movimiento base en empresas que no los tengan.
 *
 * Las empresas nuevas ya los reciben al crearse (`createBusiness`); esto queda
 * para las que se crearon antes. Nunca pisa ni borra los que ya existen. Los
 * motivos están en `src/lib/stock/motivos-base.ts`.
 *
 * Correr con:  bun run src/db/seed-action-codes.ts [slug]
 * Sin slug, los completa en todas las empresas.
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import { companies } from "./schema";
import { cargarMotivosBase, MOTIVOS_BASE } from "@/lib/stock/motivos-base";

async function main() {
  const slug = process.argv[2];
  const empresas = slug
    ? await db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(eq(companies.slug, slug))
    : await db.select({ id: companies.id, name: companies.name }).from(companies);

  if (empresas.length === 0) {
    console.error(slug ? `No encontré la empresa "${slug}".` : "No hay empresas cargadas.");
    process.exit(1);
  }

  for (const e of empresas) {
    const nuevos = await cargarMotivosBase(e.id);
    console.log(
      `${e.name}: ${nuevos} motivos nuevos (${MOTIVOS_BASE.length - nuevos} ya estaban).`,
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Carga los motivos de movimiento de una empresa.
 *
 * Sin códigos de acción la sección Stock muestra el botón "Nuevo movimiento"
 * pero el desplegable "Motivo" sale vacío, así que no se puede registrar nada
 * a mano. Este set es el mínimo para que el circuito funcione; después cada
 * empresa agrega los suyos desde Códigos de acción.
 *
 * Correr con:  bun run src/db/seed-action-codes.ts [slug]
 * Sin slug, los carga para todas las empresas que no tengan ninguno.
 */
import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { companies, actionCodes } from "./schema";

interface Codigo {
  code: string;
  label: string;
  type: "stock" | "caja";
  direction: "ingreso" | "egreso";
  auto?: boolean;
}

const BASE: Codigo[] = [
  // Stock
  { code: "ING_COMPRA", label: "Compra a proveedor", type: "stock", direction: "ingreso" },
  {
    code: "ING_AJUSTE",
    label: "Ajuste de inventario (sobra)",
    type: "stock",
    direction: "ingreso",
  },
  { code: "ING_DEVOLUCION", label: "Devolución de cliente", type: "stock", direction: "ingreso" },
  { code: "EGR_VENCIMIENTO", label: "Vencido o en mal estado", type: "stock", direction: "egreso" },
  { code: "EGR_ROTURA", label: "Rotura o desperdicio", type: "stock", direction: "egreso" },
  {
    code: "EGR_CONSUMO",
    label: "Consumo interno del personal",
    type: "stock",
    direction: "egreso",
  },
  { code: "EGR_AJUSTE", label: "Ajuste de inventario (falta)", type: "stock", direction: "egreso" },
  { code: "EGR_TRASLADO", label: "Traslado a otro negocio", type: "stock", direction: "egreso" },
  // La venta la genera el sistema al cerrar un pedido: no se carga a mano.
  { code: "VENTA", label: "Venta", type: "stock", direction: "egreso", auto: true },

  // Caja
  { code: "ING_EFECTIVO", label: "Cobro en efectivo", type: "caja", direction: "ingreso" },
  { code: "ING_APERTURA", label: "Apertura de caja", type: "caja", direction: "ingreso" },
  { code: "EGR_RETIRO", label: "Retiro de caja", type: "caja", direction: "egreso" },
  { code: "EGR_PAGO_PROVEEDOR", label: "Pago a proveedor", type: "caja", direction: "egreso" },
  { code: "EGR_GASTO", label: "Gasto del día", type: "caja", direction: "egreso" },
];

async function cargar(companyId: number, nombre: string) {
  let nuevos = 0;
  for (const c of BASE) {
    const [existe] = await db
      .select({ id: actionCodes.id })
      .from(actionCodes)
      .where(and(eq(actionCodes.companyId, companyId), eq(actionCodes.code, c.code)))
      .limit(1);
    if (existe) continue;

    await db.insert(actionCodes).values({
      companyId,
      code: c.code,
      label: c.label,
      type: c.type,
      direction: c.direction,
      auto: c.auto ?? false,
      active: true,
    });
    nuevos++;
  }
  console.log(`${nombre}: ${nuevos} códigos nuevos (${BASE.length - nuevos} ya estaban).`);
}

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

  for (const e of empresas) await cargar(e.id, e.name);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

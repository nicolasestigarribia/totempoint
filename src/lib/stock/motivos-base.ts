/**
 * Los motivos de movimiento con que arranca toda empresa.
 *
 * Sin motivos, la sección Stock muestra "Nuevo movimiento" pero el desplegable
 * "Motivo" sale vacío y no se puede cargar nada a mano: una empresa recién
 * creada no podía ni registrar su stock inicial hasta que alguien corriera un
 * script. Por eso se cargan solos al crear la empresa; después cada una agrega
 * o desactiva los suyos desde Motivos.
 *
 * Vive fuera de los `*.functions.ts`: es una función común que toca la base, y
 * exportada desde ahí se quedaría en el bundle del navegador.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { actionCodes } from "@/db/schema";

interface MotivoBase {
  code: string;
  label: string;
  type: "stock" | "caja";
  direction: "ingreso" | "egreso";
  /** Lo genera el sistema (la venta): no se elige a mano. */
  auto?: boolean;
}

export const MOTIVOS_BASE: MotivoBase[] = [
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
  { code: "EGR_TRASLADO", label: "Traslado a otra sucursal", type: "stock", direction: "egreso" },
  // La venta la genera el sistema al tomar un pedido: no se carga a mano.
  { code: "VENTA", label: "Venta", type: "stock", direction: "egreso", auto: true },

  // Caja
  { code: "ING_EFECTIVO", label: "Cobro en efectivo", type: "caja", direction: "ingreso" },
  { code: "ING_APERTURA", label: "Apertura de caja", type: "caja", direction: "ingreso" },
  { code: "EGR_RETIRO", label: "Retiro de caja", type: "caja", direction: "egreso" },
  { code: "EGR_PAGO_PROVEEDOR", label: "Pago a proveedor", type: "caja", direction: "egreso" },
  { code: "EGR_GASTO", label: "Gasto del día", type: "caja", direction: "egreso" },
];

/**
 * Carga los motivos base que le falten a una empresa. Nunca pisa ni borra los
 * que ya tiene, así que se puede llamar sobre una empresa existente.
 * Devuelve cuántos agregó.
 */
export async function cargarMotivosBase(companyId: number): Promise<number> {
  const existentes = await db
    .select({ code: actionCodes.code })
    .from(actionCodes)
    .where(eq(actionCodes.companyId, companyId));
  const tiene = new Set(existentes.map((e) => e.code));
  const faltan = MOTIVOS_BASE.filter((m) => !tiene.has(m.code));
  if (faltan.length === 0) return 0;

  await db.insert(actionCodes).values(
    faltan.map((m) => ({
      companyId,
      code: m.code,
      label: m.label,
      type: m.type,
      direction: m.direction,
      auto: m.auto ?? false,
      active: true,
    })),
  );
  return faltan.length;
}

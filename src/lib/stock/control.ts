/**
 * Lo agotado no se vende.
 *
 * Hasta ahora el stock se descontaba pero no frenaba nada: un producto en cero
 * se seguía vendiendo y el inventario quedaba en negativo. Acá se decide qué
 * está agotado en una sucursal, para dos momentos:
 *
 *   - **El menú** (`productosAgotados`): lo que no alcanza ni para una unidad
 *     no se muestra, igual que un producto apagado.
 *   - **El pedido** (`faltantesDeStock`): el carrito vive en el celular o en la
 *     tablet y puede ser anterior a que algo se agotara, así que se vuelve a
 *     mirar dentro de la transacción del pedido, con las filas bloqueadas, para
 *     que dos clientes no se lleven la última lata a la vez.
 *
 * **Solo se controla lo que alguien cargó.** Un ítem cuenta recién cuando tiene
 * `artistock.control_desde`, que se fija con el primer ingreso de stock en esa
 * sucursal. Sin eso, una empresa que todavía no contó su inventario —que es
 * el caso de casi todas al arrancar— no vendería nada, porque las ventas ya la
 * dejaron en negativo. Lo que nunca se cargó se sigue vendiendo como antes.
 *
 * Vive fuera de los `*.functions.ts`, como `venta.ts`: es una función común que
 * toca la base y exportada desde ahí se quedaría en el bundle del navegador.
 */
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { artistock, productIngredients, products } from "@/db/schema";
import type { ConsumoVenta } from "./venta";

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Margen para los decimales del stock (se guarda con dos). */
const EPSILON = 0.005;

/**
 * El stock de los ítems controlados de esta sucursal, por ingrediente y por
 * producto. Lo que no aparece no está controlado.
 */
async function stockControlado(
  locationId: number,
  ingredientIds: number[],
  productIds: number[],
): Promise<{ ingredientes: Map<number, number>; productos: Map<number, number> }> {
  const ingredientes = new Map<number, number>();
  const productos = new Map<number, number>();
  if (ingredientIds.length === 0 && productIds.length === 0) return { ingredientes, productos };

  const filas = await db
    .select({
      ingredientId: artistock.ingredientId,
      productId: artistock.productId,
      stock: artistock.stockActual,
    })
    .from(artistock)
    .where(
      and(
        eq(artistock.locationId, locationId),
        isNotNull(artistock.controlDesde),
        or(
          ingredientIds.length ? inArray(artistock.ingredientId, ingredientIds) : undefined,
          productIds.length ? inArray(artistock.productId, productIds) : undefined,
        ),
      ),
    );
  for (const f of filas) {
    const stock = Number(f.stock ?? 0);
    if (f.ingredientId !== null) ingredientes.set(f.ingredientId, stock);
    else if (f.productId !== null) productos.set(f.productId, stock);
  }
  return { ingredientes, productos };
}

/**
 * Los productos de esta lista que en esta sucursal no alcanzan para una unidad.
 *
 * Uno de reventa, si su propio stock controlado no llega a 1. Uno elaborado, si
 * a algún ingrediente controlado de su receta no le alcanza para una porción.
 * Una línea de receta sin cantidad no cuenta: no sabemos cuánto lleva, y es el
 * mismo criterio con el que la venta no la descuenta.
 */
export async function productosAgotados(
  locationId: number,
  productIds: number[],
): Promise<Set<number>> {
  const agotados = new Set<number>();
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return agotados;

  const [filas, recetas] = await Promise.all([
    db
      .select({ id: products.id, stockable: products.stockable })
      .from(products)
      .where(inArray(products.id, ids)),
    db
      .select({
        productId: productIngredients.productId,
        ingredientId: productIngredients.ingredientId,
        quantity: productIngredients.quantity,
      })
      .from(productIngredients)
      .where(
        and(inArray(productIngredients.productId, ids), isNotNull(productIngredients.quantity)),
      ),
  ]);

  const deReventa = filas.filter((f) => f.stockable).map((f) => f.id);
  const elaborados = new Set(filas.filter((f) => !f.stockable).map((f) => f.id));
  const lineas = recetas.filter((r) => elaborados.has(r.productId) && Number(r.quantity) > 0);

  const { ingredientes, productos } = await stockControlado(
    locationId,
    [...new Set(lineas.map((l) => l.ingredientId))],
    deReventa,
  );

  for (const id of deReventa) {
    const stock = productos.get(id);
    if (stock !== undefined && stock < 1 - EPSILON) agotados.add(id);
  }
  for (const l of lineas) {
    const stock = ingredientes.get(l.ingredientId);
    if (stock !== undefined && stock < Number(l.quantity) - EPSILON) agotados.add(l.productId);
  }
  return agotados;
}

/**
 * Lo que este pedido consume y la sucursal no tiene, mirado dentro de la
 * transacción del pedido.
 *
 * Bloquea las filas de stock que toca (`FOR UPDATE`, siempre en el mismo orden
 * para no cruzarse con otro pedido), así que entre esta lectura y el descuento
 * nadie más se lleva lo mismo. Devuelve las filas de consumo que no alcanzan;
 * vacío si se puede vender.
 */
export async function faltantesDeStock(
  tx: Transaccion,
  locationId: number,
  consumo: ConsumoVenta[],
): Promise<ConsumoVenta[]> {
  const ingredientIds = consumo.filter((c) => c.ingredientId !== null).map((c) => c.ingredientId!);
  const productIds = consumo.filter((c) => c.productId !== null).map((c) => c.productId!);
  if (ingredientIds.length === 0 && productIds.length === 0) return [];

  const filas = await tx
    .select({
      ingredientId: artistock.ingredientId,
      productId: artistock.productId,
      stock: artistock.stockActual,
    })
    .from(artistock)
    .where(
      and(
        eq(artistock.locationId, locationId),
        isNotNull(artistock.controlDesde),
        or(
          ingredientIds.length ? inArray(artistock.ingredientId, ingredientIds) : undefined,
          productIds.length ? inArray(artistock.productId, productIds) : undefined,
        ),
      ),
    )
    .orderBy(artistock.id)
    .for("update");

  return consumo.filter((c) => {
    const fila = filas.find((f) =>
      c.ingredientId !== null ? f.ingredientId === c.ingredientId : f.productId === c.productId,
    );
    return fila !== undefined && Number(fila.stock ?? 0) < c.cantidad - EPSILON;
  });
}

/** Para que el que tomó el pedido sepa que fue el stock y arme el mensaje. */
export class StockInsuficiente extends Error {
  constructor(public readonly faltantes: ConsumoVenta[]) {
    super("Stock insuficiente");
  }
}

/** Si una fila de consumo es la misma cosa que otra (mismo ingrediente o producto). */
export const mismoItem = (a: ConsumoVenta, b: ConsumoVenta) =>
  a.ingredientId !== null ? a.ingredientId === b.ingredientId : a.productId === b.productId;

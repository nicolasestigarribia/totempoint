/**
 * El stock que consume una venta del tótem.
 *
 * Hasta ahora vender no tocaba el inventario: el código de acción `VENTA`
 * existía marcado como automático y con el comentario "la genera el sistema al
 * cerrar un pedido", pero nadie la generaba, así que `vp_local` era siempre
 * cero y el stock sólo se movía a mano desde el panel. Acá se cierra eso.
 *
 * **Cuándo se descuenta:** al tomar el pedido, apenas entra por el tótem. Es
 * la decisión del negocio: el inventario muestra lo comprometido en el momento
 * en que se comprometió, y no hay una ventana en la que dos tótems vendan lo
 * último que quedaba. La contracara es que cancelar tiene que devolverlo, y de
 * eso se ocupa `devolverVenta`.
 *
 * **Qué consume cada cosa:**
 *   - Un producto de reventa (`stockable`) se descuenta a sí mismo: la lata de
 *     gaseosa que salió de la heladera.
 *   - Un producto elaborado descuenta los ingredientes de su receta, por la
 *     cantidad que diga `product_ingredients`, menos los que el cliente sacó.
 *   - Un combo descuenta lo que consumen los productos que lleva adentro.
 *
 * Vive fuera de `*.functions.ts` a propósito: sólo las server functions se
 * borran del bundle del cliente, así que una función común que toque la base
 * exportada desde ahí arrastraría drizzle y el driver de MySQL al navegador.
 */
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  productIngredients,
  comboProducts,
  actionCodes,
  movements,
  artistock,
} from "@/db/schema";

/** El código de acción con el que queda asentada una venta. */
export const CODIGO_VENTA = "VENTA";
/** Y el de su anulación, cuando se cancela un pedido ya descontado. */
export const CODIGO_VENTA_ANULADA = "VENTA_ANULADA";

/** Una línea del pedido, como la manda el tótem. */
export interface LineaVendida {
  kind: "producto" | "combo";
  refId: number;
  quantity: number;
  /**
   * Los ingredientes que el cliente sacó de esta línea. Sólo aplica a un
   * producto suelto: adentro de un combo no se personaliza.
   */
  removedIngredientIds?: number[];
}

/** Una fila de consumo ya resuelta: o un ingrediente o un producto, nunca los dos. */
export interface ConsumoVenta {
  ingredientId: number | null;
  productId: number | null;
  cantidad: number;
}

/**
 * Qué consume esta venta, resuelto contra las recetas.
 *
 * Son todas lecturas y se hacen antes de abrir la transacción del pedido, a
 * propósito: si algo de esto falla, el pedido igual se toma. Perder una venta
 * porque no pudimos calcular el stock sería el peor de los dos errores.
 */
export async function calcularConsumo(
  companyId: number,
  lineas: LineaVendida[],
): Promise<ConsumoVenta[]> {
  if (lineas.length === 0) return [];

  // Un combo se expande a los productos que lleva, multiplicando cantidades.
  // A partir de acá todo son productos con una cantidad.
  const comboIds = lineas.filter((l) => l.kind === "combo").map((l) => l.refId);
  const componentes = comboIds.length
    ? await db
        .select({
          comboId: comboProducts.comboId,
          productId: comboProducts.productId,
          quantity: comboProducts.quantity,
        })
        .from(comboProducts)
        .where(inArray(comboProducts.comboId, comboIds))
    : [];

  /** productId -> cantidad total, con los ingredientes que se sacaron. */
  const pedidos: { productId: number; cantidad: number; sacados: Set<number> }[] = [];
  for (const linea of lineas) {
    if (linea.kind === "producto") {
      pedidos.push({
        productId: linea.refId,
        cantidad: linea.quantity,
        sacados: new Set(linea.removedIngredientIds ?? []),
      });
      continue;
    }
    for (const c of componentes.filter((c) => c.comboId === linea.refId)) {
      pedidos.push({
        productId: c.productId,
        cantidad: linea.quantity * c.quantity,
        sacados: new Set(),
      });
    }
  }
  if (pedidos.length === 0) return [];

  const productIds = [...new Set(pedidos.map((p) => p.productId))];
  const filas = await db
    .select({ id: products.id, stockable: products.stockable })
    .from(products)
    .where(and(eq(products.companyId, companyId), inArray(products.id, productIds)));
  const esDeReventa = new Map(filas.map((f) => [f.id, f.stockable]));

  const recetas = await db
    .select({
      productId: productIngredients.productId,
      ingredientId: productIngredients.ingredientId,
      quantity: productIngredients.quantity,
    })
    .from(productIngredients)
    .where(inArray(productIngredients.productId, productIds));

  // Se acumula por ingrediente y por producto: tres hamburguesas con cebolla
  // dejan un solo movimiento de cebolla, no tres.
  const porIngrediente = new Map<number, number>();
  const porProducto = new Map<number, number>();

  for (const p of pedidos) {
    if (esDeReventa.get(p.productId)) {
      porProducto.set(p.productId, (porProducto.get(p.productId) ?? 0) + p.cantidad);
      continue;
    }
    for (const r of recetas.filter((r) => r.productId === p.productId)) {
      if (p.sacados.has(r.ingredientId)) continue;
      // Receta sin cantidad: sabemos que lleva el ingrediente pero no cuánto,
      // así que no se descuenta nada. Inventar un número acá ensuciaría el
      // inventario de forma silenciosa, que es peor que no moverlo.
      const porUnidad = r.quantity === null ? 0 : Number(r.quantity);
      if (!porUnidad) continue;
      const total = porUnidad * p.cantidad;
      porIngrediente.set(r.ingredientId, (porIngrediente.get(r.ingredientId) ?? 0) + total);
    }
  }

  return [
    ...[...porIngrediente].map(([ingredientId, cantidad]) => ({
      ingredientId,
      productId: null,
      cantidad,
    })),
    ...[...porProducto].map(([productId, cantidad]) => ({
      ingredientId: null,
      productId,
      cantidad,
    })),
  ].filter((c) => c.cantidad > 0);
}

/**
 * Deja listo el código de acción del sistema para esta empresa.
 *
 * `action_codes.code` es único por empresa, y una empresa a la que nadie le
 * corrió el seed no lo tiene. Sin esto el primer pedido no podría asentar su
 * movimiento; con esto, se crea solo la primera vez. Son códigos `auto`: no se
 * eligen a mano desde el panel.
 */
export async function asegurarCodigosDeVenta(companyId: number): Promise<void> {
  const existentes = await db
    .select({ code: actionCodes.code })
    .from(actionCodes)
    .where(
      and(
        eq(actionCodes.companyId, companyId),
        inArray(actionCodes.code, [CODIGO_VENTA, CODIGO_VENTA_ANULADA]),
      ),
    );
  const tiene = new Set(existentes.map((e) => e.code));

  const faltan = [
    { code: CODIGO_VENTA, label: "Venta", direction: "egreso" as const },
    { code: CODIGO_VENTA_ANULADA, label: "Venta anulada", direction: "ingreso" as const },
  ].filter((c) => !tiene.has(c.code));

  for (const c of faltan) {
    await db
      .insert(actionCodes)
      .values({
        companyId,
        code: c.code,
        label: c.label,
        type: "stock",
        direction: c.direction,
        auto: true,
        active: true,
      })
      .onDuplicateKeyUpdate({ set: { active: true } });
  }
}

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Asienta el consumo de una venta: un movimiento por línea y el acumulado.
 *
 * Recibe la transacción del pedido para que el descuento y el pedido sean la
 * misma operación: no puede quedar un pedido sin su descuento ni al revés.
 * La venta suma en `vp_local`, que es la columna que `artistock` tiene
 * reservada justamente para eso y que hasta ahora nadie escribía.
 */
export async function registrarVenta(
  tx: Transaccion,
  ctx: { companyId: number; locationId: number; orderId: number; orderNumber: number },
  consumo: ConsumoVenta[],
): Promise<void> {
  if (consumo.length === 0) return;

  await tx.insert(movements).values(
    consumo.map((c) => ({
      companyId: ctx.companyId,
      locationId: ctx.locationId,
      orderId: ctx.orderId,
      ingredientId: c.ingredientId,
      productId: c.productId,
      type: "stock" as const,
      actionCode: CODIGO_VENTA,
      amount: (-c.cantidad).toFixed(2),
      detail: `Pedido #${ctx.orderNumber}`,
    })),
  );

  for (const c of consumo) {
    await tx
      .insert(artistock)
      .values({
        companyId: ctx.companyId,
        ingredientId: c.ingredientId,
        productId: c.productId,
        locationId: ctx.locationId,
        vpLocal: c.cantidad.toFixed(2),
      })
      .onDuplicateKeyUpdate({
        set: { vpLocal: sql`${artistock.vpLocal} + ${c.cantidad.toFixed(2)}` },
      });
  }
}

/**
 * Devuelve al stock lo que un pedido cancelado había consumido.
 *
 * No recalcula recetas: lee los movimientos de venta que dejó ese pedido y los
 * revierte. Si mientras tanto alguien editó la receta, lo que vuelve es lo que
 * realmente salió, que es lo único defendible frente a un conteo físico.
 *
 * `movements` es append-only, así que la anulación es una fila nueva y la
 * venta original queda a la vista en el libro.
 */
export async function devolverVenta(orderId: number): Promise<void> {
  const vendidos = await db
    .select({
      companyId: movements.companyId,
      locationId: movements.locationId,
      ingredientId: movements.ingredientId,
      productId: movements.productId,
      amount: movements.amount,
    })
    .from(movements)
    .where(and(eq(movements.orderId, orderId), eq(movements.actionCode, CODIGO_VENTA)));

  if (vendidos.length === 0) return;

  // Si ya se anuló antes, no se devuelve dos veces.
  const [yaAnulado] = await db
    .select({ id: movements.id })
    .from(movements)
    .where(and(eq(movements.orderId, orderId), eq(movements.actionCode, CODIGO_VENTA_ANULADA)))
    .limit(1);
  if (yaAnulado) return;

  await db.insert(movements).values(
    vendidos.map((v) => ({
      companyId: v.companyId,
      locationId: v.locationId,
      orderId,
      ingredientId: v.ingredientId,
      productId: v.productId,
      type: "stock" as const,
      actionCode: CODIGO_VENTA_ANULADA,
      amount: Math.abs(Number(v.amount)).toFixed(2),
      detail: "Pedido cancelado",
    })),
  );

  for (const v of vendidos) {
    const cantidad = Math.abs(Number(v.amount)).toFixed(2);
    await db
      .update(artistock)
      .set({ vpLocal: sql`GREATEST(${artistock.vpLocal} - ${cantidad}, 0)` })
      .where(
        and(
          eq(artistock.locationId, v.locationId),
          v.ingredientId !== null
            ? eq(artistock.ingredientId, v.ingredientId)
            : eq(artistock.productId, v.productId!),
        ),
      );
  }
}

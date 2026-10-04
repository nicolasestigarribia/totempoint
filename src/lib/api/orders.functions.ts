import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, or, ne, desc, inArray, gte, lte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, orderItemRemovals, orderItemExtras, locations } from "@/db/schema";
import { requireCompany } from "@/lib/auth/middleware";
import {
  accessibleLocationIds,
  assertCanViewKitchen,
  assertCanOperateKitchen,
} from "@/lib/auth/scope";
import type { SessionUser } from "@/lib/auth/session";
import { verificarPagoMP } from "@/lib/payments/verificar";
import { registrarAuditoria, pesosAuditoria } from "@/lib/audit/registrar";
import { devolverVenta } from "@/lib/stock/venta";

export type OrderStatus = "recibido" | "preparacion" | "entregado" | "cancelado";
export type PaymentMethod = "efectivo" | "mercadopago";
export type PaymentStatus = "pendiente" | "pagado" | "reembolso_pendiente";

export interface KitchenOrderItem {
  productName: string;
  quantity: number;
  unitPrice: string;
  /** Lo que el cliente pidió sacar, ya con el nombre congelado del pedido. */
  removed: string[];
  /** Lo que pidió de más ("+2 carne"), con la cantidad. */
  extras: { name: string; quantity: number }[];
}

export interface KitchenOrder {
  id: number;
  orderNumber: number;
  businessDate: string;
  customerName: string;
  deliveryMethod: "local" | "mostrador" | "envio";
  comments: string | null;
  /** Tótem del mostrador o pedido online desde el celular del cliente. */
  channel: "totem" | "online";
  /**
   * Cuándo lo aceptó el local. Un pedido online sin aceptar no entra todavía
   * a las columnas de la cocina: espera en "Por aceptar".
   */
  acceptedAt: string | null;
  etaMinutes: number | null;
  /** Datos del pedido online: cómo ubicar al cliente y cómo le llega. */
  customerPhone: string | null;
  deliveryFee: string | null;
  deliveryAddress: string | null;
  deliveryDetails: string | null;
  deliveryDistanceKm: string | null;
  deliveryLat: string | null;
  deliveryLng: string | null;
  cashPaysWith: string | null;
  status: OrderStatus;
  total: string;
  createdAt: string;
  locationName: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /**
   * Mercado Pago confirmó el pago. Un cobro así no lo puede desmarcar nadie
   * desde la cocina: la plata está en la cuenta, se haya visto o no.
   */
  mpConfirmado: boolean;
  /** Lo canceló el cliente desde su celular (pedido online), no alguien del local. */
  canceladoPorCliente: boolean;
  items: KitchenOrderItem[];
}

/**
 * Qué pedidos trae la comandera: los del último día, más los que siguen en
 * curso aunque sean más viejos. Antes traía los últimos 200 con todos sus
 * ítems cada 10 segundos, incluidos pedidos de días atrás que la pantalla ni
 * muestra: en el celular de la caja, con datos móviles, eso era lento y caro.
 */
const VENTANA_COMANDERA_MS = 24 * 60 * 60 * 1000;

/**
 * Cuánto espera un pedido online de Mercado Pago a que lo paguen antes de
 * cancelarse solo. Ese pedido no se muestra en la comandera hasta que se paga,
 * pero ya descontó stock: si el cliente abandona el pago, sin este vencimiento
 * quedaría oculto para siempre con la mercadería apartada. El link de pago de
 * Mercado Pago vence al mismo tiempo, así nadie paga un pedido ya cancelado.
 */
export const VENCE_PAGO_ONLINE_MS = 30 * 60 * 1000;

/**
 * Un pedido online de Mercado Pago que todavía no se pagó. No va a la
 * comandera: el local recién se entera cuando el cliente terminó de pagar o
 * lo pasó a efectivo, así no suena ni se acepta un pedido que quizás nunca se
 * pague.
 */
const esperandoPagoOnline = (o: {
  channel: string;
  paymentMethod: string;
  paymentStatus: string;
  acceptedAt: Date | null;
}) =>
  o.channel === "online" &&
  o.paymentMethod === "mercadopago" &&
  o.paymentStatus === "pendiente" &&
  o.acceptedAt === null;

/** Cuánto hacia atrás la cocina sale a buscar pagos de Mercado Pago sin confirmar. */
const VENTANA_VERIFICACION_MS = 3 * 60 * 60 * 1000;
/** Tope de consultas a Mercado Pago por refresco de la comandera. */
const MAX_VERIFICACIONES = 8;

/**
 * Negocios cuyos pedidos puede ver quien llama: el dueño los ve todos, el
 * encargado solo los que tiene asignados.
 */
async function visibleLocations(user: SessionUser) {
  const allowed = await accessibleLocationIds(user);
  if (allowed.length === 0) return [];
  return db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(inArray(locations.id, allowed));
}

export const listKitchenOrders = createServerFn({ method: "GET" })
  .middleware([requireCompany])
  .handler(async ({ context }): Promise<KitchenOrder[]> => {
    const user = context.user as SessionUser;
    assertCanViewKitchen(user);

    const locs = await visibleLocations(user);
    if (locs.length === 0) return [];

    const locIds = locs.map((l) => l.id);
    const rows = await db
      .select()
      .from(orders)
      .where(
        and(
          inArray(orders.locationId, locIds),
          or(
            gte(orders.createdAt, new Date(Date.now() - VENTANA_COMANDERA_MS)),
            inArray(orders.status, ["recibido", "preparacion"]),
          ),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(200);

    if (rows.length === 0) return [];

    // Un pedido con Mercado Pago queda "sin cobrar" si el cliente se fue de la
    // pantalla antes de que se confirmara el pago y además se perdió el aviso.
    // La cocina está abierta todo el día y refresca sola, así que es el lugar
    // natural para ir a preguntar por esos pedidos sin depender de nadie.
    const desde = Date.now() - VENTANA_VERIFICACION_MS;
    const sinConfirmar = rows
      .filter(
        (o) =>
          o.paymentMethod === "mercadopago" &&
          o.paymentStatus === "pendiente" &&
          o.status !== "cancelado" &&
          o.createdAt.getTime() >= desde,
      )
      .slice(0, MAX_VERIFICACIONES);
    const companyId = user.companyId;
    const vencidos: number[] = [];
    if (sinConfirmar.length > 0 && companyId) {
      const resultados = await Promise.all(
        sinConfirmar.map((o) => verificarPagoMP(o.id, companyId)),
      );
      // Los online que Mercado Pago confirma que no se pagaron y pasaron el
      // plazo se cancelan. Si Mercado Pago no contestó (null) no se toca nada:
      // mejor esperar al próximo refresco que cancelar un pedido pagado.
      sinConfirmar.forEach((o, i) => {
        if (
          resultados[i] === false &&
          esperandoPagoOnline(o) &&
          Date.now() - o.createdAt.getTime() > VENCE_PAGO_ONLINE_MS
        ) {
          vencidos.push(o.id);
        }
      });
      const acreditados = sinConfirmar.filter((_, i) => resultados[i]).map((o) => o.id);
      if (acreditados.length > 0) {
        // Se relee para traer el id del pago que quedó guardado.
        const frescos = await db
          .select({
            id: orders.id,
            paymentStatus: orders.paymentStatus,
            mpPaymentId: orders.mpPaymentId,
          })
          .from(orders)
          .where(inArray(orders.id, acreditados));
        for (const f of frescos) {
          const o = rows.find((r) => r.id === f.id);
          if (!o) continue;
          o.paymentStatus = f.paymentStatus;
          o.mpPaymentId = f.mpPaymentId;
        }
      }
    }

    // Los que quedaron afuera de la ventana de verificación (más de 3 horas
    // sin pagar) también vencen: su link de pago ya no sirve.
    for (const o of rows) {
      if (
        esperandoPagoOnline(o) &&
        o.status !== "cancelado" &&
        o.createdAt.getTime() < desde &&
        !vencidos.includes(o.id)
      ) {
        vencidos.push(o.id);
      }
    }
    if (vencidos.length > 0) {
      await db
        .update(orders)
        .set({ status: "cancelado", cancelledAt: new Date(), cancelledBy: null })
        .where(
          and(
            inArray(orders.id, vencidos),
            eq(orders.paymentStatus, "pendiente"),
            isNull(orders.acceptedAt),
            ne(orders.status, "cancelado"),
          ),
        );
      for (const id of vencidos) {
        // El stock que había apartado vuelve. Nunca frena la comandera.
        try {
          await devolverVenta(id);
        } catch (error) {
          console.error(`No se pudo devolver el stock del pedido vencido ${id}:`, error);
        }
      }
    }

    // A la comandera llega solo lo que el local tiene que atender: un pedido
    // online de Mercado Pago aparece recién pagado (o pasado a efectivo).
    const enCocina = rows.filter((o) => !esperandoPagoOnline(o));
    if (enCocina.length === 0) return [];

    const items = await db
      .select()
      .from(orderItems)
      .where(
        inArray(
          orderItems.orderId,
          enCocina.map((r) => r.id),
        ),
      );

    // El "sin cebolla" y el "+carne" de cada línea. Es lo primero que mira quien
    // prepara, así que viaja con el pedido y no se pide aparte. Las dos
    // consultas van a la vez: no dependen una de la otra, y la comandera se
    // refresca cada 10 segundos.
    const [sacados, agregados] = await Promise.all([
      items.length
        ? db
            .select({
              orderItemId: orderItemRemovals.orderItemId,
              ingredientName: orderItemRemovals.ingredientName,
            })
            .from(orderItemRemovals)
            .where(
              inArray(
                orderItemRemovals.orderItemId,
                items.map((i) => i.id),
              ),
            )
        : [],
      items.length
        ? db
            .select({
              orderItemId: orderItemExtras.orderItemId,
              ingredientName: orderItemExtras.ingredientName,
              quantity: orderItemExtras.quantity,
            })
            .from(orderItemExtras)
            .where(
              inArray(
                orderItemExtras.orderItemId,
                items.map((i) => i.id),
              ),
            )
        : [],
    ]);

    return enCocina.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      businessDate: o.businessDate,
      customerName: o.customerName,
      deliveryMethod: o.deliveryMethod,
      comments: o.comments,
      channel: o.channel,
      acceptedAt: o.acceptedAt?.toISOString() ?? null,
      etaMinutes: o.etaMinutes,
      customerPhone: o.customerPhone,
      deliveryFee: o.deliveryFee,
      deliveryAddress: o.deliveryAddress,
      deliveryDetails: o.deliveryDetails,
      deliveryDistanceKm: o.deliveryDistanceKm,
      deliveryLat: o.deliveryLat,
      deliveryLng: o.deliveryLng,
      cashPaysWith: o.cashPaysWith,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt.toISOString(),
      locationName: locs.find((l) => l.id === o.locationId)?.name ?? "",
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      mpConfirmado: o.mpPaymentId !== null,
      canceladoPorCliente:
        o.status === "cancelado" && o.cancelledBy === null && o.channel === "online",
      items: items
        .filter((i) => i.orderId === o.id)
        .map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          removed: sacados.filter((s) => s.orderItemId === i.id).map((s) => s.ingredientName),
          extras: agregados
            .filter((e) => e.orderItemId === i.id)
            .map((e) => ({ name: e.ingredientName, quantity: e.quantity })),
        })),
    }));
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireCompany])
  .inputValidator(
    z.object({
      orderId: z.number().int(),
      status: z.enum(["recibido", "preparacion", "entregado"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    assertCanOperateKitchen(user);

    const locs = await visibleLocations(user);
    const locIds = locs.map((l) => l.id);
    if (locIds.length === 0) throw new Error("Ese pedido no es de una sucursal tuya");

    const [target] = await db
      .select({
        id: orders.id,
        status: orders.status,
        channel: orders.channel,
        acceptedAt: orders.acceptedAt,
      })
      .from(orders)
      .where(and(eq(orders.id, data.orderId), inArray(orders.locationId, locIds)))
      .limit(1);

    if (!target) throw new Error("Ese pedido no es de una sucursal tuya");
    if (target.status === "cancelado") {
      throw new Error("Ese pedido está cancelado: no se le puede cambiar el estado");
    }
    // Un pedido online que nadie aceptó no se prepara: el cliente todavía no
    // sabe si se lo van a hacer, ni en cuánto.
    if (target.channel === "online" && !target.acceptedAt) {
      throw new Error("Primero aceptá el pedido online");
    }

    await db.update(orders).set({ status: data.status }).where(eq(orders.id, data.orderId));
    return { ok: true };
  });

/**
 * Acepta un pedido online y le promete una demora al cliente.
 *
 * Lo hace quien atiende los pedidos, que es quien sabe cuánto está tardando la
 * cocina y si el repartidor está en la calle. Recién aceptado el pedido entra a
 * las columnas de la comandera, y el cliente lo ve en su página de seguimiento.
 * Rechazar no pasa por acá: es cancelar, que además decide qué hacer con la
 * plata y devuelve el stock.
 */
export const acceptOnlineOrder = createServerFn({ method: "POST" })
  .middleware([requireCompany])
  .inputValidator(
    z.object({ orderId: z.number().int(), etaMinutes: z.number().int().min(5).max(240) }),
  )
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    assertCanOperateKitchen(user);

    const target = await pedidoVisible(user, data.orderId);
    if (target.channel !== "online") throw new Error("Ese pedido no es online");
    if (target.paymentMethod === "mercadopago" && target.paymentStatus !== "pagado") {
      throw new Error("El cliente todavía no terminó de pagar con Mercado Pago");
    }
    if (target.status === "cancelado") throw new Error("Ese pedido ya está cancelado");
    if (target.acceptedAt) return { ok: true };

    // Solo si sigue sin aceptar y sin cancelar: el cliente puede cancelarlo
    // desde su celular justo en este momento, y gana el que llega primero.
    const [r] = await db
      .update(orders)
      .set({ acceptedAt: new Date(), etaMinutes: data.etaMinutes })
      .where(
        and(eq(orders.id, data.orderId), isNull(orders.acceptedAt), ne(orders.status, "cancelado")),
      );
    if (((r as unknown as { affectedRows?: number }).affectedRows ?? 0) === 0) {
      const [ahora] = await db
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, data.orderId))
        .limit(1);
      if (ahora?.status === "cancelado") throw new Error("El cliente canceló este pedido");
    }
    return { ok: true };
  });

/** El pedido, si es de una sucursal que quien llama puede ver. */
async function pedidoVisible(user: SessionUser, orderId: number) {
  const locs = await visibleLocations(user);
  const locIds = locs.map((l) => l.id);
  if (locIds.length === 0) throw new Error("Ese pedido no es de una sucursal tuya");

  const [target] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      mpPaymentId: orders.mpPaymentId,
      channel: orders.channel,
      acceptedAt: orders.acceptedAt,
      locationId: orders.locationId,
      companyId: locations.companyId,
    })
    .from(orders)
    .innerJoin(locations, eq(locations.id, orders.locationId))
    .where(and(eq(orders.id, orderId), inArray(orders.locationId, locIds)))
    .limit(1);
  if (!target) throw new Error("Ese pedido no es de una sucursal tuya");
  return { ...target, locationName: locs.find((l) => l.id === target.locationId)?.name ?? "" };
}

/**
 * Le pregunta a Mercado Pago por un pedido puntual, a pedido de la cocina.
 *
 * Es el paso previo a marcar a mano un pedido de Mercado Pago: antes de dar por
 * hecho que el cliente pagó en la caja, se confirma que no haya pagado ya con
 * el celular.
 */
export const verifyOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireCompany])
  .inputValidator(z.object({ orderId: z.number().int() }))
  .handler(async ({ context, data }): Promise<{ pagado: boolean }> => {
    const user = context.user as SessionUser;
    assertCanViewKitchen(user);
    const target = await pedidoVisible(user, data.orderId);
    if (target.paymentStatus === "pagado") return { pagado: true };
    if (target.paymentMethod !== "mercadopago") return { pagado: false };

    const r = await verificarPagoMP(target.id, target.companyId);
    if (r === null) {
      throw new Error("No pudimos consultar a Mercado Pago. Probá de nuevo en unos segundos");
    }
    return { pagado: r };
  });

/**
 * Marca un pedido como cobrado (o lo vuelve a pendiente si se marcó por error).
 *
 * El efectivo se recibe en el mostrador, así que quien atiende es el que dice
 * "esto ya se pagó", y de ahí sale el cierre de caja.
 *
 * Mercado Pago no se marca a mano: lo confirma Mercado Pago. Si un pedido que
 * iba a pagarse con el celular se marca como cobrado, primero se le pregunta a
 * Mercado Pago; si el pago está, se acredita como tal, y si no, es que el
 * cliente terminó pagando en la caja y el pedido pasa a efectivo. Así el cierre
 * separa bien las dos cosas: lo de Mercado Pago tiene que coincidir con la
 * cuenta, y lo de efectivo con el cajón.
 */
export const setOrderPaid = createServerFn({ method: "POST" })
  .middleware([requireCompany])
  .inputValidator(z.object({ orderId: z.number().int(), paid: z.boolean() }))
  .handler(async ({ context, data }): Promise<{ ok: true; via: PaymentMethod | null }> => {
    const user = context.user as SessionUser;
    assertCanOperateKitchen(user);

    const target = await pedidoVisible(user, data.orderId);
    if (target.status === "cancelado") {
      throw new Error("Ese pedido está cancelado");
    }

    if (!data.paid) {
      if (target.mpPaymentId) {
        throw new Error(
          "Este pago lo confirmó Mercado Pago y no se puede desmarcar. Si hay que devolverlo, cancelá el pedido",
        );
      }
      if (target.paymentStatus !== "pagado") return { ok: true, via: null };
      await db
        .update(orders)
        .set({ paymentStatus: "pendiente" })
        .where(eq(orders.id, data.orderId));
      // Desmarcar un cobro saca plata del cierre de caja: es justo lo que
      // alguien querría revisar si la caja no cierra.
      await registrarAuditoria(user, {
        category: "cobros",
        action: "pedido.descobrar",
        summary: `Desmarcó como cobrado el pedido #${target.orderNumber} de ${target.locationName} (${pesosAuditoria(target.total)} en ${target.paymentMethod === "efectivo" ? "efectivo" : "Mercado Pago"})`,
        details: { orderId: target.id },
      });
      return { ok: true, via: null };
    }

    if (target.paymentStatus === "pagado") return { ok: true, via: target.paymentMethod };

    if (target.paymentMethod === "mercadopago") {
      const r = await verificarPagoMP(target.id, target.companyId);
      if (r) return { ok: true, via: "mercadopago" };
      if (r === null) {
        throw new Error(
          "No pudimos consultar a Mercado Pago, así que no sabemos si ya pagó con el celular. Probá de nuevo en unos segundos",
        );
      }
      await db
        .update(orders)
        .set({ paymentStatus: "pagado", paymentMethod: "efectivo" })
        .where(eq(orders.id, data.orderId));
      await registrarAuditoria(user, {
        category: "cobros",
        action: "pedido.mp_a_efectivo",
        summary: `Cobró en efectivo el pedido #${target.orderNumber} de ${target.locationName} (${pesosAuditoria(target.total)}), que era para Mercado Pago y Mercado Pago no registraba el pago`,
        details: { orderId: target.id },
      });
      return { ok: true, via: "efectivo" };
    }

    await db.update(orders).set({ paymentStatus: "pagado" }).where(eq(orders.id, data.orderId));
    return { ok: true, via: "efectivo" };
  });

/**
 * Cancela un pedido.
 *
 * Si ya estaba cobrado, el pedido queda en "reembolso pendiente": la plata se
 * devuelve a mano, por caja o por Mercado Pago, y el sistema solo deja anotado
 * que hay algo que devolver. No hay reembolso automático, está fuera de alcance.
 *
 * Un pedido cancelado no vuelve atrás: si el cliente se arrepiente del
 * arrepentimiento, se toma un pedido nuevo. Así el cierre de caja del día no
 * cambia después de hecho.
 */
export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireCompany])
  .inputValidator(z.object({ orderId: z.number().int() }))
  .handler(async ({ context, data }) => {
    const user = context.user as SessionUser;
    assertCanOperateKitchen(user);

    const target = await pedidoVisible(user, data.orderId);
    if (target.status === "cancelado") throw new Error("Ese pedido ya está cancelado");

    await db
      .update(orders)
      .set({
        status: "cancelado",
        cancelledAt: new Date(),
        cancelledBy: user.id,
        paymentStatus: target.paymentStatus === "pagado" ? "reembolso_pendiente" : "pendiente",
      })
      .where(eq(orders.id, data.orderId));

    // Lo que el pedido había descontado del stock vuelve. Se descuenta al
    // tomarlo, así que cancelar sin devolver dejaría el inventario corto para
    // siempre. Nunca puede voltear la cancelación: el pedido ya está cancelado
    // y el stock se arregla con un ajuste, al revés no.
    try {
      await devolverVenta(data.orderId);
    } catch (error) {
      console.error(`No se pudo devolver el stock del pedido ${data.orderId}:`, error);
    }

    await registrarAuditoria(user, {
      category: "pedidos",
      action: "pedido.cancelar",
      summary:
        `Canceló el pedido #${target.orderNumber} de ${target.locationName} (${pesosAuditoria(target.total)})` +
        (target.paymentStatus === "pagado" ? ", que ya estaba cobrado: queda para devolver" : ""),
      details: { orderId: target.id, paymentMethod: target.paymentMethod },
    });

    return { ok: true, reembolso: target.paymentStatus === "pagado" };
  });

export interface CashCloseLine {
  locationId: number;
  locationName: string;
  efectivoCobrado: number;
  mercadopagoCobrado: number;
  pendienteDeCobro: number;
  reembolsosPendientes: number;
  pedidos: number;
  cancelados: number;
}

export interface CashClose {
  desde: string;
  hasta: string;
  lines: CashCloseLine[];
  totalCobrado: number;
  totalPendiente: number;
  totalReembolsos: number;
  pedidos: number;
  cancelados: number;
}

/**
 * Cierre de caja de una jornada.
 *
 * Suma solo lo que efectivamente se cobró, separado por forma de pago, que es
 * lo que hay que comparar contra la caja física al cerrar. Los cancelados se
 * cuentan aparte y no suman a ningún total: no se facturaron. Lo que quedó
 * pendiente de cobro se muestra porque casi siempre es un pedido que se
 * entregó y nadie marcó, y conviene verlo antes de cerrar.
 *
 * Trabaja sobre business_date, no sobre la hora de creación: la jornada la
 * define el día del pedido. Acepta un rango de jornadas; para el cierre de un
 * día, desde y hasta son la misma fecha.
 */
export const getCashClose = createServerFn({ method: "GET" })
  .middleware([requireCompany])
  .inputValidator(
    z
      .object({
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .refine((d) => d.desde <= d.hasta, "La fecha desde no puede ser posterior a la fecha hasta"),
  )
  .handler(async ({ context, data }): Promise<CashClose> => {
    const user = context.user as SessionUser;
    assertCanViewKitchen(user);

    const locs = await visibleLocations(user);
    const vacio: CashClose = {
      desde: data.desde,
      hasta: data.hasta,
      lines: [],
      totalCobrado: 0,
      totalPendiente: 0,
      totalReembolsos: 0,
      pedidos: 0,
      cancelados: 0,
    };
    if (locs.length === 0) return vacio;

    const rows = await db
      .select({
        locationId: orders.locationId,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
      })
      .from(orders)
      .where(
        and(
          inArray(
            orders.locationId,
            locs.map((l) => l.id),
          ),
          gte(orders.businessDate, data.desde),
          lte(orders.businessDate, data.hasta),
        ),
      );

    const porLocal = new Map<number, CashCloseLine>();
    for (const l of locs) {
      porLocal.set(l.id, {
        locationId: l.id,
        locationName: l.name,
        efectivoCobrado: 0,
        mercadopagoCobrado: 0,
        pendienteDeCobro: 0,
        reembolsosPendientes: 0,
        pedidos: 0,
        cancelados: 0,
      });
    }

    for (const o of rows) {
      const linea = porLocal.get(o.locationId);
      if (!linea) continue;
      const monto = Number(o.total);

      if (o.status === "cancelado") {
        linea.cancelados++;
        if (o.paymentStatus === "reembolso_pendiente") linea.reembolsosPendientes += monto;
        continue;
      }

      linea.pedidos++;
      if (o.paymentStatus === "pagado") {
        if (o.paymentMethod === "efectivo") linea.efectivoCobrado += monto;
        else linea.mercadopagoCobrado += monto;
      } else {
        linea.pendienteDeCobro += monto;
      }
    }

    const lines = [...porLocal.values()].filter(
      (l) => l.pedidos > 0 || l.cancelados > 0 || l.reembolsosPendientes > 0,
    );

    return {
      desde: data.desde,
      hasta: data.hasta,
      lines,
      totalCobrado: lines.reduce((t, l) => t + l.efectivoCobrado + l.mercadopagoCobrado, 0),
      totalPendiente: lines.reduce((t, l) => t + l.pendienteDeCobro, 0),
      totalReembolsos: lines.reduce((t, l) => t + l.reembolsosPendientes, 0),
      pedidos: lines.reduce((t, l) => t + l.pedidos, 0),
      cancelados: lines.reduce((t, l) => t + l.cancelados, 0),
    };
  });

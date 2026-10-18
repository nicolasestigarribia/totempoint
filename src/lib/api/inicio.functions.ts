import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  deliveryTiers,
  locations,
  onlineSettings,
  orders,
  paymentSettings,
  products,
  totems,
  userRoles,
  users,
} from "@/db/schema";
import { requireCompany } from "@/lib/auth/middleware";
import type { SessionUser } from "@/lib/auth/session";
import { accessibleLocationIds, canView, companyIdOf, isOwner } from "@/lib/auth/scope";

/**
 * Un paso para dejar el local listo para vender. Lo que importa para que un
 * cliente pueda pedir va primero; lo opcional ("conectá Mercado Pago") se
 * marca así y no traba el "ya podés vender".
 */
export interface PasoInicio {
  id: string;
  titulo: string;
  detalle: string;
  listo: boolean;
  /** La sección del panel donde se hace, con su pestaña: "online:horario". */
  seccion: string;
  opcional: boolean;
}

export interface Inicio {
  /** El nombre de la empresa, para saludar. */
  empresa: string;
  /** Lo que contrató: la bienvenida habla solo de eso. */
  modulos: { online: boolean; totem: boolean; mesas: boolean };
  /** Lo de hoy en las sucursales que ve. Null si no tiene permiso de ver pedidos. */
  hoy: { pedidos: number; vendido: number; porAceptar: number } | null;
  /** El link para vender online (la portada), si la empresa tiene ese módulo. */
  link: string | null;
  /** Lo que falta para vender. Solo para el dueño. */
  pasos: PasoInicio[] | null;
}

/** La jornada de hoy, con el mismo reloj con que se numeran los pedidos. */
function diaDeHoy(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/**
 * La pantalla de entrada del panel: cómo viene el día, el link para compartir
 * y, para el dueño, qué le falta para vender. Es lo que necesita alguien que
 * recién empieza y no sabe por dónde arrancar.
 */
export const getInicio = createServerFn({ method: "GET" })
  .middleware([requireCompany])
  .handler(async ({ context }): Promise<Inicio> => {
    const user = context.user as SessionUser;
    const companyId = companyIdOf(user);
    const dueno = isOwner(user);

    const [empresa] = await db
      .select({
        nombre: companies.name,
        slug: companies.slug,
        alias: companies.onlineAlias,
        logo: companies.logoUrl,
        online: companies.onlineOrdering,
        totem: companies.totemEnabled,
        mesas: companies.mesasEnabled,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!empresa) throw new Error("No encontramos tu empresa");

    // Lo de hoy, solo en las sucursales que le tocan.
    let hoy: Inicio["hoy"] = null;
    if (dueno || canView(user, "comandera") || canView(user, "caja")) {
      const locs = await accessibleLocationIds(user);
      hoy = { pedidos: 0, vendido: 0, porAceptar: 0 };
      if (locs.length > 0) {
        const filas = await db
          .select({
            total: orders.total,
            channel: orders.channel,
            acceptedAt: orders.acceptedAt,
            paymentMethod: orders.paymentMethod,
            paymentStatus: orders.paymentStatus,
          })
          .from(orders)
          .where(
            and(
              inArray(orders.locationId, locs),
              eq(orders.businessDate, diaDeHoy()),
              ne(orders.status, "cancelado"),
            ),
          );
        for (const o of filas) {
          hoy.pedidos++;
          hoy.vendido += Number(o.total);
          // Uno online con Mercado Pago sin pagar todavía no llegó a la cocina.
          const esperandoPago =
            o.channel === "online" &&
            o.paymentMethod === "mercadopago" &&
            o.paymentStatus === "pendiente";
          if (o.channel !== "totem" && o.acceptedAt === null && !esperandoPago) hoy.porAceptar++;
        }
      }
    }

    const link = empresa.online ? `/${empresa.alias || `p/${empresa.slug}`}` : null;

    const modulos = { online: empresa.online, totem: empresa.totem, mesas: empresa.mesas };
    if (!dueno) return { empresa: empresa.nombre, modulos, hoy, link, pasos: null };

    const locIds = (
      await db
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.companyId, companyId))
    ).map((l) => l.id);

    const [[prods], online, tramos, [mp], [cantTotems], [equipo]] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          conFoto: sql<number>`sum(${products.photoUrl} is not null)`,
        })
        .from(products)
        .where(and(eq(products.companyId, companyId), eq(products.active, true))),
      db
        .select({
          alias: onlineSettings.alias,
          horarios: onlineSettings.horarios,
          delivery: onlineSettings.deliveryEnabled,
          lat: onlineSettings.originLat,
        })
        .from(onlineSettings)
        .where(eq(onlineSettings.companyId, companyId)),
      db
        .select({ locationId: deliveryTiers.locationId })
        .from(deliveryTiers)
        .where(eq(deliveryTiers.companyId, companyId)),
      db
        .select({ enabled: paymentSettings.mpEnabled, token: paymentSettings.mpAccessToken })
        .from(paymentSettings)
        .where(eq(paymentSettings.companyId, companyId))
        .limit(1),
      locIds.length
        ? db
            .select({ n: sql<number>`count(*)` })
            .from(totems)
            .where(inArray(totems.locationId, locIds))
        : Promise.resolve([{ n: 0 }]),
      db
        .select({ n: sql<number>`count(*)` })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .where(
          and(
            eq(users.companyId, companyId),
            eq(users.active, true),
            inArray(userRoles.role, ["encargado", "kitchen"]),
          ),
        ),
    ]);

    const totalProductos = Number(prods?.total ?? 0);
    const conFoto = Number(prods?.conFoto ?? 0);
    const pasos: PasoInicio[] = [
      {
        id: "logo",
        titulo: "Subí tu logo",
        detalle: "Es lo primero que ven tus clientes.",
        listo: !!empresa.logo,
        seccion: "empresa",
        opcional: false,
      },
      {
        id: "productos",
        titulo: "Cargá tus productos",
        detalle:
          totalProductos > 0
            ? `Tenés ${totalProductos} ${totalProductos === 1 ? "producto" : "productos"} a la venta.`
            : "Con nombre y precio alcanza para empezar.",
        listo: totalProductos > 0,
        seccion: "productos",
        opcional: false,
      },
      {
        id: "fotos",
        titulo: "Poneles foto",
        detalle:
          totalProductos > 0
            ? `${conFoto} de ${totalProductos} tienen foto. Con foto se venden más.`
            : "Con foto se venden más.",
        listo: totalProductos > 0 && conFoto === totalProductos,
        seccion: "productos",
        opcional: true,
      },
    ];
    if (empresa.online) {
      pasos.push(
        {
          id: "link",
          titulo: "Elegí tu link corto",
          detalle: "Uno fácil de dictar, como totempoint/tunegocio.",
          listo: !!empresa.alias || online.some((o) => !!o.alias),
          seccion: "online:links",
          opcional: false,
        },
        {
          id: "horario",
          titulo: "Cargá tu horario",
          detalle: "Fuera de horario no se toman pedidos.",
          listo: online.some((o) => (o.horarios ?? []).some((dia) => dia.length > 0)),
          seccion: "online:horario",
          opcional: false,
        },
        {
          id: "envios",
          titulo: "Configurá los envíos",
          detalle: "Hasta dónde llegás y cuánto cobrás. Si solo hacés retiro, salteá este paso.",
          listo: online.some((o) => o.delivery && o.lat !== null && tramos.length > 0),
          seccion: "online:entrega",
          opcional: true,
        },
      );
    }
    if (empresa.totem) {
      pasos.push({
        id: "totem",
        titulo: "Creá tu tótem",
        detalle: "El link que se abre en la tablet del mostrador.",
        listo: Number(cantTotems?.n ?? 0) > 0,
        seccion: "totems",
        opcional: false,
      });
    }
    pasos.push(
      {
        id: "mp",
        titulo: "Conectá Mercado Pago",
        detalle: "Para cobrar con QR o tarjeta. Sin esto, se cobra en efectivo.",
        listo: !!mp?.enabled && !!mp?.token,
        seccion: "pagos",
        opcional: true,
      },
      {
        id: "equipo",
        titulo: "Sumá a tu equipo",
        detalle: "Usuarios para la cocina o los encargados, cada uno con su permiso.",
        listo: Number(equipo?.n ?? 0) > 0,
        seccion: "operadores",
        opcional: true,
      },
    );

    return { empresa: empresa.nombre, modulos, hoy, link, pasos };
  });

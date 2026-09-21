import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, ne, asc, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  totemSettings,
  categories,
  products,
  combos,
  comboProducts,
  locations,
  totems,
  locationPrices,
  locationProducts,
  locationCategories,
  orders,
  orderItems,
  paymentSettings,
} from "@/db/schema";
import { destroySession } from "@/lib/auth/session";
import {
  crearPreferencia,
  buscarPagoDePedido,
  type ItemPreferencia,
} from "@/lib/payments/mercadopago";
import { acreditarPedido } from "@/lib/payments/acreditar";

/**
 * El access token de la empresa, o null si no tiene el cobro andando.
 *
 * Vive acá arriba y devuelve el token crudo porque este archivo es la capa
 * pública: cualquier cosa que lo use tiene que quedarse del lado del servidor
 * y no filtrarlo en lo que devuelve la server function.
 */
async function tokenDeMP(companyId: number): Promise<string | null> {
  const [row] = await db
    .select({ token: paymentSettings.mpAccessToken, enabled: paymentSettings.mpEnabled })
    .from(paymentSettings)
    .where(eq(paymentSettings.companyId, companyId))
    .limit(1);
  if (!row?.enabled || !row.token) return null;
  return row.token;
}

/**
 * De dónde se sirve el tótem, visto desde afuera.
 *
 * Hace falta para dos cosas que viajan hasta el celular del cliente: a dónde
 * vuelve después de pagar, y a dónde nos avisa Mercado Pago. Railway publica
 * su dominio en una variable; en local no hay nada público, y eso está
 * contemplado más abajo.
 */
function origenPublico(): string {
  const propia = process.env.PUBLIC_URL?.trim();
  if (propia) return propia.replace(/\/+$/, "");
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway}`;
  return "http://localhost:8081";
}

/**
 * La URL del webhook, o undefined si estamos en local.
 *
 * Mercado Pago no puede llamar a localhost, así que en desarrollo no se manda
 * ninguna: el tótem se entera igual porque pregunta por su cuenta cada unos
 * segundos. Esa consulta no es un parche para desarrollo, es el camino
 * confiable — el aviso puede perderse también en producción.
 */
function urlDeAviso(): string | undefined {
  const origen = origenPublico();
  if (origen.includes("localhost") || origen.includes("127.0.0.1")) return undefined;
  return `${origen}/api/mp/webhook`;
}

async function empresaCobraConMP(companyId: number): Promise<boolean> {
  return (await tokenDeMP(companyId)) !== null;
}

/**
 * La jornada de hoy como "YYYY-MM-DD", en la hora del servidor.
 *
 * Los pedidos se agrupan por día para la numeración y para el cierre de caja,
 * y eso tiene que salir del reloj del negocio, no del de la tablet: si no, dos
 * tótems con la hora corrida arrancarían jornadas distintas.
 */
function diaDeHoy(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

// Override de precio por local para un conjunto de ítems (producto o combo).
// Ausencia = usa el precio base. Devuelve un mapa itemId -> precio override.
async function priceOverrides(
  locationId: number | null,
  itemType: "product" | "combo",
  ids: number[],
): Promise<Map<number, string>> {
  if (!locationId || ids.length === 0) return new Map();
  const rows = await db
    .select({ itemId: locationPrices.itemId, price: locationPrices.price })
    .from(locationPrices)
    .where(
      and(
        eq(locationPrices.locationId, locationId),
        eq(locationPrices.itemType, itemType),
        inArray(locationPrices.itemId, ids),
      ),
    );
  return new Map(rows.map((r) => [r.itemId, r.price]));
}

// Capa pública: el tótem no tiene sesión, resuelve la empresa por slug de la URL.
// No usa requireAuth a propósito — devolvé sólo datos que puedan verse en pantalla.

export type TotemTemplate = "clasico" | "completo" | "split";

export type TotemThemeName = "oscuro" | "claro" | "calido" | "noche" | "arena" | "bosque";
export type TotemFontName = "impacto" | "elegante" | "moderno" | "redondeado" | "sobrio";
export type TotemCornersName = "redondeado" | "suave" | "recto";

export interface TotemHome {
  companyId: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  template: TotemTemplate;
  heroImageUrl: string | null;
  eyebrow: string | null;
  title: string;
  titleAccent: string | null;
  subtitle: string | null;
  ctaLabel: string;
  theme: TotemThemeName;
  fontTheme: TotemFontName;
  corners: TotemCornersName;
  badge1: string | null;
  badge2: string | null;
  accentColor: string | null;
}

// Los productos que el negocio no asignó a ninguna categoría se agrupan acá,
// para que nunca queden invisibles en el tótem.
export const UNCATEGORIZED = 0;

export interface TotemCategory {
  id: number;
  name: string;
  tagline: string | null;
  photoUrl: string | null;
  productCount: number;
}

export interface TotemProduct {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: string;
  photoUrl: string | null;
}

export interface TotemComboItem {
  name: string;
  quantity: number;
}

export interface TotemCombo {
  id: number;
  name: string;
  description: string | null;
  price: string;
  photoUrl: string | null;
  /** Qué trae el combo, para que el cliente sepa qué está comprando. */
  items: TotemComboItem[];
}

export interface TotemMenu {
  name: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string | null;
  theme: TotemThemeName;
  fontTheme: TotemFontName;
  corners: TotemCornersName;
  categories: TotemCategory[];
  products: TotemProduct[];
  combos: TotemCombo[];
  /**
   * Si esta empresa puede cobrar con Mercado Pago. Viaja como un booleano y
   * nunca la credencial: el tótem solo necesita saber si ofrece ese botón o no.
   */
  mercadoPago: boolean;
}

// Resuelve la URL /t/{empresa}/{local}/{totem} a una empresa y un local concretos.
// Valida que empresa, local y tótem existan y estén activos.
async function resolverTotem(empresaSlug: string, localSlug: string, totemNumber: number) {
  const [company] = await db
    .select({ id: companies.id, name: companies.name, slug: companies.slug, active: companies.active })
    .from(companies)
    .where(eq(companies.slug, empresaSlug))
    .limit(1);
  if (!company) throw new Error("No encontramos este comercio");
  if (!company.active) throw new Error("Este comercio no está disponible en este momento");

  const [location] = await db
    .select({ id: locations.id, active: locations.active })
    .from(locations)
    .where(and(eq(locations.companyId, company.id), eq(locations.slug, localSlug)))
    .limit(1);
  if (!location || !location.active) throw new Error("Este local no está disponible");

  const [totem] = await db
    .select({ id: totems.id, active: totems.active })
    .from(totems)
    .where(and(eq(totems.locationId, location.id), eq(totems.number, totemNumber)))
    .limit(1);
  if (!totem || !totem.active) throw new Error("Este tótem no está disponible");

  return { company, locationId: location.id };
}

const totemInput = {
  empresa: z.string().trim().min(1).max(60),
  local: z.string().trim().min(1).max(60),
  totem: z.number().int().positive(),
};

export const getTotemHome = createServerFn({ method: "GET" })
  .inputValidator(z.object(totemInput))
  .handler(async ({ data }): Promise<TotemHome> => {
    const resuelto = await resolverTotem(data.empresa, data.local, data.totem);
    const [row] = await db
      .select({
        company: companies,
        settings: totemSettings,
      })
      .from(companies)
      .leftJoin(totemSettings, eq(totemSettings.companyId, companies.id))
      .where(eq(companies.id, resuelto.company.id))
      .limit(1);

    if (!row) throw new Error("No encontramos este comercio");

    const s = row.settings;
    return {
      companyId: row.company.id,
      name: row.company.name,
      slug: row.company.slug,
      logoUrl: row.company.logoUrl,
      primaryColor: row.company.primaryColor,
      template: (s?.template as TotemTemplate) ?? "clasico",
      heroImageUrl: s?.heroImageUrl ?? null,
      eyebrow: s?.eyebrow ?? null,
      title: s?.title?.trim() || row.company.name,
      titleAccent: s?.titleAccent ?? null,
      subtitle: s?.subtitle ?? null,
      ctaLabel: s?.ctaLabel?.trim() || "Empezar pedido",
      badge1: s?.badge1 ?? null,
      badge2: s?.badge2 ?? null,
      accentColor: s?.accentColor ?? null,
      theme: s?.theme ?? "oscuro",
      fontTheme: s?.fontTheme ?? "impacto",
      corners: s?.corners ?? "redondeado",
    };
  });

export const getTotemMenu = createServerFn({ method: "GET" })
  .inputValidator(z.object(totemInput))
  .handler(async ({ data }): Promise<TotemMenu> => {
    const resuelto = await resolverTotem(data.empresa, data.local, data.totem);
    const companyId = resuelto.company.id;
    const locationId = resuelto.locationId;

    const [row] = await db
      .select({
        company: companies,
        accentColor: totemSettings.accentColor,
        theme: totemSettings.theme,
        fontTheme: totemSettings.fontTheme,
        corners: totemSettings.corners,
      })
      .from(companies)
      .leftJoin(totemSettings, eq(totemSettings.companyId, companies.id))
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!row) throw new Error("No encontramos este comercio");

    // Se traen con el override de disponibilidad de ESTE local: si el negocio
    // apagó un producto o una categoría acá, no tiene que aparecer en el tótem.
    // Ausencia de fila = disponible (hereda de .active).
    const [catRows, prodRows] = await Promise.all([
      db
        .select({
          id: categories.id,
          name: categories.name,
          tagline: categories.tagline,
          photoUrl: categories.photoUrl,
          available: locationCategories.available,
        })
        .from(categories)
        .leftJoin(
          locationCategories,
          and(
            eq(locationCategories.categoryId, categories.id),
            eq(locationCategories.locationId, locationId),
          ),
        )
        .where(and(eq(categories.companyId, companyId), eq(categories.active, true)))
        .orderBy(asc(categories.sort), asc(categories.name)),
      db
        .select({
          id: products.id,
          categoryId: products.categoryId,
          name: products.name,
          description: products.description,
          price: products.price,
          photoUrl: products.photoUrl,
          available: locationProducts.available,
        })
        .from(products)
        .leftJoin(
          locationProducts,
          and(
            eq(locationProducts.productId, products.id),
            eq(locationProducts.locationId, locationId),
          ),
        )
        .where(and(eq(products.companyId, companyId), eq(products.active, true)))
        .orderBy(asc(products.sort), asc(products.name)),
    ]);

    const cats = catRows.filter((c) => c.available !== false);
    const prods = prodRows.filter((p) => p.available !== false);

    const prodOverrides = await priceOverrides(
      locationId,
      "product",
      prods.map((p) => p.id),
    );
    const visibleProducts: TotemProduct[] = prods.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      photoUrl: p.photoUrl,
      price: prodOverrides.get(p.id) ?? p.price,
      categoryId: p.categoryId ?? UNCATEGORIZED,
    }));

    const totemCategories: TotemCategory[] = cats.map((c) => ({
      id: c.id,
      name: c.name,
      tagline: c.tagline,
      photoUrl: c.photoUrl,
      productCount: visibleProducts.filter((p) => p.categoryId === c.id).length,
    }));

    // Combos: van con el detalle de lo que traen, para que el cliente sepa qué
    // está comprando sin tener que abrir nada.
    const comboRows = await db
      .select({
        id: combos.id,
        name: combos.name,
        description: combos.description,
        price: combos.price,
        photoUrl: combos.photoUrl,
      })
      .from(combos)
      .where(and(eq(combos.companyId, companyId), eq(combos.active, true)))
      .orderBy(asc(combos.sort), asc(combos.name));

    const comboItems = comboRows.length
      ? await db
          .select({
            comboId: comboProducts.comboId,
            quantity: comboProducts.quantity,
            name: products.name,
          })
          .from(comboProducts)
          .innerJoin(products, eq(products.id, comboProducts.productId))
          .where(
            inArray(
              comboProducts.comboId,
              comboRows.map((c) => c.id),
            ),
          )
      : [];

    const comboOverrides = await priceOverrides(
      locationId,
      "combo",
      comboRows.map((c) => c.id),
    );
    const totemCombos: TotemCombo[] = comboRows.map((c) => ({
      ...c,
      price: comboOverrides.get(c.id) ?? c.price,
      items: comboItems
        .filter((i) => i.comboId === c.id)
        .map((i) => ({ name: i.name, quantity: i.quantity })),
    }));

    const looseCount = visibleProducts.filter((p) => p.categoryId === UNCATEGORIZED).length;
    if (looseCount > 0) {
      totemCategories.push({
        id: UNCATEGORIZED,
        name: "Otros",
        tagline: "Del menú",
        photoUrl: null,
        productCount: looseCount,
      });
    }

    return {
      name: row.company.name,
      slug: row.company.slug,
      logoUrl: row.company.logoUrl,
      accentColor: row.accentColor ?? row.company.primaryColor,
      theme: row.theme ?? "oscuro",
      fontTheme: row.fontTheme ?? "impacto",
      corners: row.corners ?? "redondeado",
      categories: totemCategories.filter((c) => c.productCount > 0),
      products: visibleProducts,
      combos: totemCombos,
      mercadoPago: await empresaCobraConMP(companyId),
    };
  });

// El tótem manda sólo qué productos y cuántos: los precios y el total se
// calculan acá con los datos de la base, nunca con lo que llega del cliente.
export const createTotemOrder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ...totemInput,
      customerName: z.string().trim().min(1).max(120),
      deliveryMethod: z.enum(["local", "mostrador"]),
      paymentMethod: z.enum(["efectivo", "mercadopago"]),
      comments: z.string().trim().max(500).optional(),
      // Cada línea es un producto suelto o un combo. El precio no viaja nunca:
      // se recalcula acá contra la base.
      items: z
        .array(
          z.object({
            kind: z.enum(["producto", "combo"]),
            id: z.number().int(),
            quantity: z.number().int().min(1).max(50),
          }),
        )
        .min(1),
    }),
  )
  .handler(
    async ({ data }): Promise<{ orderId: number; orderNumber: number; pagarEn: string | null }> => {
      const resuelto = await resolverTotem(data.empresa, data.local, data.totem);
      const company = resuelto.company;
      const location = { id: resuelto.locationId };

      const productIds = data.items.filter((i) => i.kind === "producto").map((i) => i.id);
      const comboIds = data.items.filter((i) => i.kind === "combo").map((i) => i.id);

      const productRows = productIds.length
        ? await db
            .select({ id: products.id, name: products.name, price: products.price })
            .from(products)
            .where(
              and(
                eq(products.companyId, company.id),
                eq(products.active, true),
                inArray(products.id, productIds),
              ),
            )
        : [];

      const comboRows = comboIds.length
        ? await db
            .select({ id: combos.id, name: combos.name, price: combos.price })
            .from(combos)
            .where(
              and(
                eq(combos.companyId, company.id),
                eq(combos.active, true),
                inArray(combos.id, comboIds),
              ),
            )
        : [];

      if (productRows.length !== productIds.length || comboRows.length !== comboIds.length) {
        throw new Error("Algo de tu pedido ya no está disponible");
      }

      // Precio efectivo del local: override por local si existe, si no el base.
      const [prodOverrides, comboOverrides] = await Promise.all([
        priceOverrides(location.id, "product", productIds),
        priceOverrides(location.id, "combo", comboIds),
      ]);

      // El combo se guarda como una línea con su propio precio y sin product_id:
      // order_items ya congela nombre y precio, así que el pedido queda fiel
      // aunque después se cambie el combo.
      const priced = data.items.map((item) => {
        if (item.kind === "combo") {
          const combo = comboRows.find((c) => c.id === item.id)!;
          return {
            productId: null,
            productName: combo.name,
            unitPrice: comboOverrides.get(combo.id) ?? combo.price,
            quantity: item.quantity,
          };
        }
        const product = productRows.find((r) => r.id === item.id)!;
        return {
          productId: product.id,
          productName: product.name,
          unitPrice: prodOverrides.get(product.id) ?? product.price,
          quantity: item.quantity,
        };
      });

      const total = priced.reduce((t, i) => t + Number(i.unitPrice) * i.quantity, 0);

      const jornada = diaDeHoy();

      const creado = await db.transaction(async (tx) => {
        // La numeración arranca en 1 cada mañana y por local: el cliente ve un
        // número corto y el local no arrastra los miles del mes pasado. El id
        // interno sigue siendo el autoincremental, que nunca se repite.
        const [{ last }] = await tx
          .select({ last: sql<number | null>`MAX(${orders.orderNumber})` })
          .from(orders)
          .where(and(eq(orders.locationId, location.id), eq(orders.businessDate, jornada)));

        const orderNumber = (last ?? 0) + 1;

        const [{ id: orderId }] = await tx
          .insert(orders)
          .values({
            locationId: location.id,
            orderNumber,
            businessDate: jornada,
            customerName: data.customerName.trim(),
            deliveryMethod: data.deliveryMethod,
            comments: data.comments?.trim() || null,
            status: "recibido",
            total: total.toFixed(2),
            paymentMethod: data.paymentMethod,
            // Nada se cobra desde el tótem todavía: el efectivo se cobra en el
            // mostrador y Mercado Pago no está integrado.
            paymentStatus: "pendiente",
          })
          .$returningId();

        await tx.insert(orderItems).values(priced.map((p) => ({ orderId, ...p })));

        return { orderId, orderNumber };
      });

      // El pedido ya está guardado. Si es con Mercado Pago, recién ahora se pide
      // la preferencia: así, si Mercado Pago está caído, el pedido no se pierde
      // y el mostrador lo puede cobrar en efectivo igual.
      if (data.paymentMethod === "mercadopago") {
        const token = await tokenDeMP(company.id);
        if (!token)
          throw new Error("Este comercio no está cobrando con Mercado Pago en este momento");

        const items: ItemPreferencia[] = priced.map((p) => ({
          title: p.productName,
          quantity: p.quantity,
          unitPrice: Number(p.unitPrice),
        }));

        const volverA = `${origenPublico()}/t/${data.empresa}/${data.local}/${data.totem}/listo/${creado.orderId}`;
        const aviso = urlDeAviso();

        const pref = await crearPreferencia({
          accessToken: token,
          items,
          externalReference: String(creado.orderId),
          backUrl: volverA,
          notificationUrl: aviso,
          negocio: company.name,
          numeroPedido: creado.orderNumber,
        });

        await db
          .update(orders)
          .set({ mpPreferenceId: pref.id })
          .where(eq(orders.id, creado.orderId));

        return { ...creado, pagarEn: pref.initPoint };
      }

      return { ...creado, pagarEn: null as string | null };
    },
  );

export interface TotemOrderSummary {
  orderNumber: number;
  customerName: string;
  status: "recibido" | "preparacion" | "entregado" | "cancelado";
  total: string;
  companyName: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string | null;
  theme: TotemThemeName;
  fontTheme: TotemFontName;
  corners: TotemCornersName;
}

export const getTotemOrder = createServerFn({ method: "GET" })
  .inputValidator(z.object({ ...totemInput, orderId: z.number().int() }))
  .handler(async ({ data }): Promise<TotemOrderSummary> => {
    const resuelto = await resolverTotem(data.empresa, data.local, data.totem);
    const [row] = await db
      .select({
        orderNumber: orders.orderNumber,
        customerName: orders.customerName,
        status: orders.status,
        total: orders.total,
        companyName: companies.name,
        slug: companies.slug,
        logoUrl: companies.logoUrl,
        primaryColor: companies.primaryColor,
        accentColor: totemSettings.accentColor,
        theme: totemSettings.theme,
        fontTheme: totemSettings.fontTheme,
        corners: totemSettings.corners,
      })
      .from(orders)
      .innerJoin(locations, eq(locations.id, orders.locationId))
      .innerJoin(companies, eq(companies.id, locations.companyId))
      .leftJoin(totemSettings, eq(totemSettings.companyId, companies.id))
      .where(and(eq(orders.id, data.orderId), eq(orders.locationId, resuelto.locationId)))
      .limit(1);

    if (!row) throw new Error("No encontramos ese pedido");

    return {
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      status: row.status,
      total: row.total,
      companyName: row.companyName,
      slug: row.slug,
      logoUrl: row.logoUrl,
      accentColor: row.accentColor ?? row.primaryColor,
      theme: row.theme ?? "oscuro",
      fontTheme: row.fontTheme ?? "impacto",
      corners: row.corners ?? "redondeado",
    };
  });

/**
 * Si el pedido ya está pagado. La mira el tótem mientras el cliente escanea.
 *
 * Pregunta primero a nuestra base, porque puede que el webhook ya lo haya
 * acreditado, y solo si sigue pendiente le pregunta a Mercado Pago. Así el
 * cliente no queda esperando cuando el aviso se pierde, que es lo que
 * inevitablemente pasa alguna vez.
 *
 * Es pública como todo este archivo: devuelve si un pedido está pagado y nada
 * más, sin montos ni datos de quien pagó.
 */
export const getTotemPaymentStatus = createServerFn({ method: "GET" })
  .inputValidator(z.object({ ...totemInput, orderId: z.number().int() }))
  .handler(async ({ data }): Promise<{ pagado: boolean; cancelado: boolean }> => {
    const resuelto = await resolverTotem(data.empresa, data.local, data.totem);
    const [row] = await db
      .select({
        id: orders.id,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        companyId: companies.id,
      })
      .from(orders)
      .innerJoin(locations, eq(locations.id, orders.locationId))
      .innerJoin(companies, eq(companies.id, locations.companyId))
      .where(and(eq(orders.id, data.orderId), eq(orders.locationId, resuelto.locationId)))
      .limit(1);

    if (!row) throw new Error("No encontramos ese pedido");

    if (row.paymentStatus === "pagado") return { pagado: true, cancelado: false };
    if (row.status === "cancelado") return { pagado: false, cancelado: true };
    if (row.paymentMethod !== "mercadopago") return { pagado: false, cancelado: false };

    const token = await tokenDeMP(row.companyId);
    if (!token) return { pagado: false, cancelado: false };

    try {
      const pago = await buscarPagoDePedido(token, String(row.id));
      if (pago?.aprobado) {
        await acreditarPedido(row.id, pago.id);
        return { pagado: true, cancelado: false };
      }
    } catch {
      // Si Mercado Pago no contesta, el tótem sigue esperando y vuelve a
      // preguntar: no hay por qué romperle la pantalla al cliente.
    }

    return { pagado: false, cancelado: false };
  });

/**
 * Cierra la sesión de panel que haya quedado abierta en este dispositivo.
 *
 * La llama la portada del tótem cuando la tablet está marcada como tótem. Sin
 * esto, el dueño que entra al panel desde la tablet del mostrador para tocar
 * algo y no cierra sesión deja el panel a mano de cualquiera que escriba
 * /admin: la pantalla del tótem no tiene salida, pero la barra de direcciones
 * sí.
 *
 * Es pública a propósito, como el resto de este archivo: lo único que puede
 * hacer quien la llame es desloguearse a sí mismo.
 */
export const leaveStaffSession = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true };
});

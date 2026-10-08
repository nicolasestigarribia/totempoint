import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and, ne, asc, inArray, isNull, sql } from "drizzle-orm";
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
  locationCombos,
  orders,
  orderItems,
  orderItemRemovals,
  orderItemExtras,
  orderItemElecciones,
  productIngredients,
  ingredients,
  paymentSettings,
  onlineSettings,
  deliveryTiers,
  customers,
} from "@/db/schema";
import { destroySession } from "@/lib/auth/session";
import {
  crearPreferencia,
  buscarPagoDePedido,
  type ItemPreferencia,
} from "@/lib/payments/mercadopago";
import { acreditarPedido } from "@/lib/payments/acreditar";
import { MAX_POR_LINEA, PRECIOS_CAMBIARON } from "@/lib/pedido-reglas";
import { estadoHorario, type Horarios } from "@/lib/horario";
import {
  calcularRegalo,
  type ParteRegalo,
  type ReglaRegalo,
  type UnidadesConRegalo,
} from "@/lib/regalo";
import { distanciaKm, cotizarEnvio, formatearDistancia } from "@/lib/delivery";
import { distanciaPorRutaKm } from "@/lib/maps/distance-server";
import { registrarError } from "@/lib/logs/registrar";
import {
  calcularConsumo,
  registrarVenta,
  asegurarCodigosDeVenta,
  devolverVenta,
  type LineaVendida,
  type ConsumoVenta,
} from "@/lib/stock/venta";
import {
  productosAgotados,
  faltantesDeStock,
  StockInsuficiente,
  mismoItem,
} from "@/lib/stock/control";

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

/**
 * Los productos de esta lista que el local tiene apagados.
 *
 * Un producto no se vende acá si el negocio lo apagó para este local, o si
 * apagó la categoría entera. Ausencia de fila significa disponible: hereda de
 * `product.active`, que ya se chequeó antes de llegar hasta acá.
 *
 * Existe porque la disponibilidad tiene que decidirse en los dos lados. El
 * menú la aplica para no mostrar lo que no hay, pero el carrito vive en la
 * tablet y sobrevive a que alguien apague un producto desde el panel: sin este
 * control, ese carrito entraba igual y la cocina recibía algo que el local no
 * tiene.
 */
async function productosApagadosEnElLocal(
  locationId: number,
  productos: { id: number; categoryId: number | null }[],
): Promise<Set<number>> {
  if (productos.length === 0) return new Set();

  const ids = productos.map((p) => p.id);
  const categoriaIds = [...new Set(productos.map((p) => p.categoryId).filter((c) => c !== null))];

  const [porProducto, porCategoria] = await Promise.all([
    db
      .select({ productId: locationProducts.productId })
      .from(locationProducts)
      .where(
        and(
          eq(locationProducts.locationId, locationId),
          eq(locationProducts.available, false),
          inArray(locationProducts.productId, ids),
        ),
      ),
    categoriaIds.length
      ? db
          .select({ categoryId: locationCategories.categoryId })
          .from(locationCategories)
          .where(
            and(
              eq(locationCategories.locationId, locationId),
              eq(locationCategories.available, false),
              inArray(locationCategories.categoryId, categoriaIds),
            ),
          )
      : Promise.resolve([]),
  ]);

  const categoriasApagadas = new Set(porCategoria.map((c) => c.categoryId));
  const apagados = new Set(porProducto.map((p) => p.productId));
  for (const p of productos) {
    if (p.categoryId !== null && categoriasApagadas.has(p.categoryId)) apagados.add(p.id);
  }
  return apagados;
}

/**
 * Los combos de esta lista que el local no puede vender.
 *
 * Son dos cosas distintas y las dos cuentan. Una es el interruptor de la
 * sección Disponibilidad, que apaga el combo para este local y nada más. La
 * otra no se guarda en ninguna tabla: si el local tiene apagado alguno de los
 * productos que el combo lleva adentro, no puede armarlo, así que el combo se
 * cae solo. Guardarlo sería peor — habría que acordarse de apagar a mano cada
 * combo cada vez que se apaga un producto, y el día que alguien se olvide el
 * cliente compra algo que el mostrador no puede entregar.
 */
async function combosApagadosEnElLocal(
  locationId: number,
  comboIds: number[],
): Promise<Set<number>> {
  if (comboIds.length === 0) return new Set();

  const [override, componentes] = await Promise.all([
    db
      .select({ comboId: locationCombos.comboId })
      .from(locationCombos)
      .where(
        and(
          eq(locationCombos.locationId, locationId),
          eq(locationCombos.available, false),
          inArray(locationCombos.comboId, comboIds),
        ),
      ),
    db
      .select({
        comboId: comboProducts.comboId,
        productId: products.id,
        categoryId: products.categoryId,
        activo: products.active,
      })
      .from(comboProducts)
      .innerJoin(products, eq(products.id, comboProducts.productId))
      .where(inArray(comboProducts.comboId, comboIds)),
  ]);

  const apagados = new Set(override.map((o) => o.comboId));

  const [productosApagados, agotados] = await Promise.all([
    productosApagadosEnElLocal(
      locationId,
      componentes.map((c) => ({ id: c.productId, categoryId: c.categoryId })),
    ),
    productosAgotados(
      locationId,
      componentes.map((c) => c.productId),
    ),
  ]);
  for (const c of componentes) {
    // Un componente dado de baja en toda la empresa también deja el combo sin
    // qué entregar, no sólo uno apagado en este local. Lo mismo uno agotado.
    if (!c.activo || productosApagados.has(c.productId) || agotados.has(c.productId)) {
      apagados.add(c.comboId);
    }
  }
  return apagados;
}

// Capa pública: el tótem no tiene sesión, resuelve la empresa por slug de la URL.
// No usa requireAuth a propósito — devolvé sólo datos que puedan verse en pantalla.

export type TotemTemplate = "clasico" | "completo" | "split";

export type TotemThemeName = "oscuro" | "claro" | "calido" | "noche" | "arena" | "bosque";
export type TotemFontName =
  | "impacto"
  | "elegante"
  | "moderno"
  | "redondeado"
  | "sobrio"
  | "geometrica";
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

/** Un ingrediente que el cliente puede sacar de un producto. */
export interface TotemRemovable {
  id: number;
  name: string;
}

/** Un ingrediente que el cliente puede pedir de más, con su precio y su tope. */
export interface TotemExtra {
  id: number;
  name: string;
  /** Precio de UNA unidad extra de este ingrediente en este producto. */
  price: string;
  /** Cuántas unidades extra como mucho. */
  max: number;
}

export interface TotemProduct {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: string;
  photoUrl: string | null;
  /**
   * Qué se le puede sacar a este producto. Vacío significa que viene como
   * viene: o el dueño no lo habilitó para personalizar, o no marcó ningún
   * ingrediente como quitable. Sacar algo nunca cambia el precio.
   */
  removables: TotemRemovable[];
  /**
   * Qué se le puede agregar de más. Vacío = nada configurable para sumar. A
   * diferencia de sacar, el extra cuesta (su `price`) y tiene tope (`max`).
   */
  extras: TotemExtra[];
  /**
   * El pan: "ambos" si el cliente elige blanco o negro al pedirlo; "blanco" o
   * "negro" si se hace solo en ese (se muestra, no se elige); null si no aplica.
   */
  pan: "blanco" | "negro" | "ambos" | null;
  /** "Cada 12, 2 de regalo", si su categoría lo tiene. */
  regalo: ReglaRegalo | null;
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
  /** Lo que un combo suma para el regalo: "12 clásicos" son 12 de miga. */
  regalo: UnidadesConRegalo[];
  /**
   * Lo que el cliente elige adentro ("18 empanadas clásicas"), con los gustos
   * que puede elegir hoy en esta sucursal. Vacío = combo de gustos fijos.
   */
  grupos: TotemComboGrupo[];
}

export interface TotemComboGrupo {
  /** Su posición en el combo: es lo que viaja en el pedido. */
  indice: number;
  nombre: string;
  cantidad: number;
  opciones: { id: number; name: string; description: string | null }[];
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
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      active: companies.active,
      totemEnabled: companies.totemEnabled,
    })
    .from(companies)
    .where(eq(companies.slug, empresaSlug))
    .limit(1);
  if (!company) throw new Error("No encontramos este comercio");
  if (!company.active) throw new Error("Este comercio no está disponible en este momento");
  // El tótem es un módulo: una empresa que solo contrató el pedido online no
  // tiene tablets, y una URL de tótem vieja no puede seguir tomando pedidos.
  if (!company.totemEnabled) throw new Error("Este comercio no tiene tótem");

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

  return { company, locationId: location.id, totemId: totem.id };
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
    const menu = await armarMenu(resuelto.company.id, resuelto.locationId);
    // Los combos a elección todavía no tienen pantalla en el tótem: se venden
    // por el pedido online. Sin esto, la tablet los agregaría sin gustos y el
    // servidor los rechazaría al confirmar.
    return { ...menu, combos: menu.combos.filter((c) => c.grupos.length === 0) };
  });

/**
 * El menú de una sucursal tal como lo ve el cliente: lo que está activo, lo que
 * esta sucursal no apagó, con sus precios propios y lo que se puede sacar o
 * agregar. Lo usan el tótem y el pedido online, que venden lo mismo.
 */
/**
 * Lo que se le manda a Mercado Pago. Mercado Pago no acepta líneas negativas,
 * así que con regalo el pedido va como una sola línea por lo que se paga: si no,
 * le cobraría los sándwiches que eran gratis.
 */
function itemsParaMP(
  lineas: ItemPreferencia[],
  descuento: number,
  envio: number,
): ItemPreferencia[] {
  const items: ItemPreferencia[] =
    descuento > 0
      ? [
          {
            title: "Tu pedido (con sándwiches de regalo)",
            quantity: 1,
            unitPrice: lineas.reduce((t, l) => t + l.unitPrice * l.quantity, 0) - descuento,
          },
        ]
      : lineas;
  if (envio > 0) items.push({ title: "Envío", quantity: 1, unitPrice: envio });
  return items;
}

/** La regla de regalo de cada categoría de la empresa que tiene una. */
async function reglasDeRegalo(companyId: number): Promise<Map<number, ReglaRegalo>> {
  const filas = await db
    .select({
      id: categories.id,
      cada: categories.regaloCada,
      cantidad: categories.regaloCantidad,
    })
    .from(categories)
    .where(eq(categories.companyId, companyId));
  return new Map(
    filas
      .filter((f) => f.cada && f.cantidad)
      .map((f) => [f.id, { cada: f.cada!, cantidad: f.cantidad! }]),
  );
}

/** Lo que suma para el regalo una unidad de cada combo, por lo que trae adentro. */
async function regaloDeCombos(
  comboIds: number[],
  reglas: Map<number, ReglaRegalo>,
): Promise<Map<number, UnidadesConRegalo[]>> {
  const porCombo = new Map<number, UnidadesConRegalo[]>();
  if (comboIds.length === 0 || reglas.size === 0) return porCombo;
  const componentes = await db
    .select({
      comboId: comboProducts.comboId,
      quantity: comboProducts.quantity,
      categoryId: products.categoryId,
    })
    .from(comboProducts)
    .innerJoin(products, eq(products.id, comboProducts.productId))
    .where(inArray(comboProducts.comboId, comboIds));
  for (const c of componentes) {
    const regla = c.categoryId !== null ? reglas.get(c.categoryId) : undefined;
    if (!regla) continue;
    const lista = porCombo.get(c.comboId) ?? [];
    lista.push({ regla, unidades: c.quantity });
    porCombo.set(c.comboId, lista);
  }
  return porCombo;
}

async function armarMenu(companyId: number, locationId: number): Promise<TotemMenu> {
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
        customizable: products.customizable,
        pan: products.pan,
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
  // Un producto se cae también si su categoría está apagada en este local:
  // sin tarjeta de categoría el cliente no llega a él, pero seguía viajando
  // en `products` y el carrito podía quedar con algo que el local no tiene.
  const categoriasVisibles = new Set(cats.map((c) => c.id));
  const habilitados = prodRows.filter(
    (p) => p.available !== false && (p.categoryId === null || categoriasVisibles.has(p.categoryId)),
  );
  // Lo agotado en esta sucursal tampoco se ofrece: el cliente no tiene que
  // poder elegir algo que la cocina no puede hacer.
  const agotados = await productosAgotados(
    locationId,
    habilitados.map((p) => p.id),
  );
  const prods = habilitados.filter((p) => !agotados.has(p.id));

  const prodOverrides = await priceOverrides(
    locationId,
    "product",
    prods.map((p) => p.id),
  );

  // Lo que se puede sacar, sólo de los productos habilitados para eso. Un
  // ingrediente marcado como quitable en un producto que no es configurable
  // no llega a la pantalla: mandan las dos condiciones, no una.
  const configurables = prods.filter((p) => p.customizable).map((p) => p.id);
  const quitables = configurables.length
    ? await db
        .select({
          productId: productIngredients.productId,
          id: ingredients.id,
          name: ingredients.name,
        })
        .from(productIngredients)
        .innerJoin(ingredients, eq(ingredients.id, productIngredients.ingredientId))
        .where(
          and(
            eq(productIngredients.removable, true),
            eq(ingredients.active, true),
            inArray(productIngredients.productId, configurables),
          ),
        )
        .orderBy(asc(ingredients.name))
    : [];

  // Lo que se puede agregar de más, con su precio y su tope. Mismo gate que
  // los quitables (el producto tiene que ser configurable), y además el
  // ingrediente marcado como extra con precio y máximo cargados.
  const agregables = configurables.length
    ? await db
        .select({
          productId: productIngredients.productId,
          id: ingredients.id,
          name: ingredients.name,
          price: productIngredients.extraPrice,
          max: productIngredients.extraMax,
        })
        .from(productIngredients)
        .innerJoin(ingredients, eq(ingredients.id, productIngredients.ingredientId))
        .where(
          and(
            eq(productIngredients.extraAllowed, true),
            eq(ingredients.active, true),
            inArray(productIngredients.productId, configurables),
          ),
        )
        .orderBy(asc(ingredients.name))
    : [];

  const reglas = await reglasDeRegalo(companyId);
  const visibleProducts: TotemProduct[] = prods.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    photoUrl: p.photoUrl,
    price: prodOverrides.get(p.id) ?? p.price,
    categoryId: p.categoryId ?? UNCATEGORIZED,
    pan: p.pan,
    regalo: (p.categoryId !== null && reglas.get(p.categoryId)) || null,
    removables: p.customizable
      ? quitables.filter((q) => q.productId === p.id).map((q) => ({ id: q.id, name: q.name }))
      : [],
    // Sólo los que tienen precio y tope > 0: un extra sin precio o sin cupo no
    // se puede ofrecer bien, así que no llega a la pantalla.
    extras: p.customizable
      ? agregables
          .filter((a) => a.productId === p.id && a.price !== null && (a.max ?? 0) > 0)
          .map((a) => ({ id: a.id, name: a.name, price: a.price!, max: a.max! }))
      : [],
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
      grupos: combos.grupos,
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

  // Los que este local no puede armar no llegan a la pantalla.
  const combosApagados = await combosApagadosEnElLocal(
    locationId,
    comboRows.map((c) => c.id),
  );
  const combosVendibles = comboRows.filter((c) => !combosApagados.has(c.id));

  const comboOverrides = await priceOverrides(
    locationId,
    "combo",
    combosVendibles.map((c) => c.id),
  );
  const regaloCombos = await regaloDeCombos(
    combosVendibles.map((c) => c.id),
    reglas,
  );
  const totemCombos: TotemCombo[] = combosVendibles
    .map(({ grupos, ...c }) => ({
      ...c,
      price: comboOverrides.get(c.id) ?? c.price,
      regalo: regaloCombos.get(c.id) ?? [],
      items: comboItems
        .filter((i) => i.comboId === c.id)
        .map((i) => ({ name: i.name, quantity: i.quantity })),
      // Los gustos que se pueden elegir son los que esta sucursal vende hoy:
      // lo apagado o agotado no se ofrece adentro del combo tampoco.
      grupos: (grupos ?? []).map((g, indice) => ({
        indice,
        nombre: g.nombre,
        cantidad: g.cantidad,
        opciones: visibleProducts
          .filter((p) => g.categoriaIds.includes(p.categoryId))
          .map((p) => ({ id: p.id, name: p.name, description: p.description })),
      })),
    }))
    // Un combo con algo para elegir y nada que se pueda elegir no se vende.
    .filter((c) => c.grupos.every((g) => g.opciones.length > 0));

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
}

/**
 * Una línea del pedido tal como la manda el cliente: qué y cuántos, y lo que
 * sacó o agregó. El precio no viaja nunca: se recalcula acá contra la base.
 */
const lineaPedido = z.object({
  kind: z.enum(["producto", "combo"]),
  id: z.number().int(),
  quantity: z
    .number()
    .int()
    .min(1)
    .max(MAX_POR_LINEA, `Podés pedir hasta ${MAX_POR_LINEA} de cada cosa`),
  // El pan que eligió, solo en los productos que se hacen en blanco o negro.
  // En los demás se ignora: manda lo que diga el producto.
  pan: z.enum(["blanco", "negro"]).optional(),
  // Los gustos de un combo a elección: de qué grupo, qué producto y cuántos.
  // Se validan abajo contra el combo; el cliente no decide qué se puede elegir.
  elecciones: z
    .array(
      z.object({
        grupo: z.number().int().min(0),
        productId: z.number().int(),
        quantity: z.number().int().min(1).max(200),
      }),
    )
    .max(60)
    .optional(),
  // Los ingredientes que el cliente sacó de esta línea. Se valida abajo
  // contra la receta: el cliente no elige qué se puede sacar.
  removedIngredientIds: z.array(z.number().int()).max(30).optional(),
  // Los extras que pidió: id del ingrediente y cuántos. El precio y el tope no
  // viajan: se validan y recalculan abajo contra la receta.
  extras: z
    .array(z.object({ id: z.number().int(), quantity: z.number().int().min(1).max(20) }))
    .max(30)
    .optional(),
});

type LineaPedido = z.infer<typeof lineaPedido>;

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
      items: z.array(lineaPedido).min(1),
    }),
  )
  .handler(
    async ({ data }): Promise<{ orderId: number; orderNumber: number; pagarEn: string | null }> => {
      const resuelto = await resolverTotem(data.empresa, data.local, data.totem);
      const tomado = await tomarPedido({
        company: resuelto.company,
        locationId: resuelto.locationId,
        totemId: resuelto.totemId,
        channel: "totem",
        customerName: data.customerName,
        deliveryMethod: data.deliveryMethod,
        paymentMethod: data.paymentMethod,
        comments: data.comments,
        items: data.items,
        volverA: ({ orderId }) => `/t/${data.empresa}/${data.local}/${data.totem}/listo/${orderId}`,
      });
      return { orderId: tomado.orderId, orderNumber: tomado.orderNumber, pagarEn: tomado.pagarEn };
    },
  );

/** Lo que el canal online suma a un pedido: quién es y cómo le llega. */
interface DatosOnline {
  phone: string;
  /** El envío, ya cotizado acá contra los tramos de la sucursal. Null si retira. */
  envio: {
    fee: number;
    km: number;
    address: string;
    details: string | null;
    lat: number;
    lng: number;
    /** El punto es solo la calle: el repartidor se guía por la dirección. */
    aproximada: boolean;
  } | null;
  paysWith: number | null;
  /** Mínimo de la sucursal, sobre lo pedido y sin el envío. */
  minOrder: number;
  /** Cliente registrado al que se liga el pedido (null si no quiso guardar datos). */
  customerId: number | null;
}

interface PedidoATomar {
  company: { id: number; name: string };
  locationId: number;
  totemId: number | null;
  channel: "totem" | "online";
  customerName: string;
  deliveryMethod: "local" | "mostrador" | "envio";
  paymentMethod: "efectivo" | "mercadopago";
  comments?: string;
  items: LineaPedido[];
  online?: DatosOnline;
  /**
   * El total que le mostró el celular al cliente. Si no coincide con el que se
   * calcula acá (cambió un precio mientras armaba el pedido), se le avisa en vez
   * de cobrarle un monto que no vio.
   */
  totalEsperado?: number;
  /** Ruta (sin origen) a la que vuelve el cliente después de pagar con Mercado Pago. */
  volverA: (pedido: { orderId: number; trackingToken: string | null }) => string;
}

interface PedidoTomado {
  orderId: number;
  orderNumber: number;
  trackingToken: string | null;
  /** URL de pago de Mercado Pago, o null si paga en efectivo. */
  pagarEn: string | null;
}

/**
 * Toma un pedido: valida lo pedido contra la base, recalcula precios, numera,
 * guarda, descuenta stock y, si corresponde, arma el cobro de Mercado Pago.
 *
 * Es el mismo camino para el tótem y para el pedido online, a propósito: los
 * dos venden el mismo menú, y una regla de precio o de disponibilidad que se
 * arregle en uno no puede quedar rota en el otro.
 */
async function tomarPedido(p: PedidoATomar): Promise<PedidoTomado> {
  const company = p.company;
  const location = { id: p.locationId };

  // Únicos: desde que un producto se puede personalizar, el mismo id aparece en
  // varias líneas —una con cambios y otra sin— y la base devuelve una sola fila
  // por producto. Comparar contra la lista con repetidos rechazaba el pedido
  // entero por "no disponible".
  const productIds = [...new Set(p.items.filter((i) => i.kind === "producto").map((i) => i.id))];
  const comboIds = [...new Set(p.items.filter((i) => i.kind === "combo").map((i) => i.id))];

  const productRows = productIds.length
    ? await db
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          categoryId: products.categoryId,
          customizable: products.customizable,
          pan: products.pan,
        })
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
        .select({ id: combos.id, name: combos.name, price: combos.price, grupos: combos.grupos })
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
    // Se desactivó o se borró mientras el cliente compraba. Se buscan los
    // nombres sin filtrar por activo, para decirle qué sacar en vez de "algo".
    const faltanProductos = productIds.filter((id) => !productRows.some((r) => r.id === id));
    const faltanCombos = comboIds.filter((id) => !comboRows.some((r) => r.id === id));
    const [prodNombres, comboNombres] = await Promise.all([
      faltanProductos.length
        ? db
            .select({ name: products.name })
            .from(products)
            .where(and(eq(products.companyId, company.id), inArray(products.id, faltanProductos)))
        : [],
      faltanCombos.length
        ? db
            .select({ name: combos.name })
            .from(combos)
            .where(and(eq(combos.companyId, company.id), inArray(combos.id, faltanCombos)))
        : [],
    ]);
    const nombres = [...prodNombres, ...comboNombres].map((n) => n.name);
    throw new Error(
      nombres.length > 0
        ? `Ahora no hay ${nombres.join(", ")}. Sacalo de tu pedido para seguir`
        : "Algo de tu pedido ya no está a la venta. Volvé a abrir el menú y armalo de nuevo",
    );
  }

  // El local puede tener apagado algo que la empresa sigue vendiendo. El menú
  // ya no lo muestra, pero el carrito puede ser anterior a que lo apagaran.
  const [apagados, agotados, combosApagados] = await Promise.all([
    productosApagadosEnElLocal(location.id, productRows),
    productosAgotados(location.id, productIds),
    combosApagadosEnElLocal(location.id, comboIds),
  ]);
  for (const id of agotados) apagados.add(id);
  if (apagados.size > 0 || combosApagados.size > 0) {
    // Con el nombre: "algo no está" obliga al cliente a adivinar qué sacar.
    const nombres = [
      ...productRows.filter((r) => apagados.has(r.id)).map((r) => r.name),
      ...comboRows.filter((r) => combosApagados.has(r.id)).map((r) => r.name),
    ];
    throw new Error(`Ahora no hay ${nombres.join(", ")}. Sacalo de tu pedido para seguir`);
  }

  // Lo que el cliente sacó se valida contra la receta, no se cree. El cliente
  // podría mandar cualquier id: sólo se aceptan ingredientes que ese producto
  // lleva y que el dueño marcó como quitables, y sólo si el producto está
  // habilitado para personalizar.
  // Por índice de línea y no por producto: el mismo producto puede estar dos
  // veces con cambios distintos —uno sin tomate y otro como viene— y guardarlo
  // por id le pegaría los mismos cambios a las dos.
  const sacadosPorLinea = new Map<number, { id: number; name: string }[]>();
  const lineasConSacados = p.items
    .map((item, indice) => ({ item, indice }))
    .filter(({ item }) => item.kind === "producto" && (item.removedIngredientIds?.length ?? 0) > 0);
  if (lineasConSacados.length > 0) {
    const quitables = await db
      .select({
        productId: productIngredients.productId,
        ingredientId: productIngredients.ingredientId,
        name: ingredients.name,
      })
      .from(productIngredients)
      .innerJoin(ingredients, eq(ingredients.id, productIngredients.ingredientId))
      .where(
        and(
          eq(productIngredients.removable, true),
          inArray(
            productIngredients.productId,
            lineasConSacados.map((l) => l.item.id),
          ),
        ),
      );

    for (const { item, indice } of lineasConSacados) {
      const producto = productRows.find((r) => r.id === item.id)!;
      if (!producto.customizable) {
        throw new Error(`${producto.name} no se puede personalizar`);
      }
      const permitidos = quitables.filter((q) => q.productId === item.id);
      const elegidos = [...new Set(item.removedIngredientIds ?? [])].map((id) => {
        const ok = permitidos.find((x) => x.ingredientId === id);
        if (!ok) throw new Error(`Ese ingrediente no se puede sacar de ${producto.name}`);
        return { id, name: ok.name };
      });
      sacadosPorLinea.set(indice, elegidos);
    }
  }

  // Los extras se validan igual que los sacados: contra la receta, nunca el
  // precio ni el tope que manda el cliente. Se guarda por índice de línea.
  const extrasPorLinea = new Map<
    number,
    { id: number; name: string; quantity: number; price: string }[]
  >();
  const lineasConExtras = p.items
    .map((item, indice) => ({ item, indice }))
    .filter(({ item }) => item.kind === "producto" && (item.extras?.length ?? 0) > 0);
  if (lineasConExtras.length > 0) {
    const agregables = await db
      .select({
        productId: productIngredients.productId,
        ingredientId: productIngredients.ingredientId,
        name: ingredients.name,
        price: productIngredients.extraPrice,
        max: productIngredients.extraMax,
      })
      .from(productIngredients)
      .innerJoin(ingredients, eq(ingredients.id, productIngredients.ingredientId))
      .where(
        and(
          eq(productIngredients.extraAllowed, true),
          inArray(
            productIngredients.productId,
            lineasConExtras.map((l) => l.item.id),
          ),
        ),
      );

    for (const { item, indice } of lineasConExtras) {
      const producto = productRows.find((r) => r.id === item.id)!;
      if (!producto.customizable) {
        throw new Error(`${producto.name} no se puede personalizar`);
      }
      const permitidos = agregables.filter((a) => a.productId === item.id);
      // Un id repetido en el request se colapsa sumando cantidades.
      const porId = new Map<number, number>();
      for (const e of item.extras ?? []) {
        porId.set(e.id, (porId.get(e.id) ?? 0) + e.quantity);
      }
      const elegidos = [...porId.entries()].map(([id, quantity]) => {
        const ok = permitidos.find((x) => x.ingredientId === id);
        if (!ok || ok.price === null || (ok.max ?? 0) <= 0) {
          throw new Error(`Ese ingrediente no se puede agregar a ${producto.name}`);
        }
        if (quantity > ok.max!) {
          throw new Error(`Máximo ${ok.max} de ${ok.name} en ${producto.name}`);
        }
        return { id, name: ok.name, quantity, price: ok.price };
      });
      extrasPorLinea.set(indice, elegidos);
    }
  }

  // Los gustos de los combos a elección se validan contra el combo, no se
  // creen: cada grupo tiene que sumar exactamente lo que trae, y cada gusto
  // tiene que ser de una categoría permitida y estar a la venta hoy en esta
  // sucursal (no apagado ni agotado). Por índice de línea, como lo sacado: el
  // mismo combo puede ir dos veces con gustos distintos.
  const eleccionesPorLinea = new Map<
    number,
    { grupo: string; productId: number; name: string; quantity: number }[]
  >();
  const elegidosIds = [
    ...new Set(
      p.items.flatMap((i) =>
        i.kind === "combo" ? (i.elecciones ?? []).map((e) => e.productId) : [],
      ),
    ),
  ];
  const elegibles = elegidosIds.length
    ? await db
        .select({
          id: products.id,
          name: products.name,
          categoryId: products.categoryId,
        })
        .from(products)
        .where(
          and(
            eq(products.companyId, company.id),
            eq(products.active, true),
            inArray(products.id, elegidosIds),
          ),
        )
    : [];
  const [elegiblesApagados, elegiblesAgotados] = elegibles.length
    ? await Promise.all([
        productosApagadosEnElLocal(location.id, elegibles),
        productosAgotados(
          location.id,
          elegibles.map((e) => e.id),
        ),
      ])
    : [new Set<number>(), new Set<number>()];
  for (const [indice, item] of p.items.entries()) {
    if (item.kind !== "combo") continue;
    const combo = comboRows.find((c) => c.id === item.id)!;
    const grupos = combo.grupos ?? [];
    if (grupos.length === 0) continue;
    const elegidas = item.elecciones ?? [];
    const lista: { grupo: string; productId: number; name: string; quantity: number }[] = [];
    for (const [g, grupo] of grupos.entries()) {
      const delGrupo = elegidas.filter((e) => e.grupo === g);
      const suma = delGrupo.reduce((t, e) => t + e.quantity, 0);
      if (suma !== grupo.cantidad) {
        throw new Error(
          suma < grupo.cantidad
            ? `En tu ${combo.name} faltan ${grupo.cantidad - suma} de ${grupo.nombre}: elegí los gustos`
            : `En tu ${combo.name} van ${grupo.cantidad} de ${grupo.nombre}, elegiste ${suma}`,
        );
      }
      for (const e of delGrupo) {
        const prod = elegibles.find((x) => x.id === e.productId);
        if (!prod || prod.categoryId === null || !grupo.categoriaIds.includes(prod.categoryId)) {
          throw new Error(
            `Uno de los gustos de tu ${combo.name} ya no se puede elegir. Volvé a armarlo`,
          );
        }
        if (elegiblesApagados.has(prod.id) || elegiblesAgotados.has(prod.id)) {
          throw new Error(`Ahora no hay ${prod.name}. Cambiá ese gusto de tu ${combo.name}`);
        }
        lista.push({
          grupo: grupo.nombre,
          productId: prod.id,
          name: prod.name,
          quantity: e.quantity,
        });
      }
    }
    eleccionesPorLinea.set(indice, lista);
  }

  // Precio efectivo del local: override por local si existe, si no el base.
  const [prodOverrides, comboOverrides] = await Promise.all([
    priceOverrides(location.id, "product", productIds),
    priceOverrides(location.id, "combo", comboIds),
  ]);

  // El combo se guarda como una línea con su propio precio y sin product_id:
  // order_items ya congela nombre y precio, así que el pedido queda fiel aunque
  // después se cambie el combo.
  const priced = p.items.map((item, indice) => {
    if (item.kind === "combo") {
      const combo = comboRows.find((c) => c.id === item.id)!;
      return {
        productId: null,
        productName: combo.name,
        unitPrice: comboOverrides.get(combo.id) ?? combo.price,
        quantity: item.quantity,
        pan: null,
      };
    }
    const product = productRows.find((r) => r.id === item.id)!;
    const base = Number(prodOverrides.get(product.id) ?? product.price);
    // El precio unitario de la línea incluye los extras: una unidad de este
    // producto "con lo que le agregó" cuesta base + suma de los extras.
    const extras = extrasPorLinea.get(indice) ?? [];
    const extrasCost = extras.reduce((t, e) => t + Number(e.price) * e.quantity, 0);
    return {
      productId: product.id,
      productName: product.name,
      unitPrice: (base + extrasCost).toFixed(2),
      quantity: item.quantity,
      // Si se hace en los dos, el que eligió (blanco si un carrito viejo no
      // lo mandó); si se hace en uno solo, ese, diga lo que diga el celular.
      pan: product.pan === "ambos" ? (item.pan ?? "blanco") : product.pan,
    };
  });

  const subtotal = priced.reduce((t, i) => t + Number(i.unitPrice) * i.quantity, 0);

  // "Cada 12, 2 de regalo": se cuenta acá, con las reglas y los precios de la
  // base, igual que en el carrito. Los sueltos que salen gratis se descuentan
  // del total; los que le correspondían y no agregó quedan para que la cocina
  // los ponga a elección.
  const reglas = await reglasDeRegalo(company.id);
  const regaloCombos = await regaloDeCombos(comboIds, reglas);
  const regalo = calcularRegalo(
    p.items.flatMap((item, indice): ParteRegalo[] => {
      if (item.kind === "combo") {
        return (regaloCombos.get(item.id) ?? []).map((r) => ({
          regla: r.regla,
          unidades: r.unidades * item.quantity,
          precioUnitario: null,
        }));
      }
      const categoria = productRows.find((r) => r.id === item.id)?.categoryId;
      const regla = categoria != null ? reglas.get(categoria) : undefined;
      return regla
        ? [{ regla, unidades: item.quantity, precioUnitario: Number(priced[indice].unitPrice) }]
        : [];
    }),
  );
  const regaloUnidades = regalo.pendientes;
  const aPagar = subtotal - regalo.descuento;
  const envio = p.online?.envio?.fee ?? 0;
  const total = aPagar + envio;

  if (p.online) {
    // El mínimo se mide sobre lo pedido, sin el envío: si no, un envío caro
    // ayudaría a llegar al mínimo, y el mínimo existe para que valga la pena
    // salir con el pedido.
    if (p.online.minOrder > 0 && aPagar < p.online.minOrder) {
      throw new Error(
        `El pedido mínimo es de $${p.online.minOrder.toLocaleString("es-AR")} (sin contar el envío)`,
      );
    }
    if (p.paymentMethod === "efectivo" && p.online.paysWith !== null && p.online.paysWith < total) {
      throw new Error(
        `Con $${p.online.paysWith.toLocaleString("es-AR")} no alcanza: el total es $${total.toLocaleString("es-AR")}`,
      );
    }
  }

  if (p.totalEsperado !== undefined && Math.abs(total - p.totalEsperado) > 0.5) {
    throw new Error(PRECIOS_CAMBIARON);
  }

  const jornada = diaDeHoy();
  // La página de seguimiento del pedido online se abre con este código y no con
  // el id, que es correlativo y dejaría recorrer pedidos ajenos.
  const trackingToken =
    p.channel === "online" ? globalThis.crypto.randomUUID().replace(/-/g, "") : null;

  // El consumo de stock se resuelve ANTES de abrir la transacción: son lecturas,
  // y si algo falla acá el pedido tiene que tomarse igual. Perder una venta
  // porque no pudimos calcular el inventario sería el peor de los dos errores,
  // el mismo criterio que con Mercado Pago más abajo.
  let consumo: Awaited<ReturnType<typeof calcularConsumo>> = [];
  const lineas: LineaVendida[] = [
    ...p.items.map((i, indice) => ({
      kind: i.kind,
      refId: i.id,
      quantity: i.quantity,
      removedIngredientIds: (sacadosPorLinea.get(indice) ?? []).map((x) => x.id),
      extras: (extrasPorLinea.get(indice) ?? []).map((x) => ({
        ingredientId: x.id,
        quantity: x.quantity,
      })),
    })),
    // Lo elegido en un combo a elección consume como si se vendiera suelto:
    // 18 clásicas son 18 empanadas que salen del stock.
    ...[...eleccionesPorLinea.entries()].flatMap(([indice, elegidas]) =>
      elegidas.map(
        (e): LineaVendida => ({
          kind: "producto",
          refId: e.productId,
          quantity: e.quantity * p.items[indice].quantity,
        }),
      ),
    ),
  ];
  try {
    await asegurarCodigosDeVenta(company.id);
    consumo = await calcularConsumo(company.id, lineas);
  } catch (error) {
    void registrarError({
      context: "tomarPedido.calcularConsumo",
      error,
      companyId: company.id,
      locationId: location.id,
    });
  }

  let creado: { orderId: number; orderNumber: number };
  try {
    creado = await db.transaction(async (tx) => {
      // Lo agotado no se vende. Se mira acá adentro, con las filas de stock
      // bloqueadas, para que dos pedidos no se lleven lo último a la vez: el menú
      // ya lo había sacado, pero el carrito puede ser de antes.
      const faltan = await faltantesDeStock(tx, location.id, consumo);
      if (faltan.length > 0) throw new StockInsuficiente(faltan);

      // La numeración arranca en 1 cada mañana y por local: el cliente ve un
      // número corto y el local no arrastra los miles del mes pasado. El id
      // interno sigue siendo el autoincremental, que nunca se repite. El tótem y
      // el pedido online comparten la numeración: es la misma cocina.
      //
      // Se asigna con un contador atómico y no con MAX(order_number)+1: aquel es
      // una lectura no bloqueante, así que dos pedidos simultáneos del mismo local
      // leerían el mismo máximo y el segundo chocaría contra la unique key. El
      // upsert incrementa last_number y toma un lock de fila que serializa solo
      // los pedidos de este local y jornada; locales distintos son filas distintas
      // y no compiten. LAST_INSERT_ID devuelve el número recién asignado en el
      // mismo viaje. Va ANTES del insert del pedido, que pisa LAST_INSERT_ID con
      // su propio id autoincremental.
      await tx.execute(sql`
      INSERT INTO order_sequences (location_id, business_date, last_number)
      VALUES (${location.id}, ${jornada}, LAST_INSERT_ID(1))
      ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)
    `);
      const [filasSeq] = await tx.execute(sql`SELECT LAST_INSERT_ID() AS n`);
      const orderNumber = Number((filasSeq as unknown as { n: number | string }[])[0].n);

      const [{ id: orderId }] = await tx
        .insert(orders)
        .values({
          locationId: location.id,
          totemId: p.totemId,
          orderNumber,
          channel: p.channel,
          businessDate: jornada,
          customerName: p.customerName.trim(),
          deliveryMethod: p.deliveryMethod,
          comments: p.comments?.trim() || null,
          status: "recibido",
          total: total.toFixed(2),
          paymentMethod: p.paymentMethod,
          // Nada se cobra al tomar el pedido: el efectivo se cobra en el mostrador
          // o al entregar, y Mercado Pago lo confirma Mercado Pago.
          paymentStatus: "pendiente",
          regaloUnidades,
          regaloDescuento: regalo.descuento.toFixed(2),
          ...(p.online
            ? {
                customerId: p.online.customerId,
                customerPhone: p.online.phone,
                deliveryFee: p.online.envio?.fee.toFixed(2) ?? null,
                deliveryAddress: p.online.envio?.address ?? null,
                deliveryDetails: p.online.envio?.details ?? null,
                deliveryLat: p.online.envio?.lat.toFixed(6) ?? null,
                deliveryLng: p.online.envio?.lng.toFixed(6) ?? null,
                deliveryApprox: p.online.envio?.aproximada ?? false,
                deliveryDistanceKm: p.online.envio?.km.toFixed(2) ?? null,
                cashPaysWith:
                  p.paymentMethod === "efectivo" && p.online.paysWith !== null
                    ? p.online.paysWith.toFixed(2)
                    : null,
                trackingToken,
              }
            : {}),
        })
        .$returningId();

      // Con ids: hacen falta para colgarles lo que el cliente sacó.
      for (const [indice, linea] of priced.entries()) {
        const [{ id: orderItemId }] = await tx
          .insert(orderItems)
          .values({ orderId, ...linea })
          .$returningId();

        const sacados = sacadosPorLinea.get(indice) ?? [];
        if (sacados.length > 0) {
          await tx.insert(orderItemRemovals).values(
            sacados.map((x) => ({
              orderItemId,
              ingredientId: x.id,
              // El nombre queda congelado, como el del producto: la comanda de
              // un pedido viejo tiene que seguir diciendo lo mismo.
              ingredientName: x.name,
            })),
          );
        }

        const elegidas = eleccionesPorLinea.get(indice) ?? [];
        if (elegidas.length > 0) {
          await tx.insert(orderItemElecciones).values(
            elegidas.map((e) => ({
              orderItemId,
              grupo: e.grupo,
              productId: e.productId,
              productName: e.name,
              quantity: e.quantity,
            })),
          );
        }

        const extras = extrasPorLinea.get(indice) ?? [];
        if (extras.length > 0) {
          await tx.insert(orderItemExtras).values(
            extras.map((x) => ({
              orderItemId,
              ingredientId: x.id,
              // Nombre y precio congelados: la comanda vieja tiene que seguir
              // diciendo lo mismo y el cobro ya está hecho a este precio.
              ingredientName: x.name,
              quantity: x.quantity,
              unitPrice: x.price,
            })),
          );
        }
      }

      // El descuento va en la misma transacción que el pedido: no puede quedar
      // un pedido sin su consumo ni un consumo sin su pedido.
      await registrarVenta(
        tx,
        {
          companyId: company.id,
          locationId: location.id,
          orderId,
          orderNumber,
        },
        consumo,
      );

      return { orderId, orderNumber };
    });
  } catch (error) {
    if (error instanceof StockInsuficiente) throw new Error(await mensajeSinStock(error.faltantes));
    throw error;
  }

  /**
   * Con el nombre de lo que el cliente tiene que tocar, no del ingrediente: "no
   * alcanza el pan" no le dice qué sacar del carrito. Recalcula línea por línea,
   * pero solo en este camino, que es el raro.
   */
  async function mensajeSinStock(faltantes: ConsumoVenta[]): Promise<string> {
    const nombres = new Set<string>();
    for (const linea of lineas) {
      const suyo = await calcularConsumo(company.id, [linea]);
      if (!suyo.some((c) => faltantes.some((f) => mismoItem(c, f)))) continue;
      const fila =
        linea.kind === "producto"
          ? productRows.find((r) => r.id === linea.refId)
          : comboRows.find((r) => r.id === linea.refId);
      if (fila) nombres.add(fila.name);
    }
    return nombres.size > 0
      ? `Stock insuficiente de ${[...nombres].join(", ")}. Probá con menos cantidad o cambialo por otro.`
      : "Stock insuficiente. Probá con menos cantidad o cambialo por otro.";
  }

  // El pedido ya está guardado. Si es con Mercado Pago, recién ahora se pide la
  // preferencia: así, si Mercado Pago está caído, el pedido no se pierde y el
  // local lo puede cobrar en efectivo igual.
  if (p.paymentMethod === "mercadopago") {
    const token = await tokenDeMP(company.id);
    if (!token) throw new Error("Este comercio no está cobrando con Mercado Pago en este momento");

    const items = itemsParaMP(
      priced.map((x) => ({
        title: x.productName,
        quantity: x.quantity,
        unitPrice: Number(x.unitPrice),
      })),
      regalo.descuento,
      envio,
    );

    let pref: Awaited<ReturnType<typeof crearPreferencia>>;
    try {
      pref = await crearPreferencia({
        accessToken: token,
        items,
        externalReference: String(creado.orderId),
        backUrl: `${origenPublico()}${p.volverA({ orderId: creado.orderId, trackingToken })}`,
        notificationUrl: urlDeAviso(),
        negocio: company.name,
        numeroPedido: creado.orderNumber,
        // El online sin pagar se cancela solo: el link vence con él. En el tótem
        // el cliente está parado enfrente y el local lo cobra igual en la caja.
        venceEnMinutos: p.channel === "online" ? VENCE_PAGO_ONLINE_MIN : undefined,
      });
    } catch (error) {
      // En el tótem el pedido queda y el mostrador lo cobra en efectivo. Online,
      // no: nadie está enfrente, el pedido no llega a la cocina hasta que se
      // pague, y quedaría escondido con el stock apartado. Se cancela ya, el
      // stock vuelve, y el cliente sabe que su pedido no salió.
      if (p.channel === "online") {
        void registrarError({
          context: "tomarPedido.mpPreferencia",
          error,
          companyId: company.id,
          locationId: location.id,
          extra: { orderId: creado.orderId },
        });
        await db
          .update(orders)
          .set({ status: "cancelado", cancelledAt: new Date(), cancelledBy: null })
          .where(eq(orders.id, creado.orderId));
        try {
          await devolverVenta(creado.orderId);
        } catch (e) {
          void registrarError({
            context: "tomarPedido.devolverVenta.mpFalla",
            error: e,
            companyId: company.id,
            locationId: location.id,
            extra: { orderId: creado.orderId },
          });
        }
        throw new Error(
          "No pudimos generar el cobro con Mercado Pago y tu pedido no se envió. Probá de nuevo en un rato o elegí pagar en efectivo",
        );
      }
      throw error;
    }

    await db.update(orders).set({ mpPreferenceId: pref.id }).where(eq(orders.id, creado.orderId));

    return { ...creado, trackingToken, pagarEn: pref.initPoint };
  }

  return { ...creado, trackingToken, pagarEn: null };
}

export interface TotemOrderSummary {
  orderNumber: number;
  businessDate: string;
  customerName: string;
  status: "recibido" | "preparacion" | "entregado" | "cancelado";
  total: string;
  /** Para poder decirle si le falta pagar, y dónde. */
  paymentMethod: "efectivo" | "mercadopago";
  paymentStatus: "pendiente" | "pagado" | "reembolso_pendiente";
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
        businessDate: orders.businessDate,
        customerName: orders.customerName,
        status: orders.status,
        total: orders.total,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
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
      businessDate: row.businessDate,
      customerName: row.customerName,
      status: row.status,
      total: row.total,
      paymentMethod: row.paymentMethod,
      paymentStatus: row.paymentStatus,
      companyName: row.companyName,
      slug: row.slug,
      logoUrl: row.logoUrl,
      accentColor: row.accentColor ?? row.primaryColor,
      theme: row.theme ?? "oscuro",
      fontTheme: row.fontTheme ?? "impacto",
      corners: row.corners ?? "redondeado",
    };
  });

export interface TotemTicket {
  companyName: string;
  orderNumber: number;
  businessDate: string;
  customerName: string;
  createdAt: string;
  deliveryMethod: "local" | "mostrador" | "envio";
  paymentMethod: "efectivo" | "mercadopago";
  total: string;
  comments: string | null;
  /** Unidades de regalo ("cada 12, 2 más") que el local agrega a su elección. */
  regaloUnidades: number;
  /** Lo descontado por los sándwiches de regalo que el cliente agregó. */
  regaloDescuento: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: string;
    /** Lo que el cliente sacó ("sin cebolla"), para la cocina. */
    removed: string[];
    /** Lo que agregó ("+2 carne"), con cantidad. */
    extras: { name: string; quantity: number }[];
    /** El pan con que se hace ("blanco" / "negro"); null si no tiene. */
    pan: string | null;
    /** Los gustos elegidos en un combo a elección ("6 Humita"). */
    elecciones: { grupo: string; name: string; quantity: number }[];
  }[];
  /** Impresora asignada a este tótem en el panel; la MAC no es secreta. */
  printerMac: string | null;
  printerName: string | null;
}

/**
 * Los datos del ticket que se imprime en la impresora del tótem. Salen de la
 * base (order_items), que es lo que realmente se guardó y se cobra, así que el
 * ticket coincide con la comanda y el cierre de caja. Público como el resto del
 * tótem, y acotado a un pedido de este local: solo devuelve el comprobante, sin
 * datos de otros pedidos.
 */
export const getTotemTicket = createServerFn({ method: "GET" })
  .inputValidator(z.object({ ...totemInput, orderId: z.number().int() }))
  .handler(async ({ data }): Promise<TotemTicket> => {
    const resuelto = await resolverTotem(data.empresa, data.local, data.totem);

    const [row] = await db
      .select({
        orderNumber: orders.orderNumber,
        businessDate: orders.businessDate,
        customerName: orders.customerName,
        createdAt: orders.createdAt,
        deliveryMethod: orders.deliveryMethod,
        paymentMethod: orders.paymentMethod,
        total: orders.total,
        comments: orders.comments,
        regaloUnidades: orders.regaloUnidades,
        regaloDescuento: orders.regaloDescuento,
        companyName: companies.name,
      })
      .from(orders)
      .innerJoin(locations, eq(locations.id, orders.locationId))
      .innerJoin(companies, eq(companies.id, locations.companyId))
      .where(and(eq(orders.id, data.orderId), eq(orders.locationId, resuelto.locationId)))
      .limit(1);

    if (!row) throw new Error("No encontramos ese pedido");

    const items = await lineasDelPedido(data.orderId);

    const [totem] = await db
      .select({ printerMac: totems.printerMac, printerName: totems.printerName })
      .from(totems)
      .where(eq(totems.id, resuelto.totemId))
      .limit(1);

    return {
      companyName: row.companyName,
      orderNumber: row.orderNumber,
      businessDate: row.businessDate,
      customerName: row.customerName,
      createdAt: row.createdAt.toISOString(),
      deliveryMethod: row.deliveryMethod,
      paymentMethod: row.paymentMethod,
      total: row.total,
      comments: row.comments,
      regaloUnidades: row.regaloUnidades,
      regaloDescuento: row.regaloDescuento,
      items,
      printerMac: totem?.printerMac ?? null,
      printerName: totem?.printerName ?? null,
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

/** Lo que lleva un pedido, línea por línea, con lo sacado y lo agregado. */
async function lineasDelPedido(orderId: number) {
  const itemRows = await db
    .select({
      id: orderItems.id,
      name: orderItems.productName,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      pan: orderItems.pan,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const itemIds = itemRows.map((i) => i.id);
  const [removalRows, extraRows, eleccionRows] = await Promise.all([
    itemIds.length
      ? db
          .select({
            orderItemId: orderItemRemovals.orderItemId,
            name: orderItemRemovals.ingredientName,
          })
          .from(orderItemRemovals)
          .where(inArray(orderItemRemovals.orderItemId, itemIds))
      : [],
    itemIds.length
      ? db
          .select({
            orderItemId: orderItemExtras.orderItemId,
            name: orderItemExtras.ingredientName,
            quantity: orderItemExtras.quantity,
          })
          .from(orderItemExtras)
          .where(inArray(orderItemExtras.orderItemId, itemIds))
      : [],
    itemIds.length
      ? db
          .select({
            orderItemId: orderItemElecciones.orderItemId,
            grupo: orderItemElecciones.grupo,
            name: orderItemElecciones.productName,
            quantity: orderItemElecciones.quantity,
          })
          .from(orderItemElecciones)
          .where(inArray(orderItemElecciones.orderItemId, itemIds))
      : [],
  ]);

  return itemRows.map((it) => ({
    name: it.name,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    removed: removalRows.filter((r) => r.orderItemId === it.id).map((r) => r.name),
    extras: extraRows
      .filter((e) => e.orderItemId === it.id)
      .map((e) => ({ name: e.name, quantity: e.quantity })),
    pan: it.pan,
    elecciones: eleccionRows
      .filter((e) => e.orderItemId === it.id)
      .map((e) => ({ grupo: e.grupo, name: e.name, quantity: e.quantity })),
  }));
}

// ─── Pedido online ──────────────────────────────────────────────────────────
//
// El mismo menú que el tótem, abierto desde el celular del cliente con el link
// /p/{empresa}/{sucursal}: retira en el local o se lo llevan. Público como el
// resto de este archivo, y por el mismo motivo devuelve solo lo que puede verse
// en pantalla.

export interface OnlineTier {
  upToKm: number;
  price: number;
}

export interface OnlineMenu extends TotemMenu {
  locationName: string;
  locationPhone: string | null;
  locationAddress: string | null;
  pickup: boolean;
  delivery: boolean;
  /** Si se puede pagar en efectivo. */
  cash: boolean;
  /** Pedido mínimo sin contar el envío. "0.00" = sin mínimo. */
  minOrder: string;
  /**
   * Desde dónde salen los envíos y cuánto cuestan por distancia. Viajan al
   * celular para que el cliente vea el costo mientras mueve el pin; el que vale
   * es el que se recalcula al tomar el pedido. La ubicación de la sucursal no
   * es un secreto: es el local.
   */
  origin: { lat: number; lng: number } | null;
  tiers: OnlineTier[];
  /**
   * Los turnos en que toma pedidos (0 = domingo). Null = sin horario. Viajan
   * para que el celular muestre si está abierto y cuándo abre, y lo actualice
   * solo mientras la página está abierta; el que decide es `createOnlineOrder`.
   */
  horarios: Horarios | null;
  /** Cuántas sucursales de la empresa toman pedidos online: con más de una, se ofrece cambiar. */
  sucursalesOnline: number;
}

const onlineInput = {
  empresa: z.string().trim().min(1).max(60),
  local: z.string().trim().min(1).max(60),
};

/** La empresa y la sucursal de un link online, sin mirar si está tomando pedidos. */
async function resolverSucursal(empresaSlug: string, localSlug: string) {
  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      active: companies.active,
      onlineOrdering: companies.onlineOrdering,
    })
    .from(companies)
    .where(eq(companies.slug, empresaSlug))
    .limit(1);
  if (!company) throw new Error("No encontramos este comercio");
  if (!company.active) throw new Error("Este comercio no está disponible en este momento");

  const [location] = await db
    .select({
      id: locations.id,
      name: locations.name,
      phone: locations.phone,
      address: locations.address,
      active: locations.active,
    })
    .from(locations)
    .where(and(eq(locations.companyId, company.id), eq(locations.slug, localSlug)))
    .limit(1);
  if (!location || !location.active) throw new Error("Esta sucursal no está disponible");

  return { company, location };
}

/**
 * La sucursal y cómo toma pedidos online. Falla si no los está tomando: el
 * interruptor del panel es lo que abre y cierra el canal, y un pedido que entra
 * con el local cerrado es un pedido que nadie va a preparar.
 */
async function resolverOnline(empresaSlug: string, localSlug: string) {
  const { company, location } = await resolverSucursal(empresaSlug, localSlug);
  // El pedido online es un adicional: si la empresa no lo tiene contratado, el
  // link no toma pedidos aunque su configuración siga guardada.
  if (!company.onlineOrdering) {
    throw new Error("Este comercio no toma pedidos online");
  }

  const [settings] = await db
    .select()
    .from(onlineSettings)
    .where(eq(onlineSettings.locationId, location.id))
    .limit(1);

  const tiers: OnlineTier[] = settings?.deliveryEnabled
    ? (
        await db
          .select({ upToKm: deliveryTiers.upToKm, price: deliveryTiers.price })
          .from(deliveryTiers)
          .where(eq(deliveryTiers.locationId, location.id))
          .orderBy(asc(deliveryTiers.upToKm))
      ).map((t) => ({ upToKm: Number(t.upToKm), price: Number(t.price) }))
    : [];
  const origin =
    settings?.originLat != null && settings.originLng != null
      ? { lat: Number(settings.originLat), lng: Number(settings.originLng) }
      : null;

  const pickup = Boolean(settings?.pickupEnabled);
  // Sin el punto de la sucursal no hay distancia que medir, y sin tramos no hay
  // qué cobrar: en cualquiera de los dos casos el envío no se ofrece.
  const delivery = Boolean(settings?.deliveryEnabled) && origin !== null && tiers.length > 0;

  if (!settings?.enabled || (!pickup && !delivery)) {
    throw new Error("En este momento no estamos tomando pedidos online");
  }

  const mercadoPago = await empresaCobraConMP(company.id);
  return {
    company,
    location,
    pickup,
    delivery,
    // Si el dueño apagó el efectivo pero Mercado Pago no está andando, el
    // cliente no tendría cómo pagar: el efectivo vuelve, mejor que un pedido
    // imposible.
    cash: settings.cashEnabled || !mercadoPago,
    mercadoPago,
    minOrder: Number(settings.minOrder),
    origin,
    tiers,
    horarios: settings.horarios ?? null,
  };
}

/** Una sucursal que toma pedidos online, como la ve el que elige a cuál pedirle. */
export interface SucursalOnline {
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  pickup: boolean;
  delivery: boolean;
  /** Desde dónde sale el envío; null si no hace envíos. */
  origin: { lat: number; lng: number } | null;
  tiers: OnlineTier[];
  horarios: Horarios | null;
}

export interface OnlineEmpresa {
  name: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string | null;
  theme: TotemMenu["theme"];
  fontTheme: TotemMenu["fontTheme"];
  corners: TotemMenu["corners"];
  sucursales: SucursalOnline[];
}

/** Las sucursales de la empresa con el pedido online encendido y algo que ofrecer. */
async function sucursalesOnlineDe(companyId: number): Promise<SucursalOnline[]> {
  const filas = await db
    .select({ location: locations, settings: onlineSettings })
    .from(locations)
    .innerJoin(onlineSettings, eq(onlineSettings.locationId, locations.id))
    .where(
      and(
        eq(locations.companyId, companyId),
        eq(locations.active, true),
        eq(onlineSettings.enabled, true),
      ),
    )
    .orderBy(asc(locations.name));
  if (filas.length === 0) return [];
  const tramos = await db
    .select({
      locationId: deliveryTiers.locationId,
      upToKm: deliveryTiers.upToKm,
      price: deliveryTiers.price,
    })
    .from(deliveryTiers)
    .where(
      inArray(
        deliveryTiers.locationId,
        filas.map((f) => f.location.id),
      ),
    )
    .orderBy(asc(deliveryTiers.upToKm));

  return filas
    .map(({ location: l, settings: s }) => {
      const origin =
        s.originLat != null && s.originLng != null
          ? { lat: Number(s.originLat), lng: Number(s.originLng) }
          : null;
      const tiers = tramos
        .filter((t) => t.locationId === l.id)
        .map((t) => ({ upToKm: Number(t.upToKm), price: Number(t.price) }));
      // Las mismas condiciones que `resolverOnline`: sin punto o sin tramos no
      // hay envío que ofrecer.
      const delivery = s.deliveryEnabled && origin !== null && tiers.length > 0;
      return {
        slug: l.slug,
        name: l.name,
        address: l.address,
        phone: l.phone,
        pickup: s.pickupEnabled,
        delivery,
        origin: delivery ? origin : null,
        tiers: delivery ? tiers : [],
        horarios: s.horarios ?? null,
      };
    })
    .filter((s) => s.pickup || s.delivery);
}

/**
 * La empresa entera, para el link que no es de una sucursal: el cliente pone
 * su dirección y elige entre las sucursales que le llegan, o elige dónde
 * retirar. La cuenta de cuál llega se hace en el celular con estos datos (los
 * mismos que ya viajan con cada menú); el pedido lo vuelve a validar la
 * sucursal elegida, como siempre.
 */
export const getOnlineEmpresa = createServerFn({ method: "GET" })
  .inputValidator(z.object({ empresa: z.string().trim().min(1).max(60) }))
  .handler(async ({ data }): Promise<OnlineEmpresa> => {
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
      .where(eq(companies.slug, data.empresa))
      .limit(1);
    if (!row) throw new Error("No encontramos este comercio");
    if (!row.company.active) throw new Error("Este comercio no está disponible en este momento");
    if (!row.company.onlineOrdering) throw new Error("Este comercio no toma pedidos online");

    const sucursales = await sucursalesOnlineDe(row.company.id);
    if (sucursales.length === 0) {
      throw new Error("En este momento no estamos tomando pedidos online");
    }
    return {
      name: row.company.name,
      slug: row.company.slug,
      logoUrl: row.company.logoUrl,
      accentColor: row.accentColor ?? row.company.primaryColor,
      theme: row.theme ?? "oscuro",
      fontTheme: row.fontTheme ?? "impacto",
      corners: row.corners ?? "redondeado",
      sucursales,
    };
  });

export const getOnlineMenu = createServerFn({ method: "GET" })
  .inputValidator(z.object(onlineInput))
  .handler(async ({ data }): Promise<OnlineMenu> => {
    const r = await resolverOnline(data.empresa, data.local);
    const menu = await armarMenu(r.company.id, r.location.id);
    return {
      ...menu,
      locationName: r.location.name,
      locationPhone: r.location.phone,
      locationAddress: r.location.address,
      pickup: r.pickup,
      delivery: r.delivery,
      cash: r.cash,
      minOrder: r.minOrder.toFixed(2),
      origin: r.delivery ? r.origin : null,
      tiers: r.delivery ? r.tiers : [],
      horarios: r.horarios,
      sucursalesOnline: (await sucursalesOnlineDe(r.company.id)).length,
    };
  });

/**
 * Registra o actualiza el cliente (perfil global por teléfono), solo si aceptó
 * guardar sus datos. Devuelve su id para ligar el pedido, o null si no se
 * registra. La llave es el teléfono canonizado (ver `telefonoCanonico`): no
 * puede duplicar al mismo cliente según cómo lo escribió. Un mail vacío no pisa
 * el que el cliente ya tenía.
 *
 * No va dentro de la transacción del pedido: el perfil es independiente, y si el
 * pedido fallara después, que el cliente haya quedado registrado no molesta.
 */
/**
 * Canoniza un teléfono a su número nacional argentino (código de área +
 * abonado, 10 dígitos) para usarlo de llave de cliente. Así "+54 9 223
 * 687-1234", "0223 6871234" y "2236871234" son el mismo cliente, en vez de
 * registrarse por separado según cómo lo escriba. Saca el país (54), el 9 de
 * móvil y el 0 de larga distancia, y se queda con los últimos 10 dígitos.
 * Números que no llegan a 10 (raros o extranjeros) se dejan como están.
 */
function telefonoCanonico(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  d = d.replace(/^0+/, "");
  return d.length > 10 ? d.slice(-10) : d;
}

async function registrarCliente(
  name: string,
  phone: string,
  opts: { email?: string; guardar: boolean },
): Promise<number | null> {
  if (!opts.guardar) return null;
  const telnorm = telefonoCanonico(phone);
  if (telnorm.length < 8) return null;
  const nombre = name.trim();
  const email = opts.email?.trim() || null;
  try {
    await db
      .insert(customers)
      .values({ phone: telnorm, name: nombre, email })
      .onDuplicateKeyUpdate({ set: email ? { name: nombre, email } : { name: nombre } });
    const [c] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.phone, telnorm))
      .limit(1);
    return c?.id ?? null;
  } catch {
    // Registrar al cliente nunca puede voltear un pedido: si falla, se toma igual.
    return null;
  }
}

export const createOnlineOrder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ...onlineInput,
      customerName: z.string().trim().min(1).max(120),
      // Se exige con al menos 8 dígitos: es lo único que tiene el local para
      // ubicar al cliente si algo sale mal, y un teléfono a medio escribir no
      // sirve para eso.
      phone: z
        .string()
        .trim()
        .max(40)
        .regex(/^[0-9+()\-\s]+$/, "El teléfono solo puede tener números")
        .refine((t) => t.replace(/\D/g, "").length >= 8, "Revisá el teléfono: le faltan números"),
      deliveryMethod: z.enum(["mostrador", "envio"]),
      // El envío: la dirección que eligió o escribió, el punto que confirmó en
      // el mapa y lo que el mapa no dice (piso, depto, sombrilla). El costo no
      // viaja: se calcula acá con la distancia.
      address: z.string().trim().max(255).optional(),
      details: z.string().trim().max(255).optional(),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
      // El celular avisa que el punto es solo la calle (no estaba la altura en
      // el mapa). No se puede verificar, pero tampoco hace daño: lo único que
      // cambia es que el repartidor navega por la dirección escrita.
      aproximada: z.boolean().optional(),
      paymentMethod: z.enum(["efectivo", "mercadopago"]),
      paysWith: z.number().positive().max(100_000_000).optional(),
      comments: z.string().trim().max(500).optional(),
      items: z.array(lineaPedido).min(1),
      /** El total que vio el cliente, para no cobrarle uno distinto. */
      totalEsperado: z.number().nonnegative().optional(),
      // Registro del cliente (perfil global por teléfono, sin contraseña). El
      // mail es opcional; se guarda solo si el cliente aceptó guardar sus datos.
      email: z.string().trim().max(255).email("Revisá el email").optional().or(z.literal("")),
      guardarDatos: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }): Promise<{ trackingToken: string; pagarEn: string | null }> => {
    const r = await resolverOnline(data.empresa, data.local);

    // Fuera de horario no se toma, aunque el celular haya dejado armar el pedido
    // (la página pudo quedar abierta desde antes de que cerraran).
    const horario = estadoHorario(r.horarios);
    if (!horario.abierto) {
      throw new Error(`Ahora estamos cerrados. Tomamos pedidos de nuevo ${horario.texto}`);
    }

    if (data.deliveryMethod === "mostrador" && !r.pickup) {
      throw new Error("Esta sucursal no está tomando pedidos para retirar");
    }
    if (data.deliveryMethod === "envio" && !r.delivery) {
      throw new Error("Esta sucursal no está haciendo envíos en este momento");
    }

    // El costo del envío sale de la distancia entre la sucursal y el punto que
    // marcó el cliente, con los tramos guardados: nunca de lo que diga el celular.
    let envio: DatosOnline["envio"] = null;
    if (data.deliveryMethod === "envio") {
      if (data.lat === undefined || data.lng === undefined) {
        throw new Error("Marcá en el mapa dónde te lo llevamos");
      }
      if (!data.address || data.address.length < 3) {
        throw new Error("Escribí la dirección de entrega");
      }
      // Distancia por ruta real (Google); si Google no responde, línea recta,
      // para no perder la venta (misma regla que Mercado Pago).
      const destino = { lat: data.lat, lng: data.lng };
      const km = (await distanciaPorRutaKm(r.origin!, destino)) ?? distanciaKm(r.origin!, destino);
      const cotizado = cotizarEnvio(r.tiers, km);
      if (!cotizado.llega) {
        throw new Error(
          `No llegamos hasta ahí: estás a ${formatearDistancia(km)} y hacemos envíos hasta ${formatearDistancia(cotizado.maxKm)}`,
        );
      }
      envio = {
        fee: cotizado.precio,
        km,
        address: data.address,
        details: data.details || null,
        lat: data.lat,
        lng: data.lng,
        aproximada: data.aproximada ?? false,
      };
    }

    if (data.paymentMethod === "efectivo" && !r.cash) {
      throw new Error("Esta sucursal no está aceptando efectivo en pedidos online");
    }
    // Se mira antes de tomar el pedido: si no, quedaría guardado un pedido de
    // Mercado Pago que no hay forma de pagar.
    if (data.paymentMethod === "mercadopago" && !r.mercadoPago) {
      throw new Error("Este comercio no está cobrando con Mercado Pago en este momento");
    }

    // Registro del cliente (perfil global por teléfono), solo si aceptó guardar
    // sus datos. El teléfono se normaliza a dígitos para que sea una llave
    // estable. Si ya existe, se actualiza el nombre y —si lo dio— el mail; un
    // mail vacío no pisa el que ya tenía.
    const customerId = await registrarCliente(data.customerName, data.phone, {
      email: data.email,
      guardar: data.guardarDatos ?? false,
    });

    const tomado = await tomarPedido({
      company: r.company,
      locationId: r.location.id,
      totemId: null,
      channel: "online",
      customerName: data.customerName,
      deliveryMethod: data.deliveryMethod,
      paymentMethod: data.paymentMethod,
      comments: data.comments,
      items: data.items,
      online: {
        phone: data.phone,
        envio,
        paysWith: data.paysWith ?? null,
        minOrder: r.minOrder,
        customerId,
      },
      totalEsperado: data.totalEsperado,
      volverA: ({ trackingToken }) => `/p/${data.empresa}/${data.local}/pedido/${trackingToken}`,
    });

    return { trackingToken: tomado.trackingToken!, pagarEn: tomado.pagarEn };
  });

export interface OnlineOrderStatus {
  /** Unidades de regalo ("cada 12, 2 más") que el local agrega a su elección. */
  regaloUnidades: number;
  /** Lo descontado por los sándwiches de regalo que el cliente agregó. */
  regaloDescuento: string;
  orderNumber: number;
  businessDate: string;
  createdAt: string;
  customerName: string;
  status: "recibido" | "preparacion" | "entregado" | "cancelado";
  /** Si el local ya lo aceptó, y con qué demora. */
  acceptedAt: string | null;
  etaMinutes: number | null;
  deliveryMethod: "local" | "mostrador" | "envio";
  deliveryFee: string | null;
  deliveryAddress: string | null;
  deliveryDetails: string | null;
  deliveryDistanceKm: string | null;
  paymentMethod: "efectivo" | "mercadopago";
  paymentStatus: "pendiente" | "pagado" | "reembolso_pendiente";
  cashPaysWith: string | null;
  total: string;
  /**
   * Link para pagar con Mercado Pago, mientras siga sin pagar: el cliente puede
   * haber salido del pago a mitad de camino y tiene que poder volver.
   */
  pagarEn: string | null;
  /**
   * Si el cliente todavía puede cancelarlo o cambiar cómo paga: solo mientras
   * el local no lo aceptó. Desde que lo aceptan lo están preparando, y después
   * va en camino: ahí cualquier cambio es por teléfono con el local.
   */
  puedeModificar: boolean;
  /** Formas de pago a las que puede pasarse, si puede modificar. */
  pagosDisponibles: { efectivo: boolean; mercadopago: boolean };
  /** Lo canceló el cliente desde su celular, no el local. */
  canceladoPorCliente: boolean;
  /** Se canceló solo porque no se terminó de pagar con Mercado Pago a tiempo. */
  vencioSinPagar: boolean;
  items: Awaited<ReturnType<typeof lineasDelPedido>>;
  companyName: string;
  locationName: string;
  locationPhone: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  theme: TotemThemeName;
  fontTheme: TotemFontName;
  corners: TotemCornersName;
}

/**
 * El estado de un pedido online, para la página de seguimiento del cliente.
 *
 * Se pide con el código del pedido y no con el id: quien tiene el link es quien
 * hizo el pedido. No exige que el canal siga abierto: el cliente tiene que
 * poder ver su pedido aunque el local haya dejado de tomar nuevos.
 *
 * Si es de Mercado Pago y sigue pendiente, le pregunta a Mercado Pago, igual
 * que el tótem mientras el cliente escanea: el aviso puede perderse.
 */
export const getOnlineOrder = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ ...onlineInput, token: z.string().regex(/^[0-9a-f]{32}$/, "Pedido inválido") }),
  )
  .handler(async ({ data }): Promise<OnlineOrderStatus> => {
    const { company, location } = await resolverSucursal(data.empresa, data.local);

    const [row] = await db
      .select({
        order: orders,
        logoUrl: companies.logoUrl,
        primaryColor: companies.primaryColor,
        accentColor: totemSettings.accentColor,
        theme: totemSettings.theme,
        fontTheme: totemSettings.fontTheme,
        corners: totemSettings.corners,
      })
      .from(orders)
      .innerJoin(companies, eq(companies.id, company.id))
      .leftJoin(totemSettings, eq(totemSettings.companyId, company.id))
      .where(and(eq(orders.trackingToken, data.token), eq(orders.locationId, location.id)))
      .limit(1);
    if (!row) throw new Error("No encontramos ese pedido");

    const o = row.order;
    let paymentStatus = o.paymentStatus;
    const pagos = await pagosDelOnline(company.id, location.id);
    if (
      o.paymentMethod === "mercadopago" &&
      paymentStatus === "pendiente" &&
      o.status !== "cancelado"
    ) {
      const token = await tokenDeMP(company.id);
      if (token) {
        try {
          const pago = await buscarPagoDePedido(token, String(o.id));
          if (pago?.aprobado) {
            await acreditarPedido(o.id, pago.id);
            paymentStatus = "pagado";
          }
        } catch {
          // Si Mercado Pago no contesta, la página vuelve a preguntar sola.
        }
      }
    }

    return {
      regaloUnidades: o.regaloUnidades,
      regaloDescuento: o.regaloDescuento,
      orderNumber: o.orderNumber,
      businessDate: o.businessDate,
      createdAt: o.createdAt.toISOString(),
      customerName: o.customerName,
      status: o.status,
      acceptedAt: o.acceptedAt?.toISOString() ?? null,
      etaMinutes: o.etaMinutes,
      deliveryMethod: o.deliveryMethod,
      deliveryDetails: o.deliveryDetails,
      deliveryDistanceKm: o.deliveryDistanceKm,
      deliveryFee: o.deliveryFee,
      deliveryAddress: o.deliveryAddress,
      paymentMethod: o.paymentMethod,
      paymentStatus,
      cashPaysWith: o.cashPaysWith,
      total: o.total,
      puedeModificar: modificable(o) && paymentStatus !== "pagado",
      pagosDisponibles: pagos,
      canceladoPorCliente: o.status === "cancelado" && o.cancelledBy === null && !vencido(o),
      vencioSinPagar: vencido(o),
      pagarEn:
        o.paymentMethod === "mercadopago" &&
        paymentStatus === "pendiente" &&
        o.status !== "cancelado" &&
        o.mpPreferenceId
          ? `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${o.mpPreferenceId}`
          : null,
      items: await lineasDelPedido(o.id),
      companyName: company.name,
      locationName: location.name,
      locationPhone: location.phone,
      logoUrl: row.logoUrl,
      accentColor: row.accentColor ?? row.primaryColor,
      theme: row.theme ?? "oscuro",
      fontTheme: row.fontTheme ?? "impacto",
      corners: row.corners ?? "redondeado",
    };
  });

/**
 * Un pedido online que el cliente todavía puede cancelar o cambiar: el local no
 * lo aceptó. Aceptado, ya lo están preparando, y después va en camino.
 */
function modificable(o: { channel: string; status: string; acceptedAt: Date | null }): boolean {
  return o.channel === "online" && o.status !== "cancelado" && o.acceptedAt === null;
}

/** Con qué se puede pagar un pedido online de esta sucursal. */
async function pagosDelOnline(companyId: number, locationId: number) {
  const [[settings], mp] = await Promise.all([
    db
      .select({ cash: onlineSettings.cashEnabled })
      .from(onlineSettings)
      .where(eq(onlineSettings.locationId, locationId))
      .limit(1),
    empresaCobraConMP(companyId),
  ]);
  // Mismo criterio que al tomar el pedido: si Mercado Pago no anda, el
  // efectivo vuelve aunque el dueño lo haya apagado.
  return { efectivo: (settings?.cash ?? true) || !mp, mercadopago: mp };
}

/** El pedido de un link de seguimiento, con su empresa y sucursal. */
async function pedidoDelLink(empresa: string, local: string, token: string) {
  const { company, location } = await resolverSucursal(empresa, local);
  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.trackingToken, token), eq(orders.locationId, location.id)))
    .limit(1);
  if (!o) throw new Error("No encontramos ese pedido");
  return { company, location, o };
}

const NO_SE_PUEDE_CAMBIAR =
  "El local ya aceptó tu pedido y lo está preparando. Si necesitás cambiar algo, llamá al local";

/** Cuántas filas tocó un UPDATE. Si es 0, otro llegó primero. */
const filasTocadas = (r: unknown) => (r as { affectedRows?: number }).affectedRows ?? 0;

/**
 * Si un pedido de Mercado Pago ya se pagó, aunque todavía no nos hayamos
 * enterado. Se pregunta antes de cancelarlo o pasarlo a efectivo: si no, un
 * pago que entró recién quedaría colgado sin que nadie sepa que hay que
 * devolverlo.
 */
async function pagoEntro(companyId: number, orderId: number): Promise<boolean> {
  const token = await tokenDeMP(companyId);
  if (!token) return false;
  let pago: Awaited<ReturnType<typeof buscarPagoDePedido>>;
  try {
    pago = await buscarPagoDePedido(token, String(orderId));
  } catch {
    throw new Error("No pudimos confirmar con Mercado Pago. Probá de nuevo en unos segundos");
  }
  if (pago?.aprobado) {
    await acreditarPedido(orderId, pago.id);
    return true;
  }
  return false;
}

/**
 * Si un pedido se canceló solo por no pagarse a tiempo. No hay una columna para
 * eso: lo cancela la comandera sin usuario, con Mercado Pago sin pagar, y
 * después del plazo. Uno que el cliente canceló antes del plazo no cuenta.
 */
function vencido(o: {
  status: string;
  cancelledBy: number | null;
  cancelledAt: Date | null;
  createdAt: Date;
  paymentMethod: string;
  paymentStatus: string;
}): boolean {
  return (
    o.status === "cancelado" &&
    o.cancelledBy === null &&
    o.paymentMethod === "mercadopago" &&
    o.paymentStatus === "pendiente" &&
    o.cancelledAt !== null &&
    o.cancelledAt.getTime() - o.createdAt.getTime() >= VENCE_PAGO_ONLINE_MIN * 60_000
  );
}

/** Lo mismo que `VENCE_PAGO_ONLINE_MS` de la comandera, en minutos para Mercado Pago. */
const VENCE_PAGO_ONLINE_MIN = 30;

const tokenInput = z.string().regex(/^[0-9a-f]{32}$/, "Pedido inválido");

/**
 * El cliente cancela su pedido online desde el seguimiento.
 *
 * Solo mientras el local no lo aceptó: después lo están preparando o va en
 * camino, y eso se arregla hablando con el local, no con un botón. Si cancela
 * justo cuando el local lo acepta, gana el que llega primero: la actualización
 * solo pasa si sigue sin aceptar.
 *
 * Hace lo mismo que la cancelación del local: si ya estaba pagado queda para
 * devolver, y el stock vuelve. `cancelled_by` queda vacío: así la comandera
 * sabe que lo canceló el cliente.
 */
export const cancelOnlineOrder = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ...onlineInput, token: tokenInput }))
  .handler(async ({ data }): Promise<{ ok: true; reembolso: boolean }> => {
    const { company, o } = await pedidoDelLink(data.empresa, data.local, data.token);
    if (o.status === "cancelado") return { ok: true, reembolso: false };
    if (!modificable(o)) throw new Error(NO_SE_PUEDE_CAMBIAR);

    let pagado = o.paymentStatus === "pagado";
    if (!pagado && o.paymentMethod === "mercadopago") pagado = await pagoEntro(company.id, o.id);

    const [r] = await db
      .update(orders)
      .set({
        status: "cancelado",
        cancelledAt: new Date(),
        cancelledBy: null,
        paymentStatus: pagado ? "reembolso_pendiente" : "pendiente",
      })
      .where(and(eq(orders.id, o.id), isNull(orders.acceptedAt), ne(orders.status, "cancelado")));
    if (filasTocadas(r) === 0) throw new Error(NO_SE_PUEDE_CAMBIAR);

    // Lo que el pedido descontó del stock vuelve, como en cualquier cancelación.
    try {
      await devolverVenta(o.id);
    } catch (error) {
      void registrarError({
        context: "cancelOnlineOrder.devolverVenta",
        error,
        companyId: company.id,
        locationId: o.locationId,
        extra: { orderId: o.id },
      });
    }
    return { ok: true, reembolso: pagado };
  });

/**
 * El cliente cambia cómo paga, mientras el local no aceptó el pedido: se
 * equivocó de opción, o Mercado Pago no le anduvo y prefiere pagar en efectivo.
 *
 * Si pasa a Mercado Pago se arma un cobro nuevo con el total que ya está
 * guardado (no se recalcula nada del pedido). Si pasa a efectivo, antes se le
 * pregunta a Mercado Pago que no haya pagado recién.
 */
export const changeOnlineOrderPayment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ...onlineInput,
      token: tokenInput,
      paymentMethod: z.enum(["efectivo", "mercadopago"]),
      paysWith: z.number().positive().max(100_000_000).optional(),
    }),
  )
  .handler(async ({ data }): Promise<{ pagarEn: string | null }> => {
    const { company, location, o } = await pedidoDelLink(data.empresa, data.local, data.token);
    if (!modificable(o)) throw new Error(NO_SE_PUEDE_CAMBIAR);
    if (o.paymentStatus === "pagado") {
      throw new Error("Tu pedido ya está pagado: no hace falta cambiar cómo pagás");
    }
    const pagos = await pagosDelOnline(company.id, location.id);
    const sigueSinAceptar = and(
      eq(orders.id, o.id),
      isNull(orders.acceptedAt),
      ne(orders.status, "cancelado"),
    );

    if (data.paymentMethod === "efectivo") {
      if (!pagos.efectivo) throw new Error("Esta sucursal no está aceptando efectivo");
      if (o.paymentMethod === "mercadopago" && (await pagoEntro(company.id, o.id))) {
        throw new Error("Tu pago con Mercado Pago ya entró: no hace falta cambiarlo");
      }
      const total = Number(o.total);
      if (data.paysWith !== undefined && data.paysWith < total) {
        throw new Error(
          `Con $${data.paysWith.toLocaleString("es-AR")} no alcanza: el total es $${total.toLocaleString("es-AR")}`,
        );
      }
      const [r] = await db
        .update(orders)
        .set({
          paymentMethod: "efectivo",
          cashPaysWith: data.paysWith?.toFixed(2) ?? null,
          mpPreferenceId: null,
        })
        .where(sigueSinAceptar);
      if (filasTocadas(r) === 0) throw new Error(NO_SE_PUEDE_CAMBIAR);
      return { pagarEn: null };
    }

    // A Mercado Pago: un cobro nuevo por lo que ya está guardado.
    const token = await tokenDeMP(company.id);
    if (!token) throw new Error("Este comercio no está cobrando con Mercado Pago en este momento");
    const lineas = await lineasDelPedido(o.id);
    const items = itemsParaMP(
      lineas.map((l) => ({ title: l.name, quantity: l.quantity, unitPrice: Number(l.unitPrice) })),
      Number(o.regaloDescuento),
      Number(o.deliveryFee ?? 0),
    );
    const pref = await crearPreferencia({
      accessToken: token,
      items,
      externalReference: String(o.id),
      backUrl: `${origenPublico()}/p/${data.empresa}/${data.local}/pedido/${data.token}`,
      notificationUrl: urlDeAviso(),
      negocio: company.name,
      numeroPedido: o.orderNumber,
      // Vence cuando vence el pedido, contado desde que se hizo y no desde el
      // cambio: si no, el pedido se cancelaría con el link todavía andando.
      venceEnMinutos: Math.max(
        5,
        VENCE_PAGO_ONLINE_MIN - Math.floor((Date.now() - o.createdAt.getTime()) / 60_000),
      ),
    });
    const [r] = await db
      .update(orders)
      .set({ paymentMethod: "mercadopago", cashPaysWith: null, mpPreferenceId: pref.id })
      .where(sigueSinAceptar);
    if (filasTocadas(r) === 0) throw new Error(NO_SE_PUEDE_CAMBIAR);
    return { pagarEn: pref.initPoint };
  });

/**
 * El link corto del pedido online: /{alias} lleva a /p/{empresa}/{sucursal}.
 * Público como el resto del canal; solo devuelve las dos partes de la URL.
 */
export const resolveOnlineAlias = createServerFn({ method: "GET" })
  .inputValidator(z.object({ alias: z.string().trim().toLowerCase().min(1).max(40) }))
  .handler(async ({ data }): Promise<{ empresa: string; local: string | null }> => {
    // Primero el de la empresa entera: lleva a elegir sucursal.
    const [empresa] = await db
      .select({ slug: companies.slug })
      .from(companies)
      .where(eq(companies.onlineAlias, data.alias))
      .limit(1);
    if (empresa) return { empresa: empresa.slug, local: null };

    const [row] = await db
      .select({ empresa: companies.slug, local: locations.slug })
      .from(onlineSettings)
      .innerJoin(locations, eq(locations.id, onlineSettings.locationId))
      .innerJoin(companies, eq(companies.id, locations.companyId))
      .where(eq(onlineSettings.alias, data.alias))
      .limit(1);
    if (!row) throw new Error("No encontramos ese link. Revisá que esté bien escrito");
    return row;
  });

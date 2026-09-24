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
  locationCombos,
  orders,
  orderItems,
  orderItemRemovals,
  productIngredients,
  ingredients,
  paymentSettings,
} from "@/db/schema";
import { destroySession } from "@/lib/auth/session";
import {
  crearPreferencia,
  buscarPagoDePedido,
  type ItemPreferencia,
} from "@/lib/payments/mercadopago";
import { acreditarPedido } from "@/lib/payments/acreditar";
import {
  calcularConsumo,
  registrarVenta,
  asegurarCodigosDeVenta,
  type LineaVendida,
} from "@/lib/stock/venta";

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

  const productosApagados = await productosApagadosEnElLocal(
    locationId,
    componentes.map((c) => ({ id: c.productId, categoryId: c.categoryId })),
  );
  for (const c of componentes) {
    // Un componente dado de baja en toda la empresa también deja el combo sin
    // qué entregar, no sólo uno apagado en este local.
    if (!c.activo || productosApagados.has(c.productId)) apagados.add(c.comboId);
  }
  return apagados;
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

/** Un ingrediente que el cliente puede sacar de un producto. */
export interface TotemRemovable {
  id: number;
  name: string;
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
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      active: companies.active,
    })
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
          customizable: products.customizable,
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
    const prods = prodRows.filter(
      (p) =>
        p.available !== false && (p.categoryId === null || categoriasVisibles.has(p.categoryId)),
    );

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

    const visibleProducts: TotemProduct[] = prods.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      photoUrl: p.photoUrl,
      price: prodOverrides.get(p.id) ?? p.price,
      categoryId: p.categoryId ?? UNCATEGORIZED,
      removables: p.customizable
        ? quitables.filter((q) => q.productId === p.id).map((q) => ({ id: q.id, name: q.name }))
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
    const totemCombos: TotemCombo[] = combosVendibles.map((c) => ({
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
            // Los ingredientes que el cliente sacó de esta línea. Se valida
            // abajo contra la receta: el cliente no elige qué se puede sacar.
            removedIngredientIds: z.array(z.number().int()).max(30).optional(),
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

      // Únicos: desde que un producto se puede personalizar, el mismo id
      // aparece en varias líneas —una con cambios y otra sin— y la base
      // devuelve una sola fila por producto. Comparar contra la lista con
      // repetidos rechazaba el pedido entero por "no disponible".
      const productIds = [
        ...new Set(data.items.filter((i) => i.kind === "producto").map((i) => i.id)),
      ];
      const comboIds = [...new Set(data.items.filter((i) => i.kind === "combo").map((i) => i.id))];

      const productRows = productIds.length
        ? await db
            .select({
              id: products.id,
              name: products.name,
              price: products.price,
              categoryId: products.categoryId,
              customizable: products.customizable,
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

      // El local puede tener apagado algo que la empresa sigue vendiendo. El
      // menú ya no lo muestra, pero el carrito de la tablet puede ser anterior
      // a que lo apagaran.
      const [apagados, combosApagados] = await Promise.all([
        productosApagadosEnElLocal(location.id, productRows),
        combosApagadosEnElLocal(location.id, comboIds),
      ]);
      if (apagados.size > 0 || combosApagados.size > 0) {
        throw new Error("Algo de tu pedido ya no está disponible");
      }

      // Lo que el cliente sacó se valida contra la receta, no se cree. El
      // tótem podría mandar cualquier id: sólo se aceptan ingredientes que ese
      // producto lleva y que el dueño marcó como quitables, y sólo si el
      // producto está habilitado para personalizar.
      // Por índice de línea y no por producto: el mismo producto puede estar
      // dos veces con cambios distintos —uno sin tomate y otro como viene— y
      // guardarlo por id le pegaría los mismos cambios a las dos.
      const sacadosPorLinea = new Map<number, { id: number; name: string }[]>();
      const lineasConSacados = data.items
        .map((item, indice) => ({ item, indice }))
        .filter(
          ({ item }) => item.kind === "producto" && (item.removedIngredientIds?.length ?? 0) > 0,
        );
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
          const producto = productRows.find((p) => p.id === item.id)!;
          if (!producto.customizable) {
            throw new Error(`${producto.name} no se puede personalizar`);
          }
          const permitidos = quitables.filter((q) => q.productId === item.id);
          const elegidos = [...new Set(item.removedIngredientIds ?? [])].map((id) => {
            const ok = permitidos.find((p) => p.ingredientId === id);
            if (!ok) throw new Error(`Ese ingrediente no se puede sacar de ${producto.name}`);
            return { id, name: ok.name };
          });
          sacadosPorLinea.set(indice, elegidos);
        }
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

      // El consumo de stock se resuelve ANTES de abrir la transacción: son
      // lecturas, y si algo falla acá el pedido tiene que tomarse igual. Perder
      // una venta porque no pudimos calcular el inventario sería el peor de los
      // dos errores, el mismo criterio que con Mercado Pago más abajo.
      let consumo: Awaited<ReturnType<typeof calcularConsumo>> = [];
      try {
        await asegurarCodigosDeVenta(company.id);
        const lineas: LineaVendida[] = data.items.map((i, indice) => ({
          kind: i.kind,
          refId: i.id,
          quantity: i.quantity,
          removedIngredientIds: (sacadosPorLinea.get(indice) ?? []).map((x) => x.id),
        }));
        consumo = await calcularConsumo(company.id, lineas);
      } catch (error) {
        console.error("No se pudo calcular el stock de la venta:", error);
      }

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
            totemId: resuelto.totemId,
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
                // El nombre queda congelado, como el del producto: la comanda
                // de un pedido viejo tiene que seguir diciendo lo mismo.
                ingredientName: x.name,
              })),
            );
          }
        }

        // El descuento va en la misma transacción que el pedido: no puede
        // quedar un pedido sin su consumo ni un consumo sin su pedido.
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
  customerName: string;
  createdAt: string;
  deliveryMethod: "local" | "mostrador";
  paymentMethod: "efectivo" | "mercadopago";
  total: string;
  comments: string | null;
  items: { name: string; quantity: number; unitPrice: string }[];
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
        customerName: orders.customerName,
        createdAt: orders.createdAt,
        deliveryMethod: orders.deliveryMethod,
        paymentMethod: orders.paymentMethod,
        total: orders.total,
        comments: orders.comments,
        companyName: companies.name,
      })
      .from(orders)
      .innerJoin(locations, eq(locations.id, orders.locationId))
      .innerJoin(companies, eq(companies.id, locations.companyId))
      .where(and(eq(orders.id, data.orderId), eq(orders.locationId, resuelto.locationId)))
      .limit(1);

    if (!row) throw new Error("No encontramos ese pedido");

    const items = await db
      .select({
        name: orderItems.productName,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, data.orderId));

    const [totem] = await db
      .select({ printerMac: totems.printerMac, printerName: totems.printerName })
      .from(totems)
      .where(eq(totems.id, resuelto.totemId))
      .limit(1);

    return {
      companyName: row.companyName,
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      createdAt: row.createdAt.toISOString(),
      deliveryMethod: row.deliveryMethod,
      paymentMethod: row.paymentMethod,
      total: row.total,
      comments: row.comments,
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

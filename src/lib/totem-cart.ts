import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { calcularRegalo, type ResultadoRegalo, type UnidadesConRegalo } from "@/lib/regalo";

// Carrito del tótem. El campo `slug` guarda la clave del tótem completo
// —empresa/local/número, ver `totem-nav.ts`— y no sólo la empresa: si la
// tablet cambia de comercio, de sucursal o de puesto, el carrito se vacía en
// vez de arrastrar el pedido de otra pantalla.
/** Una línea del pedido: un producto suelto o un combo. */
export type TotemCartKind = "producto" | "combo";

/** Un ingrediente que el cliente sacó de una línea. */
export interface TotemCartRemoval {
  id: number;
  name: string;
}

/** Un ingrediente que el cliente pidió de más, con su precio y cuántos. */
export interface TotemCartExtra {
  id: number;
  name: string;
  price: string;
  quantity: number;
}

/** El pan que eligió el cliente, en los productos que se hacen en blanco o negro. */
export type Pan = "blanco" | "negro";

export interface TotemCartItem {
  kind: TotemCartKind;
  /** Id del producto o del combo, según kind. */
  refId: number;
  name: string;
  price: string;
  photoUrl: string | null;
  quantity: number;
  /**
   * Lo que el cliente le sacó. Vacío es el producto tal como viene. Sacar algo
   * no cambia el precio: es la misma hamburguesa, sin la cebolla.
   */
  removed: TotemCartRemoval[];
  /**
   * Lo que le agregó de más. Vacío es sin extras. A diferencia de sacar, cada
   * extra cuesta, así que suma al precio de la línea.
   */
  extras: TotemCartExtra[];
  /**
   * El pan elegido, solo en los productos que se hacen en los dos (`pan:
   * "ambos"` en el menú). Sin pan es un producto que no tiene esa elección.
   */
  pan?: Pan;
  /**
   * Lo que suma para "cada 12, 2 de regalo" UNA unidad de esta línea: un
   * sándwich de miga suma 1, el combo "12 clásicos" suma 12. Vacío o ausente =
   * no cuenta. Viene del menú y se refresca con `reprice`.
   */
  regalo?: UnidadesConRegalo[];
}

/**
 * Clave de una línea.
 *
 * Producto 3 y combo 3 son cosas distintas, y una hamburguesa sin cebolla —o
 * con doble carne— también es distinta de una hamburguesa: si compartieran
 * clave, pedir las dos daría "cantidad 2" de una sola y la cocina no sabría cuál
 * lleva qué. Los ids van ordenados para que el orden en que el cliente tocó las
 * cosas no genere dos líneas iguales.
 */
export const itemKey = (
  kind: TotemCartKind,
  refId: number,
  removed: TotemCartRemoval[] = [],
  extras: TotemCartExtra[] = [],
  pan?: Pan,
) => {
  const sacados = removed
    .map((r) => r.id)
    .sort((a, b) => a - b)
    .join(".");
  const agregados = extras
    .map((e) => `${e.id}x${e.quantity}`)
    .sort()
    .join(".");
  let clave = `${kind}-${refId}`;
  if (sacados) clave += `-sin${sacados}`;
  if (agregados) clave += `-mas${agregados}`;
  // Uno en pan blanco y otro en negro son dos líneas, como con o sin tomate.
  if (pan) clave += `-pan${pan}`;
  return clave;
};

/** La clave de una línea ya armada. */
export const claveDe = (i: Pick<TotemCartItem, "kind" | "refId" | "removed" | "extras" | "pan">) =>
  itemKey(i.kind, i.refId, i.removed, i.extras, i.pan);

// Colapsa NaN/Infinity a un fallback: un precio o cantidad corrupta (dato viejo
// migrado, string no numérico) no debe contaminar el total con "$NaN".
const num = (x: unknown, fallback = 0): number => {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
};

/** Precio unitario de una línea: base + lo que suman sus extras. */
export const precioLinea = (i: TotemCartItem) =>
  num(i.price) + i.extras.reduce((s, e) => s + num(e.price) * num(e.quantity), 0);

interface CartState {
  slug: string | null;
  items: TotemCartItem[];
  add: (
    slug: string,
    item: Omit<TotemCartItem, "quantity" | "removed" | "extras" | "pan" | "regalo"> & {
      removed?: TotemCartRemoval[];
      extras?: TotemCartExtra[];
      pan?: Pan;
      regalo?: UnidadesConRegalo[];
    },
  ) => void;
  /** Se sacan por clave, no por id: hay que decir cuál de las variantes. */
  removeOne: (clave: string) => void;
  removeAll: (clave: string) => void;
  /**
   * Cambia lo que una línea lleva sacado y agregado, desde el carrito. Cambiar
   * eso cambia la clave de la línea, así que mueve toda su cantidad a la
   * variante nueva y la fusiona si esa combinación ya estaba en el pedido.
   */
  setLineChanges: (
    slug: string,
    claveVieja: string,
    removed: TotemCartRemoval[],
    extras: TotemCartExtra[],
  ) => void;
  /**
   * Reajusta precio, nombre, foto y precio de los extras de las líneas contra el
   * menú vigente. El carrito guarda esos datos al agregar (vive en la tablet y
   * sobrevive a un cambio en el panel), así que sin esto una línea mostraría el
   * precio viejo hasta que el cliente la vuelva a agregar. El cobro no depende de
   * esto —`createTotemOrder` recalcula server-side—, pero el total a la vista
   * tiene que coincidir con lo que se va a cobrar.
   */
  reprice: (slug: string, vigentes: ItemVigente[]) => void;
  clear: () => void;
}

/** Precio y datos actuales de un ítem del menú, para reajustar el carrito. */
export interface ItemVigente {
  kind: TotemCartKind;
  refId: number;
  price: string;
  name: string;
  photoUrl: string | null;
  /** Precio vigente de cada extra de este producto, por id de ingrediente. */
  extras?: { id: number; price: string }[];
  /** Lo que suma para el regalo una unidad, según el menú de ahora. */
  regalo?: UnidadesConRegalo[];
}

export const useTotemCart = create<CartState>()(
  persist(
    (set) => ({
      slug: null,
      items: [],
      add: (slug, item) =>
        set((s) => {
          const items = s.slug === slug ? s.items : [];
          const removed = item.removed ?? [];
          const extras = item.extras ?? [];
          const clave = itemKey(item.kind, item.refId, removed, extras, item.pan);
          const found = items.find((i) => claveDe(i) === clave);
          return {
            slug,
            items: found
              ? items.map((i) => (claveDe(i) === clave ? { ...i, quantity: i.quantity + 1 } : i))
              : [...items, { ...item, removed, extras, quantity: 1 }],
          };
        }),
      removeOne: (clave) =>
        set((s) => ({
          items: s.items
            .map((i) => (claveDe(i) === clave ? { ...i, quantity: i.quantity - 1 } : i))
            .filter((i) => i.quantity > 0),
        })),
      removeAll: (clave) =>
        set((s) => ({
          items: s.items.filter((i) => claveDe(i) !== clave),
        })),
      setLineChanges: (slug, claveVieja, removed, extras) =>
        set((s) => {
          if (s.slug !== slug) return s;
          const linea = s.items.find((i) => claveDe(i) === claveVieja);
          if (!linea) return s;
          const nuevaClave = itemKey(linea.kind, linea.refId, removed, extras, linea.pan);
          if (nuevaClave === claveVieja) return s;
          const resto = s.items.filter((i) => claveDe(i) !== claveVieja);
          const existente = resto.find((i) => claveDe(i) === nuevaClave);
          return {
            items: existente
              ? resto.map((i) =>
                  claveDe(i) === nuevaClave ? { ...i, quantity: i.quantity + linea.quantity } : i,
                )
              : [...resto, { ...linea, removed, extras }],
          };
        }),
      reprice: (slug, vigentes) =>
        set((s) => {
          if (s.slug !== slug) return s;
          const porClave = new Map(vigentes.map((v) => [`${v.kind}-${v.refId}`, v]));
          let cambio = false;
          const items = s.items.map((i) => {
            const v = porClave.get(`${i.kind}-${i.refId}`);
            // Sin coincidencia: el producto ya no está en el menú. Se deja como
            // está; el checkout revalida disponibilidad y precio igual.
            if (!v) return i;
            // Extras: se actualiza el precio de cada uno contra el menú, sin
            // tocar la cantidad. Los que el menú ya no ofrece conservan su precio
            // viejo (el checkout los va a rechazar de todos modos).
            const preciosExtra = new Map((v.extras ?? []).map((e) => [e.id, e.price]));
            let extrasCambio = false;
            const extras = i.extras.map((e) => {
              const nuevo = preciosExtra.get(e.id);
              if (nuevo === undefined || nuevo === e.price) return e;
              extrasCambio = true;
              return { ...e, price: nuevo };
            });
            const regalo = v.regalo ?? [];
            const regaloCambio = JSON.stringify(regalo) !== JSON.stringify(i.regalo ?? []);
            if (
              i.price === v.price &&
              i.name === v.name &&
              i.photoUrl === v.photoUrl &&
              !extrasCambio &&
              !regaloCambio
            )
              return i;
            cambio = true;
            return { ...i, price: v.price, name: v.name, photoUrl: v.photoUrl, extras, regalo };
          });
          // Misma referencia si nada cambió: no dispara re-render de más.
          return cambio ? { items } : s;
        }),
      clear: () => set({ items: [] }),
    }),
    {
      name: "totem-cart",
      // v3: guardaba productId y no distinguía combos. v4: suma los extras. Las
      // tablets con un carrito a medio armar se migran en vez de romperse.
      version: 4,
      migrate: (state: unknown) => {
        const viejo = state as { slug?: string | null; items?: Record<string, unknown>[] };
        return {
          slug: viejo?.slug ?? null,
          items: (viejo?.items ?? []).map((i) => ({
            kind: (i.kind as TotemCartKind) ?? "producto",
            refId: num(i.refId ?? i.productId ?? 0),
            name: String(i.name ?? ""),
            price: String(i.price ?? "0"),
            photoUrl: (i.photoUrl as string | null) ?? null,
            quantity: Math.max(1, Math.round(num(i.quantity, 1))),
            // Los carritos de antes no tenían personalización: van sin nada
            // sacado ni agregado, que es justo lo que el cliente había pedido.
            removed: (i.removed as TotemCartRemoval[]) ?? [],
            extras: (i.extras as TotemCartExtra[]) ?? [],
            pan: (i.pan as Pan | undefined) ?? undefined,
          })),
        };
      },
    },
  ),
);

/** Lo que suman las líneas, sin el regalo. */
export const cartSubtotal = (items: TotemCartItem[]) =>
  items.reduce((t, i) => t + precioLinea(i) * i.quantity, 0);

/**
 * "Cada 12, 2 de regalo" sobre el carrito: cuántos salen gratis, cuánto se
 * descuenta y cuántos le corresponden todavía. Es la misma cuenta que hace el
 * servidor al tomar el pedido.
 */
export const regaloDelCarrito = (items: TotemCartItem[]): ResultadoRegalo =>
  calcularRegalo(
    items.flatMap((i) =>
      (i.regalo ?? []).map((r) => ({
        regla: r.regla,
        unidades: r.unidades * i.quantity,
        // Un sándwich suelto puede salir gratis; lo de adentro de un combo, no.
        precioUnitario: i.kind === "producto" ? precioLinea(i) : null,
      })),
    ),
  );

/** Lo que paga: las líneas menos el regalo. */
export const cartTotal = (items: TotemCartItem[]) =>
  cartSubtotal(items) - regaloDelCarrito(items).descuento;

export const cartCount = (items: TotemCartItem[]) => items.reduce((t, i) => t + i.quantity, 0);

export const formatPrice = (value: number | string) => {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? `$${n.toLocaleString("es-AR")}` : String(value);
};

// Sólo cuenta los ítems del negocio actual: evita mostrar el carrito de otro
// comercio mientras el store todavía tiene el slug viejo.
export function useCartForSlug(slug: string) {
  const storeSlug = useTotemCart((s) => s.slug);
  const items = useTotemCart((s) => s.items);
  return storeSlug === slug ? items : [];
}

/** Un producto del menú, con lo que hace falta para reajustar el carrito. */
interface ProductoVigente {
  id: number;
  name: string;
  price: string;
  photoUrl: string | null;
  extras: { id: number; price: string }[];
  regalo: { cada: number; cantidad: number } | null;
}

interface ComboVigente {
  id: number;
  name: string;
  price: string;
  photoUrl: string | null;
  regalo: UnidadesConRegalo[];
}

/** Lo que suma para el regalo una unidad de un producto del menú. */
export const regaloDeProducto = (p: Pick<ProductoVigente, "regalo">): UnidadesConRegalo[] =>
  p.regalo ? [{ regla: p.regalo, unidades: 1 }] : [];

/** Arma la lista de precios vigentes a partir del menú. */
export function vigentesDeMenu(products: ProductoVigente[], combos: ComboVigente[]): ItemVigente[] {
  return [
    ...products.map((p) => ({
      kind: "producto" as const,
      refId: p.id,
      price: p.price,
      name: p.name,
      photoUrl: p.photoUrl,
      extras: p.extras.map((e) => ({ id: e.id, price: e.price })),
      regalo: regaloDeProducto(p),
    })),
    ...combos.map((c) => ({
      kind: "combo" as const,
      refId: c.id,
      price: c.price,
      name: c.name,
      photoUrl: c.photoUrl,
      regalo: c.regalo,
    })),
  ];
}

/**
 * Reajusta el carrito contra el menú recién cargado. Se llama en cada pantalla
 * que ya tiene el menú fresco (browsing, carrito, checkout), así el total a la
 * vista sigue al precio del panel sin esperar a recargar la tablet.
 */
export function useRepriceCart(slug: string, products: ProductoVigente[], combos: ComboVigente[]) {
  const reprice = useTotemCart((s) => s.reprice);
  useEffect(() => {
    reprice(slug, vigentesDeMenu(products, combos));
  }, [slug, products, combos, reprice]);
}

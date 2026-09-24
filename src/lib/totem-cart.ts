import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

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
}

/**
 * Clave de una línea.
 *
 * Producto 3 y combo 3 son cosas distintas, y una hamburguesa sin cebolla
 * también es distinta de una hamburguesa: si compartieran clave, pedir las dos
 * daría "cantidad 2" de una sola y la cocina no sabría cuál lleva qué. Los ids
 * van ordenados para que el orden en que el cliente tocó los ingredientes no
 * genere dos líneas iguales.
 */
export const itemKey = (kind: TotemCartKind, refId: number, removed: TotemCartRemoval[] = []) => {
  const sacados = removed
    .map((r) => r.id)
    .sort((a, b) => a - b)
    .join(".");
  return sacados ? `${kind}-${refId}-sin${sacados}` : `${kind}-${refId}`;
};

interface CartState {
  slug: string | null;
  items: TotemCartItem[];
  add: (
    slug: string,
    item: Omit<TotemCartItem, "quantity" | "removed"> & {
      removed?: TotemCartRemoval[];
    },
  ) => void;
  /** Se sacan por clave, no por id: hay que decir cuál de las variantes. */
  removeOne: (clave: string) => void;
  removeAll: (clave: string) => void;
  /**
   * Cambia lo que una línea lleva sacado desde el carrito. Cambiar los quitados
   * cambia la clave de la línea, así que mueve toda su cantidad a la variante
   * nueva y la fusiona si esa combinación ya estaba en el pedido.
   */
  setLineRemovals: (slug: string, claveVieja: string, removed: TotemCartRemoval[]) => void;
  /**
   * Reajusta precio, nombre y foto de las líneas contra el menú vigente. El
   * carrito guarda esos datos al agregar (vive en la tablet y sobrevive a un
   * cambio en el panel), así que sin esto una línea mostraría el precio viejo
   * hasta que el cliente la vuelva a agregar. El cobro no depende de esto —
   * `createTotemOrder` recalcula server-side—, pero el total a la vista tiene
   * que coincidir con lo que se va a cobrar.
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
          const clave = itemKey(item.kind, item.refId, removed);
          const found = items.find((i) => itemKey(i.kind, i.refId, i.removed) === clave);
          return {
            slug,
            items: found
              ? items.map((i) =>
                  itemKey(i.kind, i.refId, i.removed) === clave
                    ? { ...i, quantity: i.quantity + 1 }
                    : i,
                )
              : [...items, { ...item, removed, quantity: 1 }],
          };
        }),
      removeOne: (clave) =>
        set((s) => ({
          items: s.items
            .map((i) =>
              itemKey(i.kind, i.refId, i.removed) === clave
                ? { ...i, quantity: i.quantity - 1 }
                : i,
            )
            .filter((i) => i.quantity > 0),
        })),
      removeAll: (clave) =>
        set((s) => ({
          items: s.items.filter((i) => itemKey(i.kind, i.refId, i.removed) !== clave),
        })),
      setLineRemovals: (slug, claveVieja, removed) =>
        set((s) => {
          if (s.slug !== slug) return s;
          const linea = s.items.find((i) => itemKey(i.kind, i.refId, i.removed) === claveVieja);
          if (!linea) return s;
          const nuevaClave = itemKey(linea.kind, linea.refId, removed);
          if (nuevaClave === claveVieja) return s;
          const resto = s.items.filter((i) => itemKey(i.kind, i.refId, i.removed) !== claveVieja);
          const existente = resto.find((i) => itemKey(i.kind, i.refId, i.removed) === nuevaClave);
          return {
            items: existente
              ? resto.map((i) =>
                  itemKey(i.kind, i.refId, i.removed) === nuevaClave
                    ? { ...i, quantity: i.quantity + linea.quantity }
                    : i,
                )
              : [...resto, { ...linea, removed }],
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
            if (i.price === v.price && i.name === v.name && i.photoUrl === v.photoUrl) return i;
            cambio = true;
            return { ...i, price: v.price, name: v.name, photoUrl: v.photoUrl };
          });
          // Misma referencia si nada cambió: no dispara re-render de más.
          return cambio ? { items } : s;
        }),
      clear: () => set({ items: [] }),
    }),
    {
      name: "totem-cart",
      // El carrito viejo guardaba productId y no distinguía combos. Las tablets
      // que tengan uno a medio armar se migran en vez de romperse.
      version: 3,
      migrate: (state: unknown) => {
        const viejo = state as { slug?: string | null; items?: Record<string, unknown>[] };
        return {
          slug: viejo?.slug ?? null,
          items: (viejo?.items ?? []).map((i) => ({
            kind: (i.kind as TotemCartKind) ?? "producto",
            refId: Number(i.refId ?? i.productId ?? 0),
            name: String(i.name ?? ""),
            price: String(i.price ?? "0"),
            photoUrl: (i.photoUrl as string | null) ?? null,
            quantity: Number(i.quantity ?? 1),
            // Los carritos de antes no tenían personalización: van sin nada
            // sacado, que es justo lo que el cliente había pedido.
            removed: (i.removed as TotemCartRemoval[]) ?? [],
          })),
        };
      },
    },
  ),
);

export const cartTotal = (items: TotemCartItem[]) =>
  items.reduce((t, i) => t + Number(i.price) * i.quantity, 0);

export const cartCount = (items: TotemCartItem[]) => items.reduce((t, i) => t + i.quantity, 0);

export const formatPrice = (value: number | string) => {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isNaN(n) ? String(value) : `$${n.toLocaleString("es-AR")}`;
};

// Sólo cuenta los ítems del negocio actual: evita mostrar el carrito de otro
// comercio mientras el store todavía tiene el slug viejo.
export function useCartForSlug(slug: string) {
  const storeSlug = useTotemCart((s) => s.slug);
  const items = useTotemCart((s) => s.items);
  return storeSlug === slug ? items : [];
}

/** Arma la lista de precios vigentes a partir del menú. */
export function vigentesDeMenu(
  products: { id: number; name: string; price: string; photoUrl: string | null }[],
  combos: { id: number; name: string; price: string; photoUrl: string | null }[],
): ItemVigente[] {
  return [
    ...products.map((p) => ({
      kind: "producto" as const,
      refId: p.id,
      price: p.price,
      name: p.name,
      photoUrl: p.photoUrl,
    })),
    ...combos.map((c) => ({
      kind: "combo" as const,
      refId: c.id,
      price: c.price,
      name: c.name,
      photoUrl: c.photoUrl,
    })),
  ];
}

/**
 * Reajusta el carrito contra el menú recién cargado. Se llama en cada pantalla
 * que ya tiene el menú fresco (browsing, carrito, checkout), así el total a la
 * vista sigue al precio del panel sin esperar a recargar la tablet.
 */
export function useRepriceCart(
  slug: string,
  products: { id: number; name: string; price: string; photoUrl: string | null }[],
  combos: { id: number; name: string; price: string; photoUrl: string | null }[],
) {
  const reprice = useTotemCart((s) => s.reprice);
  useEffect(() => {
    reprice(slug, vigentesDeMenu(products, combos));
  }, [slug, products, combos, reprice]);
}

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Carrito del tótem. El campo `slug` guarda la clave del tótem completo
// —empresa/local/número, ver `totem-nav.ts`— y no sólo la empresa: si la
// tablet cambia de comercio, de sucursal o de puesto, el carrito se vacía en
// vez de arrastrar el pedido de otra pantalla.
/** Una línea del pedido: un producto suelto o un combo. */
export type TotemCartKind = "producto" | "combo";

export interface TotemCartItem {
  kind: TotemCartKind;
  /** Id del producto o del combo, según kind. */
  refId: number;
  name: string;
  price: string;
  photoUrl: string | null;
  quantity: number;
}

/** Clave de una línea: producto 3 y combo 3 son cosas distintas. */
export const itemKey = (kind: TotemCartKind, refId: number) => `${kind}-${refId}`;

interface CartState {
  slug: string | null;
  items: TotemCartItem[];
  add: (slug: string, item: Omit<TotemCartItem, "quantity">) => void;
  removeOne: (kind: TotemCartKind, refId: number) => void;
  removeAll: (kind: TotemCartKind, refId: number) => void;
  clear: () => void;
}

export const useTotemCart = create<CartState>()(
  persist(
    (set) => ({
      slug: null,
      items: [],
      add: (slug, item) =>
        set((s) => {
          const items = s.slug === slug ? s.items : [];
          const clave = itemKey(item.kind, item.refId);
          const found = items.find((i) => itemKey(i.kind, i.refId) === clave);
          return {
            slug,
            items: found
              ? items.map((i) =>
                  itemKey(i.kind, i.refId) === clave ? { ...i, quantity: i.quantity + 1 } : i,
                )
              : [...items, { ...item, quantity: 1 }],
          };
        }),
      removeOne: (kind, refId) =>
        set((s) => ({
          items: s.items
            .map((i) =>
              itemKey(i.kind, i.refId) === itemKey(kind, refId)
                ? { ...i, quantity: i.quantity - 1 }
                : i,
            )
            .filter((i) => i.quantity > 0),
        })),
      removeAll: (kind, refId) =>
        set((s) => ({
          items: s.items.filter((i) => itemKey(i.kind, i.refId) !== itemKey(kind, refId)),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "totem-cart",
      // El carrito viejo guardaba productId y no distinguía combos. Las tablets
      // que tengan uno a medio armar se migran en vez de romperse.
      version: 2,
      migrate: (state: unknown) => {
        const viejo = state as { slug?: string | null; items?: Record<string, unknown>[] };
        return {
          slug: viejo?.slug ?? null,
          items: (viejo?.items ?? []).map((i) => ({
            kind: "producto" as const,
            refId: Number(i.refId ?? i.productId ?? 0),
            name: String(i.name ?? ""),
            price: String(i.price ?? "0"),
            photoUrl: (i.photoUrl as string | null) ?? null,
            quantity: Number(i.quantity ?? 1),
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

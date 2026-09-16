import { create } from "zustand";
import { persist } from "zustand/middleware";

// Carrito del tótem. Guarda el slug del negocio: si la tablet cambia de
// comercio, el carrito se vacía en vez de mezclar productos de dos negocios.
export interface TotemCartItem {
  productId: number;
  name: string;
  price: string;
  photoUrl: string | null;
  quantity: number;
}

interface CartState {
  slug: string | null;
  items: TotemCartItem[];
  add: (slug: string, item: Omit<TotemCartItem, "quantity">) => void;
  removeOne: (productId: number) => void;
  removeAll: (productId: number) => void;
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
          const found = items.find((i) => i.productId === item.productId);
          return {
            slug,
            items: found
              ? items.map((i) =>
                  i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i,
                )
              : [...items, { ...item, quantity: 1 }],
          };
        }),
      removeOne: (productId) =>
        set((s) => ({
          items: s.items
            .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i))
            .filter((i) => i.quantity > 0),
        })),
      removeAll: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    { name: "totem-cart" },
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

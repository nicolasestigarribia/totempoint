import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "./menu";

export type OrderStatus = "nuevo" | "preparacion" | "listo" | "entregado";
export type DeliveryMethod = "local" | "mostrador";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: number;
  customerName: string;
  delivery: DeliveryMethod;
  comments?: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: number;
}

interface State {
  cart: CartItem[];
  orders: Order[];
  nextOrderId: number;
  addToCart: (p: Product) => void;
  removeOne: (id: string) => void;
  removeAll: (id: string) => void;
  clearCart: () => void;
  placeOrder: (data: { customerName: string; delivery: DeliveryMethod; comments?: string }) => Order;
  setStatus: (orderId: number, status: OrderStatus) => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      cart: [],
      orders: [],
      nextOrderId: 104,
      addToCart: (p) =>
        set((s) => {
          const found = s.cart.find((i) => i.product.id === p.id);
          if (found) {
            return { cart: s.cart.map((i) => (i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i)) };
          }
          return { cart: [...s.cart, { product: p, quantity: 1 }] };
        }),
      removeOne: (id) =>
        set((s) => ({
          cart: s.cart
            .map((i) => (i.product.id === id ? { ...i, quantity: i.quantity - 1 } : i))
            .filter((i) => i.quantity > 0),
        })),
      removeAll: (id) => set((s) => ({ cart: s.cart.filter((i) => i.product.id !== id) })),
      clearCart: () => set({ cart: [] }),
      placeOrder: (data) => {
        const { cart, nextOrderId } = get();
        const total = cart.reduce((t, i) => t + i.product.price * i.quantity, 0);
        const order: Order = {
          id: nextOrderId,
          customerName: data.customerName,
          delivery: data.delivery,
          comments: data.comments,
          items: cart,
          total,
          status: "nuevo",
          createdAt: Date.now(),
        };
        set((s) => ({ orders: [order, ...s.orders], nextOrderId: s.nextOrderId + 1, cart: [] }));
        return order;
      },
      setStatus: (orderId, status) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === orderId ? { ...o, status } : o)) })),
    }),
    { name: "burger-point-store" }
  )
);

export const cartTotal = (cart: CartItem[]) => cart.reduce((t, i) => t + i.product.price * i.quantity, 0);
export const cartCount = (cart: CartItem[]) => cart.reduce((t, i) => t + i.quantity, 0);

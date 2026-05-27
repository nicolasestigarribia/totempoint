import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { KioskHeader } from "@/components/KioskHeader";
import { useStore, cartTotal, type DeliveryMethod } from "@/lib/store";
import { formatPrice } from "@/lib/menu";
import { useState } from "react";
import { Utensils, ShoppingBag, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Confirmar pedido — Burger Point" }] }),
  component: Checkout,
});

function Checkout() {
  const cart = useStore((s) => s.cart);
  const placeOrder = useStore((s) => s.placeOrder);
  const navigate = useNavigate();
  const total = cartTotal(cart);
  const [name, setName] = useState("");
  const [delivery, setDelivery] = useState<DeliveryMethod>("local");
  const [comments, setComments] = useState("");
  const canSubmit = name.trim().length > 0 && cart.length > 0;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen">
        <KioskHeader title="Confirmar" back="/categories" />
        <div className="mx-auto max-w-md px-6 py-20 text-center">
          <h1 className="font-display text-4xl">No hay productos</h1>
          <p className="mt-2 text-muted-foreground">Agregá algo al pedido para continuar.</p>
          <Link to="/categories" className="mt-6 inline-block rounded-full bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground">
            Ver menú
          </Link>
        </div>
      </div>
    );
  }

  const submit = () => {
    if (!canSubmit) return;
    const order = placeOrder({ customerName: name.trim(), delivery, comments: comments.trim() || undefined });
    navigate({ to: "/confirmation/$orderId", params: { orderId: String(order.id) } });
  };

  return (
    <div className="min-h-screen pb-40">
      <KioskHeader title="Casi listo" back="/cart" />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-8 font-display text-5xl">Confirmá tu pedido</h1>

        <section className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Tu nombre
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Lucía"
              className="h-16 w-full rounded-2xl border border-border bg-card px-5 text-xl outline-none transition focus:border-primary"
            />
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Método de entrega
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                { id: "local" as const, label: "Comer en el local", icon: Utensils },
                { id: "mostrador" as const, label: "Retirar en mostrador", icon: ShoppingBag },
              ]).map((opt) => {
                const active = delivery === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setDelivery(opt.id)}
                    className={`flex h-24 items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
                      active
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border bg-card hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${active ? "bg-gradient-primary text-primary-foreground" : "bg-secondary"}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="font-display text-xl leading-tight">{opt.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Comentarios (opcional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Ej: sin cebolla, punto medio…"
              className="w-full rounded-2xl border border-border bg-card p-4 text-base outline-none transition focus:border-primary"
            />
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Resumen</div>
            <ul className="space-y-1 text-sm">
              {cart.map((i) => (
                <li key={i.product.id} className="flex justify-between">
                  <span>
                    {i.quantity}× {i.product.name}
                  </span>
                  <span className="text-muted-foreground">{formatPrice(i.product.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
              <span className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Total</span>
              <span className="font-display text-3xl text-gold">{formatPrice(total)}</span>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <button
            disabled={!canSubmit}
            onClick={submit}
            className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-primary text-lg font-bold uppercase tracking-wider text-primary-foreground shadow-glow transition enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar pedido
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

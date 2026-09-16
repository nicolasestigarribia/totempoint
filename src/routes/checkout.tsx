import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { TotemHeader } from "@/components/TotemHeader";
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
        <TotemHeader title="Confirmar" back="/categories" />
        <div className="mx-auto max-w-md px-6 py-20 text-center">
          <h1 className="font-display text-4xl">No hay productos</h1>
          <p className="mt-2 text-muted-foreground">Agregá algo al pedido para continuar.</p>
          <Link
            to="/categories"
            className="mt-6 inline-block rounded-full bg-gradient-primary px-8 py-4 font-bold uppercase tracking-wider text-primary-foreground shadow-glow"
          >
            Ver menú
          </Link>
        </div>
      </div>
    );
  }

  const submit = () => {
    if (!canSubmit) return;
    const order = placeOrder({
      customerName: name.trim(),
      delivery,
      comments: comments.trim() || undefined,
    });
    navigate({ to: "/confirmation/$orderId", params: { orderId: String(order.id) } });
  };

  return (
    <div className="min-h-screen pb-40">
      <TotemHeader title="Casi listo" back="/cart" />
      <main className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[1fr,380px] md:px-10 md:py-14">
        <section className="space-y-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Último paso</div>
            <h1 className="mt-2 font-display text-5xl md:text-6xl">Confirmá tu pedido</h1>
          </div>

          <div>
            <label className="mb-3 block text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Tu nombre
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Lucía"
              className="h-16 w-full rounded-2xl border border-border bg-card px-5 text-xl outline-none transition focus:border-primary focus:shadow-glow"
            />
          </div>

          <div>
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Método de entrega
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  { id: "local" as const, label: "Comer en el local", icon: Utensils, desc: "En mesa" },
                  { id: "mostrador" as const, label: "Retirar en mostrador", icon: ShoppingBag, desc: "Para llevar" },
                ]
              ).map((opt) => {
                const active = delivery === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setDelivery(opt.id)}
                    className={`flex h-28 items-center gap-4 rounded-2xl border-2 p-5 text-left transition active:scale-[0.98] ${
                      active
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border bg-card hover:border-muted-foreground/60"
                    }`}
                  >
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                        active ? "bg-gradient-primary text-primary-foreground" : "bg-secondary"
                      }`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="font-display text-xl leading-tight">{opt.label}</div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Comentarios (opcional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Ej: sin cebolla, punto medio…"
              className="w-full resize-none rounded-2xl border border-border bg-card p-4 text-base outline-none transition focus:border-primary"
            />
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-border/60 bg-card p-6 shadow-card md:sticky md:top-28">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Resumen
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {cart.map((i) => (
              <li key={i.product.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-bold text-gold">{i.quantity}×</span> {i.product.name}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatPrice(i.product.price * i.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Total
            </span>
            <span className="font-display text-4xl text-gold">{formatPrice(total)}</span>
          </div>
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur md:px-10">
        <div className="mx-auto max-w-6xl">
          <button
            disabled={!canSubmit}
            onClick={submit}
            className="flex h-[4.5rem] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-primary text-xl font-extrabold uppercase tracking-wider text-primary-foreground shadow-glow transition enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar pedido · {formatPrice(total)}
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

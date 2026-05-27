import { createFileRoute, Link } from "@tanstack/react-router";
import { KioskHeader } from "@/components/KioskHeader";
import { useStore } from "@/lib/store";
import { formatPrice } from "@/lib/menu";
import { CheckCircle2, Clock, Utensils, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/confirmation/$orderId")({
  head: () => ({ meta: [{ title: "Pedido confirmado — Burger Point" }] }),
  component: Confirmation,
});

function Confirmation() {
  const { orderId } = Route.useParams();
  const order = useStore((s) => s.orders.find((o) => o.id === Number(orderId)));

  return (
    <div className="min-h-screen">
      <KioskHeader />
      <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-12 text-center md:py-16">
        <div className="relative mb-8">
          <div className="absolute inset-0 animate-ping rounded-full bg-gold/30" />
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-gold shadow-glow md:h-36 md:w-36">
            <CheckCircle2 className="h-16 w-16 text-gold-foreground md:h-20 md:w-20" strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="font-display text-5xl md:text-7xl">¡Pedido enviado!</h1>
        <p className="mt-3 flex items-center gap-2 text-lg text-muted-foreground">
          <Clock className="h-5 w-5 text-gold" />
          Tu pedido estará listo en unos minutos
        </p>

        <div className="mt-10 w-full rounded-3xl border border-border/60 bg-card p-8 shadow-card md:p-10">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Tu número de orden
          </div>
          <div className="mt-3 font-display text-8xl text-gold md:text-9xl">#{orderId}</div>

          {order && (
            <>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                {order.delivery === "local" ? (
                  <Utensils className="h-4 w-4" />
                ) : (
                  <ShoppingBag className="h-4 w-4" />
                )}
                <span className="font-semibold">{order.customerName}</span>
                <span>·</span>
                <span>
                  {order.delivery === "local" ? "Comer en el local" : "Retirar en mostrador"}
                </span>
              </div>

              <ul className="mt-6 space-y-1.5 border-t border-border pt-5 text-left text-sm">
                {order.items.map((i) => (
                  <li key={i.product.id} className="flex justify-between">
                    <span>
                      <span className="font-bold text-gold">{i.quantity}×</span> {i.product.name}
                    </span>
                    <span className="text-muted-foreground">
                      {formatPrice(i.product.price * i.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Total
                </span>
                <span className="font-display text-3xl text-gold">{formatPrice(order.total)}</span>
              </div>
            </>
          )}
        </div>

        <Link
          to="/"
          className="mt-10 flex h-20 w-full items-center justify-center rounded-2xl bg-gradient-primary text-xl font-extrabold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:scale-[1.01] active:scale-[0.98]"
        >
          Nuevo pedido
        </Link>
      </main>
    </div>
  );
}

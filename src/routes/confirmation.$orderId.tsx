import { createFileRoute, Link } from "@tanstack/react-router";
import { KioskHeader } from "@/components/KioskHeader";
import { useStore } from "@/lib/store";
import { CheckCircle2 } from "lucide-react";

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
      <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-16 text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 animate-ping rounded-full bg-gold/30" />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-gold shadow-glow">
            <CheckCircle2 className="h-14 w-14 text-gold-foreground" strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="font-display text-5xl md:text-6xl">¡Pedido enviado!</h1>
        <p className="mt-3 text-lg text-muted-foreground">Te avisaremos cuando esté listo</p>

        <div className="mt-10 w-full rounded-3xl border border-border bg-card p-8 shadow-card">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Tu número de orden</div>
          <div className="mt-2 font-display text-7xl text-gold">#{orderId}</div>
          {order ? (
            <div className="mt-4 text-sm text-muted-foreground">
              {order.customerName} · {order.delivery === "local" ? "Comer en el local" : "Retirar en mostrador"}
            </div>
          ) : null}
        </div>

        <Link
          to="/"
          className="mt-10 flex h-16 w-full items-center justify-center rounded-2xl bg-gradient-primary text-lg font-bold uppercase tracking-wider text-primary-foreground shadow-glow"
        >
          Nuevo pedido
        </Link>
      </main>
    </div>
  );
}

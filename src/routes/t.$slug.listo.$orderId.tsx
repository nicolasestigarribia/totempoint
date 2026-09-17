import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { getTotemOrder } from "@/lib/api/totem.functions";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { TotemError } from "@/components/totem/TotemError";
import { formatPrice } from "@/lib/totem-cart";

export const Route = createFileRoute("/t/$slug/listo/$orderId")({
  loader: ({ params }) =>
    getTotemOrder({ data: { slug: params.slug, orderId: Number(params.orderId) } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Pedido #${loaderData.orderNumber}` : "Pedido enviado" }],
  }),
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  component: ListoPage,
});

function ListoPage() {
  const order = Route.useLoaderData();
  useTotemTheme(order.accentColor, order.theme);
  const accent = order.accentColor || undefined;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <CheckCircle2 className="h-24 w-24" style={{ color: accent }} />

      <h1 className="mt-6 font-display text-5xl md:text-6xl">¡Pedido enviado!</h1>
      <p className="mt-3 text-xl text-muted-foreground">
        Gracias {order.customerName}, te avisamos cuando esté listo.
      </p>

      <div className="mt-10 rounded-3xl border border-border bg-card/40 px-14 py-8">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Tu número de pedido
        </div>
        <div className="mt-2 font-display text-7xl" style={{ color: accent }}>
          #{order.orderNumber}
        </div>
        <div className="mt-3 text-lg text-muted-foreground">Total: {formatPrice(order.total)}</div>
      </div>

      <Link
        to="/t/$slug"
        params={{ slug: order.slug }}
        className="mt-10 rounded-3xl px-12 py-6 font-display text-2xl uppercase tracking-wide text-white shadow-glow transition hover:scale-[1.02]"
        style={{ background: accent ?? "var(--primary)" }}
      >
        Nuevo pedido
      </Link>
    </div>
  );
}

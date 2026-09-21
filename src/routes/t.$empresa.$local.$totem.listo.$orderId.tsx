import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { getTotemOrder } from "@/lib/api/totem.functions";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { TotemError } from "@/components/totem/TotemError";
import { formatPrice } from "@/lib/totem-cart";

export const Route = createFileRoute("/t/$empresa/$local/$totem/listo/$orderId")({
  loader: ({ params }) =>
    getTotemOrder({
      data: {
        empresa: params.empresa,
        local: params.local,
        totem: Number(params.totem),
        orderId: Number(params.orderId),
      },
    }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Pedido #${loaderData.orderNumber}` : "Pedido enviado" }],
  }),
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  component: ListoPage,
});

/**
 * Cuánto se queda la pantalla del número antes de volver sola a la portada.
 *
 * El tótem tiene que quedar libre para el que viene atrás, pero no tan rápido
 * como para que el cliente no llegue a leer su número o sacarle una foto. Por
 * eso además se muestra la cuenta regresiva: que vuelva solo no puede ser una
 * sorpresa mientras alguien está mirando.
 */
const SEGUNDOS = 25;

function ListoPage() {
  const order = Route.useLoaderData();
  const nav = Route.useParams();
  const navigate = useNavigate();
  useTotemTheme(order.accentColor, order.theme, order.fontTheme, order.corners);
  const accent = order.accentColor || undefined;
  const [restan, setRestan] = useState(SEGUNDOS);

  useEffect(() => {
    const id = setInterval(() => setRestan((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (restan > 0) return;
    navigate({ to: "/t/$empresa/$local/$totem", params: nav, replace: true });
  }, [restan, navigate, nav]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <CheckCircle2 className="impacto h-24 w-24" style={{ color: accent }} />

      <h1 className="mt-6 font-display text-5xl md:text-6xl">¡Pedido enviado!</h1>
      <p className="mt-3 text-xl text-muted-foreground">
        Gracias {order.customerName}, te avisamos cuando esté listo.
      </p>

      <div className="mt-10 rounded-3xl border border-border bg-card/40 px-14 py-8">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Tu número de pedido
        </div>
        <div
          className="impacto mt-2 font-display text-7xl"
          // Entra un toque después del tilde, para que se lean en orden.
          style={{ color: accent, animationDelay: "160ms" }}
        >
          #{order.orderNumber}
        </div>
        <div className="mt-3 text-lg text-muted-foreground">Total: {formatPrice(order.total)}</div>
      </div>

      <Link
        to="/t/$empresa/$local/$totem"
        params={nav}
        className="mt-10 rounded-3xl px-12 py-6 font-display text-2xl uppercase tracking-wide text-white shadow-glow transition hover:scale-[1.02]"
        style={{ background: accent ?? "var(--primary)" }}
      >
        Nuevo pedido
      </Link>

      <p className="mt-6 text-sm text-muted-foreground">
        Volvemos al inicio en {Math.max(restan, 0)}s
      </p>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Smartphone, Check, ArrowLeft } from "lucide-react";
import { getTotemOrder, getTotemPaymentStatus } from "@/lib/api/totem.functions";
import { TotemError } from "@/components/totem/TotemError";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { formatPrice } from "@/lib/totem-cart";

export const Route = createFileRoute("/t/$slug/pagar/$orderId")({
  loader: ({ params }) =>
    getTotemOrder({ data: { slug: params.slug, orderId: Number(params.orderId) } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Pagar — ${loaderData.companyName}` : "Pagar" }],
  }),
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === "string" ? search.url : "",
  }),
  component: PagarPage,
});

/** Cada cuánto se le pregunta al servidor si el pago entró. */
const CADA_MS = 3000;

function PagarPage() {
  const order = Route.useLoaderData();
  const { slug, orderId } = Route.useParams();
  const { url } = useSearch({ from: "/t/$slug/pagar/$orderId" });
  const navigate = useNavigate();
  useTotemTheme(order.accentColor, order.theme);
  const accent = order.accentColor || undefined;

  const consultar = useServerFn(getTotemPaymentStatus);
  const [pagado, setPagado] = useState(false);
  const yaFui = useRef(false);

  // Mientras el cliente escanea, el tótem pregunta solo si el pago entró. No
  // depende del aviso de Mercado Pago, que puede perderse: acá hay alguien
  // parado esperando y la pantalla tiene que avanzar sí o sí.
  useEffect(() => {
    let vivo = true;

    const mirar = async () => {
      try {
        const r = await consultar({ data: { slug, orderId: Number(orderId) } });
        if (!vivo || !r.pagado || yaFui.current) return;
        yaFui.current = true;
        setPagado(true);
        // Un respiro para que el cliente vea que salió bien antes de pasar.
        setTimeout(() => {
          navigate({
            to: "/t/$slug/listo/$orderId",
            params: { slug, orderId: String(orderId) },
            replace: true,
          });
        }, 1200);
      } catch {
        // Se reintenta en la próxima vuelta.
      }
    };

    void mirar();
    const id = setInterval(mirar, CADA_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [consultar, slug, orderId, navigate]);

  if (!url) {
    return <TotemError message="No pudimos generar el pago. Avisale a quien te atiende." />;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-[560px] text-center">
        {pagado ? (
          <>
            <div
              className="mx-auto flex h-24 w-24 items-center justify-center rounded-full"
              style={{ background: accent ?? "var(--primary)" }}
            >
              <Check className="h-12 w-12 text-white" />
            </div>
            <h1 className="mt-6 font-display text-5xl">¡Pago recibido!</h1>
            <p className="mt-2 text-xl text-muted-foreground">Ya te llevamos a tu número.</p>
          </>
        ) : (
          <>
            <div className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>
              Pedido #{order.orderNumber}
            </div>
            <h1 className="mt-2 font-display text-4xl md:text-5xl">Escaneá para pagar</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Abrí la cámara o Mercado Pago en tu celular y apuntá al código.
            </p>

            {/* Fondo blanco fijo: sobre el fondo oscuro ninguna cámara lo lee. */}
            <div className="mx-auto mt-8 w-fit rounded-3xl bg-white p-5 shadow-card">
              <QRCodeSVG value={url} size={260} level="M" />
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <span className="font-display text-2xl uppercase tracking-wide text-muted-foreground">
                Total
              </span>
              <span className="font-display text-5xl" style={{ color: accent }}>
                {formatPrice(order.total)}
              </span>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-lg">Esperando el pago…</span>
            </div>

            <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              Si no te toma el código, pedí que te cobren en la caja con este número de pedido.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/t/$slug/listo/$orderId",
                  params: { slug, orderId: String(orderId) },
                  replace: true,
                })
              }
              className="mx-auto mt-6 flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Pagar en la caja
            </button>
          </>
        )}
      </div>
    </div>
  );
}

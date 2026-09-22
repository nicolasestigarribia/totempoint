import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Printer, Loader2 } from "lucide-react";
import { getTotemOrder, getTotemTicket, type TotemTicket } from "@/lib/api/totem.functions";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { TotemError } from "@/components/totem/TotemError";
import { formatPrice } from "@/lib/totem-cart";
import { buildTicket, type TicketData } from "@/lib/print/ticket";
import { getPaired } from "@/lib/print/printer-store";
import {
  reconectarGuardada,
  imprimir,
  conexionEnMemoria,
  soportaReconexion,
} from "@/lib/print/bluetooth";

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

function aTicketData(t: TotemTicket): TicketData {
  return {
    companyName: t.companyName,
    orderNumber: t.orderNumber,
    customerName: t.customerName,
    createdAt: new Date(t.createdAt),
    deliveryMethod: t.deliveryMethod,
    paymentMethod: t.paymentMethod,
    total: Number(t.total),
    comments: t.comments,
    items: t.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    })),
  };
}

type EstadoImpresion = "idle" | "imprimiendo" | "listo" | "error";

function ListoPage() {
  const order = Route.useLoaderData();
  const nav = Route.useParams();
  const navigate = useNavigate();
  const fetchTicket = useServerFn(getTotemTicket);
  useTotemTheme(order.accentColor, order.theme, order.fontTheme, order.corners);
  const accent = order.accentColor || undefined;
  const [restan, setRestan] = useState(SEGUNDOS);

  // Impresión del ticket en la impresora emparejada a este tótem (si hay).
  const [hayImpresora, setHayImpresora] = useState(false);
  const [estado, setEstado] = useState<EstadoImpresion>("idle");
  const [motivo, setMotivo] = useState<string | null>(null);
  const yaImprimio = useRef(false);

  const imprimirTicket = async () => {
    const paired = getPaired(nav.empresa, nav.local, Number(nav.totem));
    if (!paired) return;
    setEstado("imprimiendo");
    setMotivo(null);
    try {
      const ticket = await fetchTicket({
        data: {
          empresa: nav.empresa,
          local: nav.local,
          totem: Number(nav.totem),
          orderId: Number(nav.orderId),
        },
      });
      // Reusa la conexión viva de la sesión si la hay; si no, reconecta.
      let conn = conexionEnMemoria();
      if (!conn) conn = await reconectarGuardada(paired.deviceId);
      if (!conn) {
        setMotivo(
          soportaReconexion()
            ? "No se pudo reconectar la impresora."
            : "Este navegador no reconecta en una pantalla nueva. Emparejá desde el tótem en Android.",
        );
        setEstado("error");
        return;
      }
      await imprimir(conn, buildTicket(aTicketData(ticket)));
      setEstado("listo");
    } catch (err) {
      setMotivo(err instanceof Error ? err.message : String(err));
      setEstado("error");
    }
  };

  // Auto-imprime una sola vez al llegar a la pantalla de confirmación.
  useEffect(() => {
    const paired = getPaired(nav.empresa, nav.local, Number(nav.totem));
    setHayImpresora(!!paired);
    if (!paired || yaImprimio.current) return;
    yaImprimio.current = true;
    void imprimirTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {hayImpresora && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          {estado === "imprimiendo" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Imprimiendo ticket...
            </>
          ) : estado === "listo" ? (
            <button
              type="button"
              onClick={() => void imprimirTicket()}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 transition hover:text-foreground"
            >
              <Printer className="h-4 w-4" />
              Reimprimir ticket
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void imprimirTicket()}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 transition hover:text-foreground"
            >
              <Printer className="h-4 w-4" />
              {estado === "error" ? "No se pudo imprimir. Reintentar" : "Imprimir ticket"}
            </button>
          )}
        </div>
      )}
      {hayImpresora && estado === "error" && motivo && (
        <p className="mt-2 max-w-xs text-center text-xs text-muted-foreground">{motivo}</p>
      )}

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

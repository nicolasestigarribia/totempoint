import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChefHat,
  Clock,
  Loader2,
  PackageCheck,
  Plus,
  Smartphone,
  XCircle,
} from "lucide-react";
import { getMesaOrder, type MesaOrderStatus } from "@/lib/api/totem.functions";
import { OnlineError } from "@/components/online/OnlineError";
import { MesaHeader } from "@/components/mesa/MesaHeader";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { formatPrice } from "@/lib/totem-cart";
import {
  conUltimoEstado,
  tituloPedido,
  useAvisoPedido,
  useRefrescoSeguimiento,
} from "@/lib/aviso-pedido";
import { CodigoPedido } from "@/components/online/CodigoPedido";
import { useRecordarPedido } from "@/lib/pedidos-en-curso";

export const Route = createFileRoute("/m/$token/pedido/$tracking")({
  loader: ({ params }) =>
    conUltimoEstado(params.tracking, () =>
      getMesaOrder({ data: { token: params.token, tracking: params.tracking } }),
    ),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? tituloPedido(loaderData, `Pedido #${loaderData.orderNumber}`)
          : "Tu pedido",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  errorComponent: ({ error }) => <OnlineError message={error.message} />,
  component: SeguimientoMesaPage,
});

/**
 * Entregado, la pantalla vuelve sola al menú después de este tiempo: el
 * cliente ya tiene lo suyo en la mesa y lo próximo es pedir otra cosa.
 */
const VUELTA_AL_MENU_S = 40;

/**
 * El seguimiento de un pedido de mesa. Se actualiza solo y dice lo que le
 * importa al que está sentado: si ya lo vieron, si lo están haciendo y cuándo
 * se lo traen. Desde acá puede volver al menú a pedir algo más.
 */
function SeguimientoMesaPage() {
  const pedido = Route.useLoaderData();
  const { token, tracking } = Route.useParams();
  const router = useRouter();
  useTotemTheme(pedido.accentColor, pedido.theme, pedido.fontTheme, pedido.corners);
  const accent = pedido.accentColor || "var(--primary)";

  const terminado = pedido.status === "entregado" || pedido.status === "cancelado";
  useAvisoPedido(pedido, `Pedido #${pedido.orderNumber}`);
  // Si cierra la pestaña, la mesa se lo vuelve a ofrecer.
  useRecordarPedido({
    canal: `mesa:${token}`,
    ruta: `/m/${token}/pedido/${tracking}`,
    numero: `#${pedido.orderNumber}`,
    codigo: pedido.codigo,
    terminado,
  });

  useRefrescoSeguimiento(() => void router.invalidate(), terminado);

  const entregado = pedido.status === "entregado";
  const navigate = useNavigate();
  const [quedan, setQuedan] = useState(VUELTA_AL_MENU_S);
  useEffect(() => {
    if (!entregado) return;
    const id = setInterval(() => setQuedan((q) => Math.max(0, q - 1)), 1000);
    return () => clearInterval(id);
  }, [entregado]);
  useEffect(() => {
    if (entregado && quedan === 0) {
      void navigate({ to: "/m/$token", params: { token }, replace: true });
    }
  }, [entregado, quedan, navigate, token]);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <MesaHeader
        token={token}
        name={pedido.companyName}
        sucursal={pedido.locationName}
        logoUrl={pedido.logoUrl}
        mesa={pedido.tableNumber ?? 0}
        accent={accent}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {!terminado && (
          <p className="mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            En vivo
          </p>
        )}

        <Estado pedido={pedido} accent={accent} />

        {pedido.status !== "cancelado" && pedido.status !== "entregado" && (
          <div className="mt-6">
            <CodigoPedido codigo={pedido.codigo} accent={accent} cuando="cuando te lo traigan" />
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-card/40 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">Pedido</span>
            <span className="font-display text-3xl" style={{ color: accent }}>
              #{pedido.orderNumber}
            </span>
          </div>
          <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            {pedido.items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <span>
                  {i.quantity}× {i.name}
                  {i.tamanio && (
                    <span className="block text-xs text-muted-foreground">{i.tamanio}</span>
                  )}
                  {i.pan && (
                    <span className="block text-xs text-muted-foreground">Pan {i.pan}</span>
                  )}
                </span>
                <span className="shrink-0">{formatPrice(Number(i.unitPrice) * i.quantity)}</span>
              </li>
            ))}
          </ul>
          {pedido.regaloUnidades > 0 && (
            <p className="mt-3 text-sm font-bold text-emerald-400">
              + {pedido.regaloUnidades} de regalo, a elección de la casa
            </p>
          )}
          <div className="mt-3 flex justify-between border-t border-border pt-3 font-bold">
            <span>Total</span>
            <span>{formatPrice(Number(pedido.total))}</span>
          </div>
          {(pedido.paymentStatus === "pagado" || pedido.paymentMethod === "mercadopago") && (
            <p className="mt-1 text-sm text-muted-foreground">
              {pedido.paymentStatus === "pagado" ? "Pagado" : "Pendiente de pago con Mercado Pago"}
            </p>
          )}
        </div>

        <Link
          to="/m/$token"
          params={{ token }}
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-border py-3 font-bold"
        >
          <Plus className="h-4 w-4" /> Pedir algo más
        </Link>
        {entregado && (
          <p className="mt-3 text-center text-sm text-muted-foreground" aria-live="polite">
            Volvemos al menú en {quedan} s
          </p>
        )}
      </main>
    </div>
  );
}

function Estado({ pedido, accent }: { pedido: MesaOrderStatus; accent: string }) {
  if (pedido.status === "cancelado") {
    return (
      <Tarjeta icono={<XCircle className="h-12 w-12 text-destructive" />} titulo="Pedido cancelado">
        {pedido.vencioSinPagar
          ? "No se terminó de pagar a tiempo. Si lo querés, hacelo de nuevo."
          : "El local canceló el pedido. Consultá en el mostrador."}
      </Tarjeta>
    );
  }

  if (pedido.pagarEn) {
    return (
      <Tarjeta
        icono={<Smartphone className="h-12 w-12" style={{ color: accent }} />}
        titulo="Falta pagarlo"
      >
        <p>Tu pedido entra a la cocina apenas se acredite el pago.</p>
        <a
          href={pedido.pagarEn}
          className="mx-auto mt-4 flex h-12 w-full max-w-xs items-center justify-center rounded-2xl font-bold text-white"
          style={{ background: accent }}
        >
          Pagar con Mercado Pago
        </a>
      </Tarjeta>
    );
  }

  if (!pedido.acceptedAt) {
    return (
      <Tarjeta
        icono={<Loader2 className="h-12 w-12 animate-spin" style={{ color: accent }} />}
        titulo="Esperando que lo confirmen"
      >
        Ya les llegó. En un momento lo confirman.
      </Tarjeta>
    );
  }

  if (pedido.status === "entregado") {
    return (
      <Tarjeta
        icono={<PackageCheck className="h-12 w-12 text-emerald-400" />}
        titulo="¡En tu mesa!"
      >
        Que lo disfrutes.
      </Tarjeta>
    );
  }

  if (pedido.status === "preparacion") {
    return (
      <Tarjeta
        icono={<ChefHat className="h-12 w-12" style={{ color: accent }} />}
        titulo="Lo están preparando"
      >
        Cuando esté listo te lo llevamos a la mesa.
      </Tarjeta>
    );
  }

  return (
    <Tarjeta
      icono={
        pedido.paymentStatus === "pagado" ? (
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
        ) : (
          <Clock className="h-12 w-12" style={{ color: accent }} />
        )
      }
      titulo="¡Pedido recibido!"
    >
      En breve empiezan a prepararlo.
    </Tarjeta>
  );
}

function Tarjeta({
  icono,
  titulo,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-border bg-card/60 p-6 text-center">
      {icono}
      <h1 className="mt-3 font-display text-3xl">{titulo}</h1>
      <div className="mt-2 w-full text-muted-foreground">{children}</div>
    </div>
  );
}

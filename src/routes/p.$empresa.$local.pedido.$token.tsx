import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  Loader2,
  CheckCircle2,
  ChefHat,
  XCircle,
  Phone,
  Smartphone,
  Bike,
  Store,
  PackageCheck,
} from "lucide-react";
import { getOnlineOrder, type OnlineOrderStatus } from "@/lib/api/totem.functions";
import { OnlineError } from "@/components/online/OnlineError";
import { OnlineHeader } from "@/components/online/OnlineHeader";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { formatPrice } from "@/lib/totem-cart";
import { formatearNumeroPedido } from "@/lib/order-number";
import { formatearDistancia } from "@/lib/delivery";
import { AccionesPedido } from "@/components/online/AccionesPedido";

export const Route = createFileRoute("/p/$empresa/$local/pedido/$token")({
  loader: ({ params }) =>
    getOnlineOrder({ data: { empresa: params.empresa, local: params.local, token: params.token } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Pedido ${formatearNumeroPedido(loaderData.businessDate, loaderData.orderNumber)}`
          : "Tu pedido",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  errorComponent: ({ error }) => <OnlineError message={error.message} />,
  component: SeguimientoPage,
});

/** Cada cuánto se vuelve a preguntar. Más seguido mientras se espera un pago. */
const REFRESCO_PAGO_MS = 4_000;
const REFRESCO_MS = 15_000;
/** Pasado este tiempo sin que el local lo acepte, se le avisa al cliente. */
const DEMORA_CONFIRMACION_MS = 10 * 60 * 1000;

const horaDe = (d: Date) =>
  d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * El seguimiento del pedido online. El cliente la deja abierta en el celular:
 * se actualiza sola y le dice lo único que le importa — si se lo aceptaron, y
 * para cuándo lo tiene.
 */
function SeguimientoPage() {
  const pedido = Route.useLoaderData();
  const { empresa, local, token } = Route.useParams();
  const router = useRouter();
  useTotemTheme(pedido.accentColor, pedido.theme, pedido.fontTheme, pedido.corners);
  const accent = pedido.accentColor || "var(--primary)";

  const terminado = pedido.status === "entregado" || pedido.status === "cancelado";
  const esperandoPago = pedido.pagarEn !== null;

  // Se refresca el loader, que vuelve a pedir el estado (y a preguntarle a
  // Mercado Pago si el pago sigue pendiente).
  useEffect(() => {
    if (terminado) return;
    const id = setInterval(
      () => void router.invalidate(),
      esperandoPago ? REFRESCO_PAGO_MS : REFRESCO_MS,
    );
    return () => clearInterval(id);
  }, [router, terminado, esperandoPago]);

  const numero = formatearNumeroPedido(pedido.businessDate, pedido.orderNumber);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <OnlineHeader
        empresa={empresa}
        local={local}
        name={pedido.companyName}
        sucursal={pedido.locationName}
        logoUrl={pedido.logoUrl}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {/* Se actualiza solo: el punto que late lo dice sin palabras de más. */}
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
        <Pasos pedido={pedido} accent={accent} />

        {pedido.puedeModificar ? (
          <AccionesPedido
            pedido={pedido}
            empresa={empresa}
            local={local}
            token={token}
            accent={accent}
            onCambio={() => void router.invalidate()}
          />
        ) : (
          // Aceptado: lo están preparando o va en camino. Desde acá ya no se
          // cancela con un botón; se habla con el local.
          !terminado &&
          pedido.acceptedAt && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Si necesitás cambiar algo, llamá al local.
            </p>
          )
        )}

        <div className="mt-6 rounded-2xl border border-border bg-card/40 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">Pedido</span>
            <span className="font-display text-3xl" style={{ color: accent }}>
              {numero}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            A nombre de {pedido.customerName} · {horaDe(new Date(pedido.createdAt))}
          </p>

          <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            {pedido.items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <span>
                  {i.quantity}× {i.name}
                  {i.pan && (
                    <span className="block text-xs text-muted-foreground">Pan {i.pan}</span>
                  )}
                  {i.removed.length > 0 && (
                    <span className="block text-xs text-amber-400">
                      {i.removed.map((r) => `sin ${r}`).join(", ")}
                    </span>
                  )}
                  {i.extras.length > 0 && (
                    <span className="block text-xs text-emerald-400">
                      {i.extras.map((x) => `+${x.quantity} ${x.name}`).join(", ")}
                    </span>
                  )}
                </span>
                <span className="shrink-0">{formatPrice(Number(i.unitPrice) * i.quantity)}</span>
              </li>
            ))}
            {Number(pedido.regaloDescuento) > 0 && (
              <li className="flex justify-between gap-3 font-bold text-emerald-400">
                <span>Sándwiches de regalo</span>
                <span className="shrink-0">−{formatPrice(pedido.regaloDescuento)}</span>
              </li>
            )}
            {pedido.regaloUnidades > 0 && (
              <li className="flex justify-between gap-3 font-bold text-emerald-400">
                <span>+{pedido.regaloUnidades} de regalo, a elección del local</span>
                <span className="shrink-0">$0</span>
              </li>
            )}
            {pedido.deliveryFee && (
              <li className="flex justify-between gap-3 text-muted-foreground">
                <span>
                  Envío
                  {pedido.deliveryDistanceKm &&
                    ` · ${formatearDistancia(Number(pedido.deliveryDistanceKm))}`}
                </span>
                <span>{formatPrice(pedido.deliveryFee)}</span>
              </li>
            )}
          </ul>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="font-bold">Total</span>
            <span className="font-display text-2xl">{formatPrice(pedido.total)}</span>
          </div>

          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              {pedido.deliveryMethod === "envio" ? (
                <Bike className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <Store className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>
                {pedido.deliveryMethod === "envio"
                  ? `Envío a: ${pedido.deliveryAddress}`
                  : "Lo retirás en el local"}
                {pedido.deliveryDetails && <span className="block">{pedido.deliveryDetails}</span>}
              </span>
            </p>
            <p>
              {pedido.paymentMethod === "mercadopago"
                ? pedido.paymentStatus === "pagado"
                  ? "Pagado con Mercado Pago"
                  : "Pago con Mercado Pago"
                : pedido.cashPaysWith
                  ? `Pagás en efectivo con ${formatPrice(pedido.cashPaysWith)}`
                  : "Pagás en efectivo"}
            </p>
          </div>
        </div>

        {pedido.locationPhone && (
          <a
            href={`tel:${pedido.locationPhone.replace(/[^\d+]/g, "")}`}
            className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl border border-border font-bold"
          >
            <Phone className="h-4 w-4" />
            Llamar al local
          </a>
        )}

        {terminado && (
          <Link
            to="/p/$empresa/$local"
            params={{ empresa, local }}
            className="mt-3 flex h-12 items-center justify-center rounded-2xl font-bold text-white"
            style={{ background: accent }}
          >
            Hacer otro pedido
          </Link>
        )}
      </main>
    </div>
  );
}

function Estado({ pedido, accent }: { pedido: OnlineOrderStatus; accent: string }) {
  const envio = pedido.deliveryMethod === "envio";

  if (pedido.status === "cancelado") {
    return (
      <Tarjeta
        icono={<XCircle className="h-12 w-12 text-destructive" />}
        titulo={
          pedido.vencioSinPagar
            ? "Tu pedido venció sin pagarse"
            : pedido.canceladoPorCliente
              ? "Cancelaste tu pedido"
              : "No pudieron tomar tu pedido"
        }
      >
        {pedido.paymentStatus === "reembolso_pendiente"
          ? "Como ya lo habías pagado, el local te devuelve la plata. Si tenés dudas, llamalos."
          : pedido.vencioSinPagar
            ? "Pasaron 30 minutos sin que se complete el pago con Mercado Pago, así que lo cancelamos. No te cobramos nada: si todavía lo querés, hacé uno nuevo."
            : pedido.canceladoPorCliente
              ? "No te cobramos nada. Cuando quieras, hacés otro."
              : "Si querés saber por qué, llamá al local."}
      </Tarjeta>
    );
  }

  if (pedido.pagarEn) {
    return (
      <Tarjeta
        icono={<Smartphone className="h-12 w-12" style={{ color: accent }} />}
        titulo="Falta el pago"
      >
        <p>Tu pedido está anotado. Cuando pagues con Mercado Pago, se lo pasamos al local.</p>
        <a
          href={pedido.pagarEn}
          className="mt-4 flex h-12 items-center justify-center rounded-2xl font-bold text-white"
          style={{ background: accent }}
        >
          Pagar con Mercado Pago
        </a>
      </Tarjeta>
    );
  }

  if (!pedido.acceptedAt) {
    // Si nadie lo confirma en un rato (la comandera cerrada, un pico de
    // trabajo), el cliente no puede quedarse mirando un círculo que gira sin
    // saber qué hacer: se le dice y se le dan las dos salidas.
    const tarda = Date.now() - new Date(pedido.createdAt).getTime() > DEMORA_CONFIRMACION_MS;
    return (
      <Tarjeta
        icono={<Loader2 className="h-12 w-12 animate-spin" style={{ color: accent }} />}
        titulo="Esperando que el local lo confirme"
      >
        {tarda ? (
          <p className="text-amber-400">
            Está tardando más de lo normal en confirmarse.
            {pedido.locationPhone ? " Podés llamar al local" : " Podés esperar un poco más"}
            {pedido.puedeModificar ? " o cancelarlo desde acá abajo." : "."}
          </p>
        ) : (
          "Ya les llegó. En cuanto lo acepten te decimos para cuándo lo tenés. No hace falta que recargues la página."
        )}
      </Tarjeta>
    );
  }

  if (pedido.status === "entregado") {
    return (
      <Tarjeta
        icono={<PackageCheck className="h-12 w-12 text-emerald-400" />}
        titulo={envio ? "¡Entregado!" : "¡Listo!"}
      >
        Que lo disfrutes.
      </Tarjeta>
    );
  }

  const llega = pedido.etaMinutes
    ? new Date(new Date(pedido.acceptedAt).getTime() + pedido.etaMinutes * 60_000)
    : null;

  return (
    <Tarjeta
      icono={
        pedido.status === "preparacion" ? (
          <ChefHat className="h-12 w-12" style={{ color: accent }} />
        ) : (
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
        )
      }
      titulo={pedido.status === "preparacion" ? "Lo están preparando" : "¡Pedido confirmado!"}
    >
      {llega && (
        <p className="text-lg">
          {envio ? "Llega" : "Pasá a buscarlo"} alrededor de las{" "}
          <span className="font-bold text-foreground">{horaDe(llega)}</span>
          {pedido.etaMinutes && ` (unos ${pedido.etaMinutes} min)`}.
        </p>
      )}
    </Tarjeta>
  );
}

/**
 * Dónde está el pedido, en cuatro pasos. Responde de un vistazo lo que el
 * cliente se pregunta mirando el celular: ¿ya lo vieron?, ¿lo están haciendo?
 */
function Pasos({ pedido, accent }: { pedido: OnlineOrderStatus; accent: string }) {
  if (pedido.status === "cancelado" || pedido.pagarEn) return null;
  const envio = pedido.deliveryMethod === "envio";
  const pasos = ["Enviado", "Confirmado", "Preparando", envio ? "Entregado" : "Listo"];
  const actual = !pedido.acceptedAt
    ? 0
    : pedido.status === "recibido"
      ? 1
      : pedido.status === "preparacion"
        ? 2
        : 3;
  return (
    <ol className="mt-4 flex items-start" aria-label="Estado del pedido">
      {pasos.map((paso, i) => {
        const hecho = i <= actual;
        return (
          <li key={paso} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <div className="flex w-full items-center">
              <span
                className="h-0.5 flex-1 transition-colors duration-700"
                style={{ background: i === 0 ? "transparent" : hecho ? accent : "var(--border)" }}
              />
              <span
                className={`flex h-3 w-3 shrink-0 rounded-full transition-colors duration-700 ${
                  i === actual && i < 3 ? "ring-4 ring-current/20 animate-pulse" : ""
                }`}
                style={{ background: hecho ? accent : "var(--border)", color: accent }}
              />
              <span
                className="h-0.5 flex-1 transition-colors duration-700"
                style={{
                  background:
                    i === pasos.length - 1 ? "transparent" : i < actual ? accent : "var(--border)",
                }}
              />
            </div>
            <span
              className={`text-[11px] font-bold ${hecho ? "text-foreground" : "text-muted-foreground"}`}
            >
              {paso}
            </span>
          </li>
        );
      })}
    </ol>
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

import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Printer, Loader2 } from "lucide-react";
import { getTotemOrder, getTotemTicket, type TotemTicket } from "@/lib/api/totem.functions";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { TotemError } from "@/components/totem/TotemError";
import { formatPrice } from "@/lib/totem-cart";
import { buildTicket, type TicketData } from "@/lib/print/ticket";
import { formatearNumeroPedido } from "@/lib/order-number";
import { getPairedList, type PairedPrinter, type PrinterRole } from "@/lib/print/printer-store";
import {
  reconectarGuardada,
  imprimir,
  imprimirCompartida,
  conexionEnMemoria,
  soportaReconexion,
} from "@/lib/print/bluetooth";
import { esAppNativa, imprimirNativo } from "@/lib/print/native";

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
    meta: [
      {
        title: loaderData
          ? `Pedido ${formatearNumeroPedido(loaderData.businessDate, loaderData.orderNumber)}`
          : "Pedido enviado",
      },
    ],
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
const SEGUNDOS = 15;

function aTicketData(t: TotemTicket): TicketData {
  return {
    companyName: t.companyName,
    orderNumber: t.orderNumber,
    businessDate: t.businessDate,
    customerName: t.customerName,
    createdAt: new Date(t.createdAt),
    deliveryMethod: t.deliveryMethod,
    paymentMethod: t.paymentMethod,
    total: Number(t.total),
    comments: t.comments,
    regaloUnidades: t.regaloUnidades,
    regaloDescuento: Number(t.regaloDescuento),
    items: t.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      removed: i.removed,
      extras: i.extras,
      pan: i.pan,
    })),
  };
}

type EstadoImpresion = "idle" | "imprimiendo" | "listo" | "error";
type EstadoPorRol = Partial<
  Record<PrinterRole, { estado: EstadoImpresion; motivo: string | null }>
>;

const LABEL_ROL: Record<PrinterRole, string> = { totem: "Tótem", caja: "Caja" };

// La copia del cliente (tótem) sale primero; la de caja, que es compartida,
// después, porque tiene que reconectar y puede esperar su turno.
const ORDEN_ROL: Record<PrinterRole, number> = { totem: 0, caja: 1 };

function ListoPage() {
  const order = Route.useLoaderData();
  const nav = Route.useParams();
  const navigate = useNavigate();
  const fetchTicket = useServerFn(getTotemTicket);
  useTotemTheme(order.accentColor, order.theme, order.fontTheme, order.corners);
  const accent = order.accentColor || undefined;
  const [restan, setRestan] = useState(SEGUNDOS);

  // Impresión del ticket en las impresoras emparejadas a este tótem (si hay).
  const [printers, setPrinters] = useState<PairedPrinter[]>([]);
  const [nativo] = useState(() => esAppNativa());
  const [estados, setEstados] = useState<EstadoPorRol>({});
  const yaImprimio = useRef(false);

  // En el APK (nativo) no hay lista local: se imprime la copia del tótem por MAC.
  const rolesVisibles: PrinterRole[] = nativo
    ? ["totem"]
    : printers.map((p) => p.role).sort((a, b) => ORDEN_ROL[a] - ORDEN_ROL[b]);
  const hayImpresora = rolesVisibles.length > 0;

  const marcar = (role: PrinterRole, estado: EstadoImpresion, motivo: string | null = null) =>
    setEstados((prev) => ({ ...prev, [role]: { estado, motivo } }));

  // Imprime en una impresora del tótem (dedicada, conexión viva) o de caja
  // (compartida, reconecta → imprime → desconecta, reintentando si está ocupada).
  const imprimirEn = async (p: PairedPrinter, bytes: Uint8Array) => {
    marcar(p.role, "imprimiendo");
    try {
      if (p.role === "caja") {
        await imprimirCompartida(p.deviceId, bytes);
      } else {
        const conn = conexionEnMemoria(p.deviceId) ?? (await reconectarGuardada(p.deviceId));
        if (!conn) {
          throw new Error(
            soportaReconexion()
              ? "No se pudo reconectar la impresora."
              : "Este navegador no reconecta en una pantalla nueva. Emparejá desde el tótem en Android.",
          );
        }
        await imprimir(conn, bytes);
      }
      marcar(p.role, "listo");
    } catch (err) {
      marcar(p.role, "error", err instanceof Error ? err.message : String(err));
    }
  };

  const imprimirTicket = async (soloRol?: PrinterRole) => {
    const lista = getPairedList(nav.empresa, nav.local, Number(nav.totem));
    // Web necesita el emparejado local; el APK puede usar la MAC de la DB.
    if (!nativo && lista.length === 0) return;

    const ticket = await fetchTicket({
      data: {
        empresa: nav.empresa,
        local: nav.local,
        totem: Number(nav.totem),
        orderId: Number(nav.orderId),
      },
    });
    const bytes = buildTicket(aTicketData(ticket));

    // En el APK: Bluetooth nativo por MAC. La MAC de la DB (panel) gana sobre la
    // cache local, así que un cambio desde otra PC lo toma la tablet.
    if (nativo) {
      const mac = ticket.printerMac ?? lista.find((p) => p.role === "totem")?.deviceId ?? null;
      if (!mac) return;
      marcar("totem", "imprimiendo");
      try {
        await imprimirNativo(mac, bytes);
        marcar("totem", "listo");
      } catch (err) {
        marcar("totem", "error", err instanceof Error ? err.message : String(err));
      }
      return;
    }

    // En Chrome: tótem primero, caja después; una falla no corta la otra.
    const aImprimir = (soloRol ? lista.filter((p) => p.role === soloRol) : lista).sort(
      (a, b) => ORDEN_ROL[a.role] - ORDEN_ROL[b.role],
    );
    for (const p of aImprimir) await imprimirEn(p, bytes);
  };

  // Auto-imprime una sola vez al llegar a la pantalla de confirmación.
  useEffect(() => {
    const lista = getPairedList(nav.empresa, nav.local, Number(nav.totem));
    setPrinters(lista);
    if ((!nativo && lista.length === 0) || yaImprimio.current) return;
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

  // Efectivo se cobra en el mostrador, así que mientras no esté marcado como
  // cobrado el cliente tiene que saber que le falta ese paso.
  const faltaPagar = order.paymentStatus === "pendiente";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <CheckCircle2 className="impacto h-24 w-24" style={{ color: accent }} />

      {/* El número manda. Es lo único que el cliente se lleva de acá: es lo
          que van a cantar en el mostrador y lo que él va a mostrar. Antes el
          "¡Pedido enviado!" era más grande que el número, que es al revés de
          lo que la persona necesita. */}
      <h1 className="mt-4 font-display text-3xl md:text-4xl">¡Pedido enviado!</h1>

      <div className="mt-6 rounded-3xl border border-border bg-card/40 px-16 py-8">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Tu número de pedido
        </div>
        <div
          className="impacto mt-1 font-display text-8xl leading-none md:text-9xl"
          // Entra un toque después del tilde, para que se lean en orden.
          style={{ color: accent, animationDelay: "160ms" }}
        >
          {formatearNumeroPedido(order.businessDate, order.orderNumber)}
        </div>
      </div>

      {/* Y lo segundo que necesita: si ya está o si todavía tiene que pagar.
          Que se vaya sin saberlo es una discusión en la caja. */}
      {faltaPagar ? (
        <div
          className="mt-6 rounded-2xl border-2 px-8 py-4 text-xl font-bold"
          style={{ borderColor: accent, color: accent }}
        >
          Pasá por el mostrador a pagar {formatPrice(order.total)}
        </div>
      ) : (
        <p className="mt-6 text-xl text-muted-foreground">
          Pagaste {formatPrice(order.total)}. Te llamamos por tu número.
        </p>
      )}

      <p className="mt-4 text-lg text-muted-foreground">
        Gracias {order.customerName}, ya lo estamos preparando.
      </p>

      {hayImpresora && (
        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
          {rolesVisibles.map((role) => {
            const st = estados[role]?.estado ?? "idle";
            const motivo = estados[role]?.motivo ?? null;
            return (
              <div key={role} className="flex flex-col items-center gap-1">
                {st === "imprimiendo" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Imprimiendo ticket ({LABEL_ROL[role]})...
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void imprimirTicket(nativo ? undefined : role)}
                    className="flex items-center gap-2 rounded-full border border-border px-4 py-2 transition hover:text-foreground"
                  >
                    <Printer className="h-4 w-4" />
                    {st === "listo"
                      ? `Reimprimir (${LABEL_ROL[role]})`
                      : st === "error"
                        ? `No se pudo imprimir (${LABEL_ROL[role]}). Reintentar`
                        : `Imprimir ticket (${LABEL_ROL[role]})`}
                  </button>
                )}
                {st === "error" && motivo && (
                  <p className="max-w-xs text-center text-xs text-muted-foreground">{motivo}</p>
                )}
              </div>
            );
          })}
        </div>
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

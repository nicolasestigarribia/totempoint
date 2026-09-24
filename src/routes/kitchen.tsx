import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Clock,
  ChefHat,
  CheckCheck,
  PackageCheck,
  ChevronRight,
  Undo2,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Ban,
  Banknote,
  Smartphone,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { me } from "@/lib/api/auth.functions";
import {
  listKitchenOrders,
  setOrderStatus,
  setOrderPaid,
  verifyOrderPayment,
  cancelOrder,
  type KitchenOrder,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/api/orders.functions";
import { formatPrice } from "@/lib/totem-cart";
import { formatearNumeroPedido } from "@/lib/order-number";
import { mensajeDeError } from "@/lib/error-message";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { canEditSection } from "@/lib/auth/permissions";

export const Route = createFileRoute("/kitchen")({
  head: () => ({ meta: [{ title: "Panel de cocina" }] }),
  component: Kitchen,
});

const statusMeta: Record<
  OrderStatus,
  { label: string; pill: string; icon: typeof Clock; accent: string }
> = {
  recibido: {
    label: "Recibido",
    pill: "bg-primary/20 text-primary border-primary/40",
    icon: Clock,
    accent: "border-l-primary",
  },
  preparacion: {
    label: "En preparación",
    pill: "bg-gold/20 text-gold border-gold/40",
    icon: ChefHat,
    accent: "border-l-gold",
  },
  entregado: {
    label: "Entregado",
    pill: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    icon: PackageCheck,
    accent: "border-l-emerald-500",
  },
  cancelado: {
    label: "Cancelado",
    pill: "bg-destructive/20 text-destructive border-destructive/40",
    icon: Ban,
    accent: "border-l-destructive",
  },
};

const flow: Record<OrderStatus, "recibido" | "preparacion" | "entregado" | null> = {
  recibido: "preparacion",
  preparacion: "entregado",
  entregado: null,
  // Un pedido cancelado no vuelve atrás: si el cliente se arrepiente se toma
  // uno nuevo, así el cierre de caja del día no cambia después de hecho.
  cancelado: null,
};

const columns: OrderStatus[] = ["recibido", "preparacion", "entregado", "cancelado"];

const pagoMeta: Record<PaymentMethod, { label: string; icon: typeof Clock }> = {
  efectivo: { label: "Efectivo", icon: Banknote },
  mercadopago: { label: "Mercado Pago", icon: Smartphone },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.max(s, 0)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function Kitchen() {
  const navigate = useNavigate();
  const doMe = useServerFn(me);
  const fetchOrders = useServerFn(listKitchenOrders);
  const updateStatus = useServerFn(setOrderStatus);
  const updatePaid = useServerFn(setOrderPaid);
  const doVerify = useServerFn(verifyOrderPayment);
  const doCancel = useServerFn(cancelOrder);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  // Mirar la comandera y mover los pedidos son cosas distintas: al encargado
  // con "solo ver" el servidor le rechaza el cambio, así que no le mostramos
  // botones que no va a poder usar. El personal de cocina siempre puede.
  const [puedeOperar, setPuedeOperar] = useState(true);
  // Cancelar se confirma con un diálogo propio y no con window.confirm: la
  // comandera vive en una tablet en modo kiosco, donde el cartel del navegador
  // queda fuera de lugar y a veces ni aparece.
  const [aCancelar, setACancelar] = useState<KitchenOrder | null>(null);
  const [cancelando, setCancelando] = useState(false);
  // Quien entra desde el panel vuelve al panel. El personal de cocina no tiene
  // panel: para ellos esta pantalla es todo, y no se les muestra salida.
  const [tienePanel, setTienePanel] = useState(false);
  // Pedido de Mercado Pago que Mercado Pago no registra como pagado: antes de
  // pasarlo a efectivo se pregunta, porque cambia cómo cuenta en el cierre.
  const [aEfectivo, setAEfectivo] = useState<KitchenOrder | null>(null);
  const [cobrando, setCobrando] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setOrders(await fetchOrders());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los pedidos");
    }
  }, [fetchOrders]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await doMe();
      if (!user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      if (alive) {
        setTienePanel(
          user.roles.includes("owner") ||
            user.roles.includes("encargado") ||
            user.roles.includes("superadmin"),
        );
        setPuedeOperar(
          user.roles.includes("kitchen") ||
            user.roles.includes("owner") ||
            user.roles.includes("superadmin") ||
            canEditSection(user.permissions, "comandera"),
        );
      }
      await load();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [doMe, navigate, load]);

  // La cocina queda abierta todo el día: refrescamos solos para que entren los
  // pedidos nuevos sin que nadie toque la pantalla.
  useEffect(() => {
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const grouped = useMemo(() => {
    const g: Record<OrderStatus, KitchenOrder[]> = {
      recibido: [],
      preparacion: [],
      entregado: [],
      cancelado: [],
    };
    for (const o of orders) g[o.status].push(o);
    return g;
  }, [orders]);

  // Cancelar no pasa por acá: tiene su propia función porque además decide qué
  // hacer con la plata ya cobrada.
  const changeStatus = async (
    order: KitchenOrder,
    status: "recibido" | "preparacion" | "entregado",
  ) => {
    const previous = order.status;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    try {
      await updateStatus({ data: { orderId: order.id, status } });
    } catch (err) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: previous } : o)));
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  };

  const togglePagado = async (order: KitchenOrder) => {
    const pagado = order.paymentStatus === "pagado";
    setCobrando(order.id);
    try {
      // Un pedido de Mercado Pago no se da por cobrado a ojo: primero se le
      // pregunta a Mercado Pago. Si no lo tiene, recién ahí se ofrece
      // cobrarlo en efectivo.
      if (!pagado && order.paymentMethod === "mercadopago") {
        const { pagado: confirmado } = await doVerify({ data: { orderId: order.id } });
        if (confirmado) {
          toast.success(
            `Mercado Pago confirmó el pago del pedido ${formatearNumeroPedido(order.businessDate, order.orderNumber)}`,
          );
          await load();
        } else {
          setAEfectivo(order);
        }
        return;
      }
      await updatePaid({ data: { orderId: order.id, paid: !pagado } });
      await load();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo cambiar el estado del cobro"));
    } finally {
      setCobrando(null);
    }
  };

  const cobrarEnEfectivo = async () => {
    if (!aEfectivo) return;
    setCobrando(aEfectivo.id);
    try {
      const r = await updatePaid({ data: { orderId: aEfectivo.id, paid: true } });
      toast.success(
        r.via === "mercadopago"
          ? "Justo entró el pago por Mercado Pago"
          : `Pedido ${formatearNumeroPedido(aEfectivo.businessDate, aEfectivo.orderNumber)} cobrado en efectivo`,
      );
      setAEfectivo(null);
      await load();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo marcar como cobrado"));
    } finally {
      setCobrando(null);
    }
  };

  const confirmarCancelacion = async () => {
    if (!aCancelar) return;
    const cobrado = aCancelar.paymentStatus === "pagado";
    setCancelando(true);
    try {
      await doCancel({ data: { orderId: aCancelar.id } });
      setACancelar(null);
      await load();
      toast.success(cobrado ? "Cancelado, queda pendiente de reembolso" : "Pedido cancelado");
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo cancelar el pedido"));
    } finally {
      setCancelando(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto max-w-[1700px] px-6 py-8 md:px-10">
        {/* Encabezado al mínimo: cada píxel que se lleva el título es un pedido
            menos a la vista, y acá lo que importa son los pedidos. */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {tienePanel && (
              <a
                href="/admin"
                className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold transition hover:border-primary"
                title="Volver al panel"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Panel</span>
              </a>
            )}
            <h1 className="font-display text-3xl md:text-4xl">Cocina</h1>
            <p className="text-sm text-muted-foreground">
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold transition hover:border-primary"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 p-16 text-center">
            <h2 className="font-display text-3xl">Sin pedidos todavía</h2>
            <p className="mt-2 text-muted-foreground">
              Apenas entren los pedidos del tótem aparecerán acá.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((col) => {
              const Icon = statusMeta[col].icon;
              return (
                <section key={col} className="flex flex-col gap-3">
                  <header className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-gold" />
                      <h2 className="font-display text-xl">{statusMeta[col].label}</h2>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-0.5 text-sm font-extrabold">
                      {grouped[col].length}
                    </span>
                  </header>

                  <div className="space-y-3">
                    {grouped[col].map((o) => {
                      const next = flow[o.status];
                      return (
                        <article
                          key={o.id}
                          className={`rounded-2xl border border-border ${statusMeta[o.status].accent} border-l-4 bg-card p-4 shadow-card`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-display text-3xl text-gold">
                                {formatearNumeroPedido(o.businessDate, o.orderNumber)}
                              </div>
                              <div className="text-sm font-bold">{o.customerName}</div>
                              <div className="text-xs text-muted-foreground">
                                {o.deliveryMethod === "local"
                                  ? "Comer en el local"
                                  : "Retirar en mostrador"}
                                {" · "}
                                <span className="text-gold">{timeAgo(o.createdAt)}</span>
                              </div>
                            </div>
                            {/* Acá iba un cartelito con el estado, que decía lo
                                mismo que la columna donde está la tarjeta. El
                                borde de color ya lo indica, así que el lugar
                                queda para cancelar: una acción destructiva que
                                no merece un botón de ancho completo. */}
                            {o.status !== "cancelado" && puedeOperar && (
                              <button
                                type="button"
                                onClick={() => setACancelar(o)}
                                aria-label={`Cancelar el pedido ${formatearNumeroPedido(o.businessDate, o.orderNumber)}`}
                                title="Cancelar pedido"
                                className="shrink-0 rounded-xl p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                            {o.items.map((i, idx) => (
                              <li key={idx}>
                                <span className="flex justify-between">
                                  <span className="truncate">
                                    <span className="font-bold text-gold">{i.quantity}×</span>{" "}
                                    {i.productName}
                                  </span>
                                </span>
                                {/* Lo que hay que sacar va debajo del producto
                                    y resaltado: equivocarse acá significa
                                    rehacer el plato, así que no puede parecer
                                    un detalle del renglón. */}
                                {i.removed.length > 0 && (
                                  <span className="mt-0.5 block pl-5 text-xs font-bold uppercase tracking-wide text-amber-400">
                                    {i.removed.map((r) => `sin ${r}`).join(" · ")}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>

                          {o.comments && (
                            <div className="mt-3 rounded-lg bg-secondary p-2 text-xs italic text-muted-foreground">
                              {o.comments}
                            </div>
                          )}

                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {(() => {
                                  const P = pagoMeta[o.paymentMethod].icon;
                                  return <P className="h-3.5 w-3.5" />;
                                })()}
                                {pagoMeta[o.paymentMethod].label}
                              </span>

                              {/* El efectivo se marca a mano. Lo de Mercado Pago
                                  lo confirma Mercado Pago: cobrado así no se
                                  puede desmarcar, y sin confirmar se consulta
                                  antes de darlo por cobrado en la caja. */}
                              {o.paymentStatus === "reembolso_pendiente" ? (
                                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                  Devolver
                                </span>
                              ) : o.status === "cancelado" ? null : o.mpConfirmado ? (
                                <span
                                  className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300"
                                  title="Mercado Pago confirmó el pago"
                                >
                                  <BadgeCheck className="h-3 w-3" />
                                  Cobrado
                                </span>
                              ) : puedeOperar ? (
                                <button
                                  type="button"
                                  onClick={() => togglePagado(o)}
                                  disabled={cobrando === o.id}
                                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${
                                    o.paymentStatus === "pagado"
                                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                      : o.paymentMethod === "mercadopago"
                                        ? "border-sky-500/40 bg-sky-500/10 text-sky-300 hover:border-sky-300"
                                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                                  }`}
                                >
                                  {cobrando === o.id && (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  )}
                                  {o.paymentStatus === "pagado"
                                    ? "Cobrado"
                                    : o.paymentMethod === "mercadopago"
                                      ? "Esperando pago"
                                      : "Sin cobrar"}
                                </button>
                              ) : (
                                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  {o.paymentStatus === "pagado" ? "Cobrado" : "Sin cobrar"}
                                </span>
                              )}
                            </div>

                            <span className="shrink-0 font-display text-xl">
                              {formatPrice(o.total)}
                            </span>
                          </div>

                          {next && puedeOperar && (
                            <button
                              onClick={() => changeStatus(o, next)}
                              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-extrabold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:scale-[1.02] active:scale-95"
                            >
                              {statusMeta[next].label}
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                          {o.status === "entregado" && puedeOperar && (
                            <button
                              onClick={() => changeStatus(o, "preparacion")}
                              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                            >
                              <Undo2 className="h-4 w-4" /> Revertir
                            </button>
                          )}
                        </article>
                      );
                    })}
                    {grouped[col].length === 0 && (
                      <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-xs uppercase tracking-wider text-muted-foreground">
                        Sin pedidos
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={aEfectivo !== null} onOpenChange={(o) => !o && setAEfectivo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mercado Pago no registra el pago del{" "}
              {aEfectivo && formatearNumeroPedido(aEfectivo.businessDate, aEfectivo.orderNumber)}
            </DialogTitle>
            <DialogDescription>
              El cliente eligió pagar con Mercado Pago, pero el pago no aparece en la cuenta. Si lo
              cobraste en la caja, marcalo como efectivo: así cuenta en el cierre junto con el resto
              del efectivo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAEfectivo(null)}
              disabled={cobrando !== null}
              className="flex h-11 items-center rounded-xl border border-border px-5 text-sm font-bold transition hover:border-primary"
            >
              Todavía no pagó
            </button>
            <button
              type="button"
              onClick={cobrarEnEfectivo}
              disabled={cobrando !== null}
              className="flex h-11 items-center gap-2 rounded-xl bg-gradient-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
            >
              {cobrando !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Banknote className="h-4 w-4" />
              )}
              Cobrado en efectivo
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aCancelar !== null} onOpenChange={(o) => !o && setACancelar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Cancelar el pedido{" "}
              {aCancelar && formatearNumeroPedido(aCancelar.businessDate, aCancelar.orderNumber)}
            </DialogTitle>
            <DialogDescription>
              {aCancelar?.paymentStatus === "pagado"
                ? "Este pedido ya está cobrado. Al cancelarlo queda marcado como pendiente de reembolso y la plata se devuelve a mano, por caja o por Mercado Pago."
                : "El pedido deja de contar para el cierre de caja del día."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            No se puede deshacer: si el cliente se arrepiente, se toma un pedido nuevo.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setACancelar(null)}
              disabled={cancelando}
              className="flex h-11 items-center rounded-xl border border-border px-5 text-sm font-bold transition hover:border-primary"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={confirmarCancelacion}
              disabled={cancelando}
              className="flex h-11 items-center gap-2 rounded-xl bg-destructive px-5 text-sm font-bold text-destructive-foreground transition hover:brightness-110"
            >
              {cancelando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              Cancelar el pedido
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

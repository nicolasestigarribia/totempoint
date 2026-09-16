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
  LogOut,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { me, logout } from "@/lib/api/auth.functions";
import {
  listKitchenOrders,
  setOrderStatus,
  type KitchenOrder,
  type OrderStatus,
} from "@/lib/api/orders.functions";
import { formatPrice } from "@/lib/kiosk-cart";

export const Route = createFileRoute("/kitchen")({
  head: () => ({ meta: [{ title: "Panel de cocina" }] }),
  component: Kitchen,
});

const statusMeta: Record<
  OrderStatus,
  { label: string; pill: string; icon: typeof Clock; accent: string }
> = {
  nuevo: {
    label: "Nuevo",
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
  listo: {
    label: "Listo",
    pill: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    icon: CheckCheck,
    accent: "border-l-emerald-500",
  },
  entregado: {
    label: "Entregado",
    pill: "bg-muted text-muted-foreground border-border",
    icon: PackageCheck,
    accent: "border-l-muted-foreground",
  },
};

const flow: Record<OrderStatus, OrderStatus | null> = {
  nuevo: "preparacion",
  preparacion: "listo",
  listo: "entregado",
  entregado: null,
};

const columns: OrderStatus[] = ["nuevo", "preparacion", "listo", "entregado"];

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
  const doLogout = useServerFn(logout);
  const fetchOrders = useServerFn(listKitchenOrders);
  const updateStatus = useServerFn(setOrderStatus);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);

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
      nuevo: [],
      preparacion: [],
      listo: [],
      entregado: [],
    };
    for (const o of orders) g[o.status].push(o);
    return g;
  }, [orders]);

  const changeStatus = async (order: KitchenOrder, status: OrderStatus) => {
    const previous = order.status;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    try {
      await updateStatus({ data: { orderId: order.id, status } });
    } catch (err) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: previous } : o)));
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[1700px] px-6 py-8 md:px-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-gold">
              Operaciones
            </div>
            <h1 className="mt-2 font-display text-5xl md:text-6xl">Cocina</h1>
            <p className="mt-1 text-muted-foreground">
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} en total
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              className="flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold transition hover:border-primary"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={async () => {
                await doLogout();
                navigate({ to: "/login", replace: true });
              }}
              className="flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold transition hover:border-primary"
            >
              <LogOut className="h-4 w-4" />
              Salir
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
                                #{o.orderNumber}
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
                            <span
                              className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${statusMeta[o.status].pill}`}
                            >
                              {statusMeta[o.status].label}
                            </span>
                          </div>

                          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                            {o.items.map((i, idx) => (
                              <li key={idx} className="flex justify-between">
                                <span className="truncate">
                                  <span className="font-bold text-gold">{i.quantity}×</span>{" "}
                                  {i.productName}
                                </span>
                              </li>
                            ))}
                          </ul>

                          {o.comments && (
                            <div className="mt-3 rounded-lg bg-secondary p-2 text-xs italic text-muted-foreground">
                              {o.comments}
                            </div>
                          )}

                          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Total
                            </span>
                            <span className="font-display text-xl">{formatPrice(o.total)}</span>
                          </div>

                          {next && (
                            <button
                              onClick={() => changeStatus(o, next)}
                              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-extrabold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:scale-[1.02] active:scale-95"
                            >
                              {statusMeta[next].label}
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                          {o.status === "entregado" && (
                            <button
                              onClick={() => changeStatus(o, "listo")}
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
    </div>
  );
}

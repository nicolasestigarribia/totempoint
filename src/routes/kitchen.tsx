import { createFileRoute } from "@tanstack/react-router";
import { KioskHeader } from "@/components/KioskHeader";
import { useStore, type OrderStatus } from "@/lib/store";
import { formatPrice } from "@/lib/menu";
import { useMemo } from "react";
import { Clock, ChefHat, CheckCheck, PackageCheck, ChevronRight, Undo2 } from "lucide-react";

export const Route = createFileRoute("/kitchen")({
  head: () => ({ meta: [{ title: "Panel de cocina — Burger Point" }] }),
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

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function Kitchen() {
  const orders = useStore((s) => s.orders);
  const setStatus = useStore((s) => s.setStatus);

  const grouped = useMemo(() => {
    const g: Record<OrderStatus, typeof orders> = {
      nuevo: [],
      preparacion: [],
      listo: [],
      entregado: [],
    };
    for (const o of orders) g[o.status].push(o);
    return g;
  }, [orders]);

  return (
    <div className="min-h-screen">
      <KioskHeader title="Panel de cocina" />
      <main className="mx-auto max-w-[1700px] px-6 py-8 md:px-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Operaciones</div>
            <h1 className="mt-2 font-display text-5xl md:text-6xl">Cocina</h1>
            <p className="mt-1 text-muted-foreground">
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} en total
            </p>
          </div>
          <div className="hidden gap-4 md:flex">
            {columns.slice(0, 3).map((c) => (
              <div key={c} className="rounded-2xl border border-border bg-card px-4 py-2 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {statusMeta[c].label}
                </div>
                <div className="font-display text-3xl text-gold">{grouped[c].length}</div>
              </div>
            ))}
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 p-16 text-center">
            <h2 className="font-display text-3xl">Sin pedidos todavía</h2>
            <p className="mt-2 text-muted-foreground">
              Apenas entren los pedidos aparecerán acá.
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
                              <div className="font-display text-3xl text-gold">#{o.id}</div>
                              <div className="text-sm font-bold">{o.customerName}</div>
                              <div className="text-xs text-muted-foreground">
                                {o.delivery === "local" ? "Comer en el local" : "Retirar en mostrador"}
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
                            {o.items.map((i) => (
                              <li key={i.product.id} className="flex justify-between">
                                <span className="truncate">
                                  <span className="font-bold text-gold">{i.quantity}×</span>{" "}
                                  {i.product.name}
                                </span>
                              </li>
                            ))}
                          </ul>

                          {o.comments && (
                            <div className="mt-3 rounded-lg bg-secondary p-2 text-xs italic text-muted-foreground">
                              💬 {o.comments}
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
                              onClick={() => setStatus(o.id, next)}
                              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-extrabold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:scale-[1.02] active:scale-95"
                            >
                              {statusMeta[next].label}
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                          {o.status === "entregado" && (
                            <button
                              onClick={() => setStatus(o.id, "listo")}
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

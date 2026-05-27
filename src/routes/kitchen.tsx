import { createFileRoute } from "@tanstack/react-router";
import { KioskHeader } from "@/components/KioskHeader";
import { useStore, type OrderStatus } from "@/lib/store";
import { formatPrice } from "@/lib/menu";
import { useMemo } from "react";

export const Route = createFileRoute("/kitchen")({
  head: () => ({ meta: [{ title: "Panel de cocina — Burger Point" }] }),
  component: Kitchen,
});

const statusMeta: Record<OrderStatus, { label: string; color: string }> = {
  nuevo: { label: "Nuevo", color: "bg-primary/20 text-primary border-primary/40" },
  preparacion: { label: "En preparación", color: "bg-gold/20 text-gold border-gold/40" },
  listo: { label: "Listo", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  entregado: { label: "Entregado", color: "bg-muted text-muted-foreground border-border" },
};

const flow: Record<OrderStatus, OrderStatus | null> = {
  nuevo: "preparacion",
  preparacion: "listo",
  listo: "entregado",
  entregado: null,
};

const columns: OrderStatus[] = ["nuevo", "preparacion", "listo", "entregado"];

function Kitchen() {
  const orders = useStore((s) => s.orders);
  const setStatus = useStore((s) => s.setStatus);

  const grouped = useMemo(() => {
    const g: Record<OrderStatus, typeof orders> = { nuevo: [], preparacion: [], listo: [], entregado: [] };
    for (const o of orders) g[o.status].push(o);
    return g;
  }, [orders]);

  return (
    <div className="min-h-screen">
      <KioskHeader title="Panel de cocina" />
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-5xl">Cocina</h1>
            <p className="text-muted-foreground">{orders.length} pedidos en total</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 p-16 text-center">
            <h2 className="font-display text-3xl">Sin pedidos todavía</h2>
            <p className="mt-2 text-muted-foreground">Apenas entren los pedidos aparecerán acá.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((col) => (
              <section key={col} className="flex flex-col gap-3">
                <header className="flex items-center justify-between px-1">
                  <h2 className="font-display text-2xl">{statusMeta[col].label}</h2>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">
                    {grouped[col].length}
                  </span>
                </header>
                <div className="space-y-3">
                  {grouped[col].map((o) => {
                    const next = flow[o.status];
                    return (
                      <article
                        key={o.id}
                        className="rounded-2xl border border-border bg-card p-4 shadow-card"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-display text-3xl text-gold">#{o.id}</div>
                            <div className="text-sm font-medium">{o.customerName}</div>
                            <div className="text-xs text-muted-foreground">
                              {o.delivery === "local" ? "Comer en el local" : "Retirar en mostrador"}
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusMeta[o.status].color}`}>
                            {statusMeta[o.status].label}
                          </span>
                        </div>

                        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                          {o.items.map((i) => (
                            <li key={i.product.id} className="flex justify-between">
                              <span>
                                <span className="font-bold text-gold">{i.quantity}×</span> {i.product.name}
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
                          <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
                          <span className="font-display text-xl">{formatPrice(o.total)}</span>
                        </div>

                        {next && (
                          <button
                            onClick={() => setStatus(o.id, next)}
                            className="mt-3 h-11 w-full rounded-xl bg-gradient-primary text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:scale-[1.02]"
                          >
                            Pasar a {statusMeta[next].label}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

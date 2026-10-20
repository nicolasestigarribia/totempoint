import { Flame } from "lucide-react";
import type { TotemProduct } from "@/lib/api/totem.functions";
import { formatPrice } from "@/lib/totem-cart";

/** La etiqueta de lo más vendido, sobre la foto o al lado del nombre. */
export function EtiquetaMasPedido({ grande = false }: { grande?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-400 font-black uppercase tracking-wide text-black shadow-lg ${
        grande ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      <Flame className={grande ? "h-4 w-4" : "h-3 w-3"} />
      Más pedido
    </span>
  );
}

/**
 * "Lo más pedido", arriba de las categorías: el que no sabe qué elegir ve lo
 * que eligen los demás y llega con un toque. Sale solo de las ventas de la
 * sucursal; sin ventas suficientes no se muestra.
 */
export function LoMasPedido({
  productos,
  accent,
  onElegir,
}: {
  productos: TotemProduct[];
  accent: string;
  onElegir: (p: TotemProduct) => void;
}) {
  if (productos.length === 0) return null;
  return (
    <section className="mb-5" aria-label="Lo más pedido">
      <h2 className="mb-2 flex items-center gap-2 font-display text-2xl">
        <Flame className="h-6 w-6" style={{ color: accent }} />
        Lo más pedido
      </h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {productos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onElegir(p)}
            className="relative flex h-40 w-36 shrink-0 flex-col justify-end overflow-hidden rounded-2xl border border-border/60 bg-card text-left transition active:scale-95"
          >
            {p.photoUrl ? (
              <img
                src={p.photoUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, ${accent}, transparent)` }}
              />
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <span className="relative z-10 p-2.5">
              <span className="line-clamp-2 block font-display text-lg leading-tight text-white">
                {p.name}
              </span>
              <span className="mt-0.5 block text-sm font-bold" style={{ color: "#fff" }}>
                {p.tamanios.length > 0 ? "desde " : ""}
                {formatPrice(p.price)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

import type { LucideIcon } from "lucide-react";

/**
 * Pestañas del panel: una sección larga partida en partes que se ven de a una.
 * Quien entra a "Pedido online" a cargar el horario no tiene que bajar por el
 * link, los envíos y el mapa para encontrarlo.
 */
export function Pestanias<T extends string>({
  opciones,
  activa,
  onCambiar,
}: {
  opciones: { id: T; label: string; icon?: LucideIcon; aviso?: boolean }[];
  activa: T;
  onCambiar: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card/40 p-1"
    >
      {opciones.map((o) => {
        const sel = o.id === activa;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={sel}
            onClick={() => onCambiar(o.id)}
            className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              sel
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }`}
          >
            {o.icon && <o.icon className="h-4 w-4" />}
            {o.label}
            {/* Algo pendiente en esa pestaña: un punto, sin texto que distraiga. */}
            {o.aviso && !sel && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}

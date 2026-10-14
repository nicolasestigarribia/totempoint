import { useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { FondoCategoria, type CategoriaVisible } from "@/components/online/menu/GrillaCategorias";

/**
 * Las categorías con foto, pegadas arriba mientras se recorre el menú: marcan
 * en cuál estás y llevan a cualquier otra. La flecha vuelve a la grilla.
 *
 * Sin desenfoque ni sombras: un elemento pegajoso se recompone en cada cuadro
 * del scroll, y con varias fotos adentro es justo lo que traba un teléfono.
 */
export function CarruselCategorias({
  categorias,
  activa,
  accent,
  onElegir,
  onVolver,
  className = "",
}: {
  categorias: CategoriaVisible[];
  activa: string | null;
  accent: string;
  onElegir: (id: string) => void;
  onVolver: () => void;
  className?: string;
}) {
  const tira = useRef<HTMLDivElement>(null);

  // Se corre sola para que la marcada no quede escondida a un costado. Se
  // mueve solo la tira, nunca la página.
  useEffect(() => {
    const cont = tira.current;
    const el = cont?.querySelector<HTMLElement>(`[data-cat="${activa}"]`);
    if (!cont || !el) return;
    cont.scrollTo({
      left: el.offsetLeft - cont.clientWidth / 2 + el.clientWidth / 2,
      behavior: "smooth",
    });
  }, [activa]);

  return (
    <nav aria-label="Categorías" className={`sticky top-16 z-20 bg-background ${className}`}>
      <div className="mx-auto flex w-full max-w-2xl items-center gap-2 py-2 pl-4">
        <button
          type="button"
          onClick={onVolver}
          aria-label="Ver todas las categorías"
          className="flex h-16 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card/60"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div
          ref={tira}
          className="no-scrollbar relative flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 pr-4"
        >
          {categorias.map((c) => {
            const esta = c.id === activa;
            return (
              <button
                key={c.id}
                type="button"
                data-cat={c.id}
                aria-current={esta ? "true" : undefined}
                onClick={() => onElegir(c.id)}
                className={`relative flex h-16 w-32 shrink-0 flex-col justify-end overflow-hidden rounded-2xl text-left transition ${
                  esta
                    ? "-translate-y-0.5 scale-[1.03] border-2"
                    : "border border-border/60 opacity-75"
                }`}
                style={esta ? { borderColor: accent } : undefined}
              >
                <FondoCategoria foto={c.foto} accent={accent} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/5" />
                <span className="relative z-10 truncate px-2 pb-1.5 font-display text-lg leading-none text-white">
                  {c.nombre}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

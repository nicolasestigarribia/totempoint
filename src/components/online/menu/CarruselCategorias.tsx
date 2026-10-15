import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { FondoCategoria, type CategoriaVisible } from "@/components/online/menu/GrillaCategorias";

/**
 * Las categorías con foto, pegadas arriba mientras se recorre el menú: marcan
 * en cuál estás y llevan a cualquier otra. La flecha vuelve a la grilla.
 *
 * Sin desenfoque ni sombras: un elemento pegajoso se recompone en cada cuadro
 * del scroll, y con varias fotos adentro es justo lo que traba un teléfono.
 *
 * El fondo liso aparece solo cuando queda pegado, para que el menú no se vea
 * pasar por debajo. Quieto en su lugar es transparente: si no, tapaba la
 * grilla y las luces del fondo y quedaba una franja lisa en el medio.
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
  const marca = useRef<HTMLDivElement>(null);
  const [pegado, setPegado] = useState(false);

  // Una marca de alto cero justo antes: cuando sube por detrás del encabezado
  // (64px, el `top-16` del sticky), el carrusel quedó pegado.
  useEffect(() => {
    const el = marca.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setPegado(!e.isIntersecting && e.boundingClientRect.top < 65),
      { rootMargin: "-65px 0px 0px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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

  // En la PC no hay dedo: flechas a los costados y la rueda del mouse, que
  // acá mueve en horizontal. En el teléfono las flechas no se muestran.
  const mover = (dir: number) =>
    tira.current?.scrollBy({ left: dir * tira.current.clientWidth * 0.7, behavior: "smooth" });
  const flecha =
    "absolute top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-foreground sm:flex";

  return (
    <>
      <div ref={marca} aria-hidden className={className} />
      <nav
        aria-label="Categorías"
        className={`sticky top-16 z-20 transition-colors ${
          pegado ? "border-b border-border bg-background" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 py-2 pl-4">
          <button
            type="button"
            onClick={onVolver}
            aria-label="Ver todas las categorías"
            className="flex h-16 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card/60"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="relative min-w-0 flex-1">
            <div
              ref={tira}
              onWheel={(e) => {
                if (e.deltaY !== 0) tira.current?.scrollBy({ left: e.deltaY });
              }}
              className="no-scrollbar relative flex gap-2 overflow-x-auto py-1 pr-4"
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
            <button
              type="button"
              aria-label="Categorías anteriores"
              onClick={() => mover(-1)}
              className={`${flecha} left-1`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Más categorías"
              onClick={() => mover(1)}
              className={`${flecha} right-5`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}

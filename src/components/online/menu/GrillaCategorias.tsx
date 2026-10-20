import { ChevronRight } from "lucide-react";

/** Una sección del menú tal como la muestran la grilla y el carrusel. */
export interface CategoriaVisible {
  /** El id de la sección en la página ("combos", "cat-12"). */
  id: string;
  nombre: string;
  foto: string | null;
  cantidad: number;
}

/** El fondo de una categoría: su foto o, sin foto, el color de la marca. */
export function FondoCategoria({
  foto,
  accent,
  viva,
}: {
  foto: string | null;
  accent: string;
  /** Desfase del acercamiento lento (en la grilla); sin él, la foto queda quieta. */
  viva?: number;
}) {
  return foto ? (
    <img
      src={foto}
      alt=""
      loading="lazy"
      className={`absolute inset-0 h-full w-full object-cover ${viva !== undefined ? "ken-burns" : ""}`}
      // Cada una arranca en otro punto del movimiento, para que no respiren a la vez.
      style={viva !== undefined ? { animationDelay: `-${viva * 3.5}s` } : undefined}
    />
  ) : (
    <div
      className="absolute inset-0 bg-card"
      style={{ backgroundImage: `linear-gradient(135deg, ${accent}, transparent 80%)` }}
    />
  );
}

/**
 * Lo primero que ve el cliente al abrir el menú: las categorías con foto, como
 * la pantalla de categorías del tótem. La primera ocupa todo el ancho, para que
 * la pantalla tenga una portada y no una planilla.
 */
export function GrillaCategorias({
  categorias,
  accent,
  onAbrir,
  destacados,
}: {
  categorias: CategoriaVisible[];
  accent: string;
  onAbrir: (id: string) => void;
  /** Lo que va entre el título y la grilla ("Lo más pedido"). */
  destacados?: React.ReactNode;
}) {
  return (
    <section aria-label="Categorías" className="pb-6">
      <h1 className="mb-4 font-display text-5xl leading-[0.9]">
        ¿Qué vas a <span style={{ color: accent }}>pedir</span>?
      </h1>
      {destacados}
      <div className="grid grid-cols-2 gap-3">
        {categorias.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onAbrir(c.id)}
            className={`aparece group relative flex flex-col justify-end overflow-hidden rounded-3xl text-left shadow-card transition duration-300 hover:-translate-y-1 hover:scale-[1.02] active:-translate-y-1 active:scale-[1.02] motion-reduce:transform-none ${
              i === 0 ? "col-span-2 h-40" : "h-32"
            }`}
            style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
          >
            <FondoCategoria foto={c.foto} accent={accent} viva={i} />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/5" />
            {/* Un brillo del color de la marca que aparece al tocar. */}
            <div
              className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-active:opacity-100"
              style={{ background: `linear-gradient(to top, ${accent}66, transparent 70%)` }}
            />
            <div className="relative z-10 flex items-end justify-between gap-2 p-3">
              <div className="min-w-0">
                {/* En las de media pantalla, una palabra larga ("Empanadas") a 24 px
                    se metía debajo de la flecha: ahí va más chica. */}
                <span
                  className={`block break-words font-display leading-none text-white ${
                    i === 0 ? "text-2xl" : "text-[clamp(1.05rem,5vw,1.5rem)]"
                  }`}
                >
                  {c.nombre}
                </span>
                <span className="mt-1 block text-xs text-white/70">
                  {c.cantidad} {c.cantidad === 1 ? "producto" : "productos"}
                </span>
              </div>
              {/* La flecha del tótem: dice "tocá acá" y se corre al pasar. */}
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition group-hover:translate-x-1 group-active:translate-x-1"
                style={{ background: accent }}
              >
                <ChevronRight className="h-5 w-5" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

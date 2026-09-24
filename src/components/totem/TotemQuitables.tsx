import type { TotemRemovable } from "@/lib/api/totem.functions";

/**
 * Lo que se le puede sacar a un producto, adentro de su tarjeta.
 *
 * Pasó por dos versiones peores antes de esta. Primero fue una pantalla
 * completa que se abría al tocar el producto: funcionaba, pero pedir en un
 * tótem es un ritmo de tocar y seguir y una pantalla que se adueña del lugar
 * lo corta. Después fue una línea que había que desplegar, y ese toque de más
 * seguía siendo un toque de más. Ahora los ingredientes están a la vista y se
 * tachan directo.
 *
 * Lo que no cambia es el botón de agregar: es el mismo que el de cualquier
 * otro producto. El cliente que no quiere sacar nada —que son casi todos— no
 * tiene que hacer nada distinto, y nada que la mayoría se saltea se interpone
 * entre él y su pedido.
 */
export function TotemQuitables({
  quitables,
  sacados,
  accent,
  onAlternar,
}: {
  quitables: TotemRemovable[];
  sacados: number[];
  accent?: string;
  onAlternar: (id: number) => void;
}) {
  const color = accent ?? "var(--primary)";

  return (
    <div className="space-y-1.5">
      {/* Sin este renglón los chips parecen la lista de ingredientes y nadie
          los toca. Dice qué pasa si los tocás, en tres palabras. */}
      <p className="text-xs uppercase tracking-wider text-muted-foreground">¿Le sacamos algo?</p>
      {/* Una sola fila que se desliza con el dedo, no varias que se apilan:
          un producto con cinco ingredientes hacía su tarjeta mucho más alta
          que las de al lado y la grilla quedaba despareja.

          El degradado de la derecha es el que avisa que hay más: un chip
          cortado al ras del borde se lee como un error de diseño, no como
          algo que se puede deslizar. */}
      <div className="relative">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {quitables.map((q) => {
            const fuera = sacados.includes(q.id);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onAlternar(q.id)}
                aria-pressed={fuera}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition active:scale-95 ${
                  fuera
                    ? "border-transparent font-medium text-white"
                    : "border-border text-muted-foreground hover:border-primary"
                }`}
                style={fuera ? { background: color } : undefined}
              >
                {/* El estado va escrito, no dibujado: a medio metro y de pie, un
                  tilde apagado no se distingue de uno encendido. */}
                {fuera ? `sin ${q.name}` : q.name}
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent" />
      </div>
    </div>
  );
}

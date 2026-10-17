import { formatPrice, type Tamanio } from "@/lib/totem-cart";

/**
 * El tamaño de un producto que se vende en más de uno (pizza grande o chica),
 * dentro de la misma tarjeta, como el pan.
 *
 * Cada opción dice su precio, así el cliente ve lo que cambia antes de tocar.
 * Viene marcado el primero, y el botón de agregar sigue donde estaba: elegir
 * tamaño no es un paso aparte.
 */
export function ElegirTamanio({
  tamanios,
  elegido,
  onElegir,
  accent,
  grande = false,
}: {
  tamanios: Tamanio[];
  elegido: string;
  onElegir: (nombre: string) => void;
  accent: string;
  /** Tamaño del tótem, que se toca con el dedo de lejos. */
  grande?: boolean;
}) {
  if (tamanios.length === 0) return null;
  return (
    <div
      role="radiogroup"
      aria-label="Tamaño"
      className={`inline-flex flex-wrap self-start rounded-full border border-border p-0.5 ${grande ? "text-base" : "text-xs"}`}
    >
      {tamanios.map((t) => {
        const activo = elegido === t.nombre;
        return (
          <button
            key={t.nombre}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onElegir(t.nombre)}
            className={`rounded-full font-bold transition ${grande ? "px-4 py-2" : "px-3 py-1"} ${
              activo ? "text-white" : "text-muted-foreground"
            }`}
            style={activo ? { background: accent } : undefined}
          >
            {t.nombre} · {formatPrice(t.precio)}
          </button>
        );
      })}
    </div>
  );
}

import type { Pan } from "@/lib/totem-cart";

/**
 * El pan de un sándwich, dentro de la misma tarjeta del producto.
 *
 * Solo aparece en los que se hacen en blanco o negro: ahí el cliente toca uno
 * u otro y el botón de agregar sigue donde estaba, sin un paso aparte que corte
 * el ritmo de pedir. Viene marcado el blanco, así quien no lo mira igual pide
 * algo válido. Los que se hacen en un solo pan lo dicen y no preguntan.
 */
export function ElegirPan({
  pan,
  elegido,
  onElegir,
  accent,
  grande = false,
}: {
  pan: "blanco" | "negro" | "ambos" | null;
  elegido: Pan;
  onElegir: (p: Pan) => void;
  accent: string;
  /** Tamaño del tótem, que se toca con el dedo de lejos. */
  grande?: boolean;
}) {
  if (!pan) return null;
  if (pan !== "ambos") {
    return (
      <p className={`text-muted-foreground ${grande ? "text-base" : "text-xs"}`}>En pan {pan}</p>
    );
  }
  return (
    <div
      role="radiogroup"
      aria-label="Pan"
      className={`inline-flex self-start rounded-full border border-border p-0.5 ${grande ? "text-base" : "text-xs"}`}
    >
      {(["blanco", "negro"] as const).map((p) => {
        const activo = elegido === p;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onElegir(p)}
            className={`rounded-full font-bold transition ${grande ? "px-4 py-2" : "px-3 py-1"} ${
              activo ? "text-white" : "text-muted-foreground"
            }`}
            style={activo ? { background: accent } : undefined}
          >
            Pan {p}
          </button>
        );
      })}
    </div>
  );
}

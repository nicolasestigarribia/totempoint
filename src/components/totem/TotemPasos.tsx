import { Check } from "lucide-react";

export type PasoTotem = "elegir" | "pedido" | "pagar";

const PASOS: { id: PasoTotem; label: string }[] = [
  { id: "elegir", label: "Elegí" },
  { id: "pedido", label: "Tu pedido" },
  { id: "pagar", label: "Confirmá" },
];

/**
 * En qué paso del pedido está el cliente.
 *
 * Alguien parado frente a un tótem que no conoce necesita saber dos cosas:
 * cuánto falta y que esto se termina. Tres pasos a la vista contestan las dos
 * de un vistazo, y de paso vuelven predecible lo que viene: ya sabés que
 * después de elegir vas a poder revisar antes de confirmar nada.
 *
 * Los pasos ya hechos se marcan con un tilde en vez de repetir el número: el
 * número dice dónde estás, el tilde dice lo que ya resolviste.
 */
export function TotemPasos({ actual, accent }: { actual: PasoTotem; accent?: string }) {
  const indiceActual = PASOS.findIndex((p) => p.id === actual);

  return (
    <ol className="flex items-center gap-2" aria-label="Pasos del pedido">
      {PASOS.map((paso, i) => {
        const hecho = i < indiceActual;
        const activo = i === indiceActual;

        return (
          <li key={paso.id} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 transition ${
                activo ? "text-white" : hecho ? "text-foreground" : "text-muted-foreground"
              }`}
              style={activo ? { background: accent ?? "var(--primary)" } : undefined}
              aria-current={activo ? "step" : undefined}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm ${
                  activo
                    ? "bg-black/25 text-white"
                    : hecho
                      ? "text-white"
                      : "border border-border text-muted-foreground"
                }`}
                style={hecho ? { background: accent ?? "var(--primary)" } : undefined}
              >
                {hecho ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="hidden text-sm font-bold uppercase tracking-wide sm:inline">
                {paso.label}
              </span>
            </div>

            {i < PASOS.length - 1 && (
              <span
                aria-hidden
                className={`h-0.5 w-4 rounded-full sm:w-6 ${hecho ? "" : "bg-border"}`}
                style={hecho ? { background: accent ?? "var(--primary)" } : undefined}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

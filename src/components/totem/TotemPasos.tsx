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
 * cuánto falta y que esto se termina. Tres pasos a la vista contestan las dos.
 *
 * La primera versión ponía números adentro de píldoras y quedaba recargada:
 * el número no aporta nada que el orden no diga ya, y el círculo alrededor
 * competía con el resto de la barra. Acá queda el nombre del paso y una línea
 * debajo que se pinta a medida que se avanza, como una barra de progreso
 * partida en tres. Lo que ya pasó lleva un tilde.
 *
 * En pantallas angostas solo se lee el paso actual, porque tres etiquetas no
 * entran sin apretujarse; los otros dos quedan como rayitas, que igual
 * comunican cuánto falta.
 */
export function TotemPasos({ actual, accent }: { actual: PasoTotem; accent?: string }) {
  const indiceActual = PASOS.findIndex((p) => p.id === actual);
  const color = accent ?? "var(--primary)";

  return (
    <ol className="flex items-end gap-2 sm:gap-3" aria-label="Pasos del pedido">
      {PASOS.map((paso, i) => {
        const hecho = i < indiceActual;
        const activo = i === indiceActual;
        const alcanzado = hecho || activo;

        return (
          <li key={paso.id} className="flex flex-col gap-1.5">
            <span
              className={`flex items-center gap-1.5 whitespace-nowrap text-xs font-bold uppercase tracking-wide transition ${
                activo ? "" : hecho ? "text-muted-foreground" : "text-muted-foreground/50"
              } ${activo ? "" : "hidden sm:flex"}`}
              style={activo ? { color } : undefined}
              aria-current={activo ? "step" : undefined}
            >
              {hecho && <Check className="h-3.5 w-3.5" aria-hidden />}
              {paso.label}
            </span>

            <span
              aria-hidden
              className={`h-1 rounded-full transition-all duration-300 ${
                activo ? "w-14 sm:w-full" : "w-6 sm:w-full"
              } ${alcanzado ? "" : "bg-border"}`}
              style={alcanzado ? { background: color, opacity: activo ? 1 : 0.45 } : undefined}
            />
          </li>
        );
      })}
    </ol>
  );
}

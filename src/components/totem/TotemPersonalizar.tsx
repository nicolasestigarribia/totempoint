import { useEffect, useState } from "react";
import { X, Check, Plus } from "lucide-react";
import type { TotemProduct, TotemRemovable } from "@/lib/api/totem.functions";
import { formatPrice } from "@/lib/totem-cart";

/**
 * "¿Le sacamos algo?", antes de sumar el producto al pedido.
 *
 * Aparece sólo para los productos que el dueño habilitó, y con los
 * ingredientes que él marcó como quitables: el cliente elige entre lo que el
 * negocio ya decidió que se puede sacar, no entre toda la receta. Sacar algo
 * no cambia el precio, y la pantalla lo dice, porque si no la primera pregunta
 * en el mostrador va a ser esa.
 *
 * Es una pantalla completa y no un menú chico: esto se toca con el dedo, de
 * pie y a medio metro. Por el mismo motivo cada ingrediente es un botón
 * grande, con su estado escrito además de dibujado — "sin tomate" en vez de
 * sólo un tilde apagado, que a un metro no se distingue.
 */
export function TotemPersonalizar({
  producto,
  accent,
  iniciales,
  ctaLabel = "Agregar al pedido",
  onCancel,
  onConfirm,
}: {
  producto: TotemProduct;
  accent?: string;
  /** Lo ya sacado, para editar una línea del carrito en vez de arrancar limpio. */
  iniciales?: number[];
  /** Texto del botón principal: "Agregar al pedido" al sumar, "Guardar cambios" al editar. */
  ctaLabel?: string;
  onCancel: () => void;
  onConfirm: (sacados: TotemRemovable[]) => void;
}) {
  const [sacados, setSacados] = useState<number[]>(iniciales ?? []);
  const color = accent ?? "var(--primary)";

  // Salir con Escape: no hace falta en la tablet, pero el dueño mira el tótem
  // desde su computadora y ahí quedarse encerrado en un modal es molesto.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCancel]);

  const alternar = (id: number) =>
    setSacados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const confirmar = () => onConfirm(producto.removables.filter((r) => sacados.includes(r.id)));

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label={`Personalizar ${producto.name}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5 md:px-12">
        <div className="min-w-0">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">{producto.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tocá lo que no querés. Sacar algo no cambia el precio.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Volver sin agregar"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border transition hover:border-primary active:scale-95"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-12">
        <div className="mx-auto grid w-full max-w-[1000px] gap-3 sm:grid-cols-2">
          {producto.removables.map((r) => {
            const fuera = sacados.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => alternar(r.id)}
                aria-pressed={fuera}
                className={`flex items-center justify-between gap-4 rounded-3xl border-2 px-6 py-5 text-left transition active:scale-[0.98] ${
                  fuera ? "border-transparent opacity-60" : "border-border hover:border-primary"
                }`}
                style={fuera ? { background: "var(--muted)" } : undefined}
              >
                <span
                  className={`font-display text-2xl ${fuera ? "text-muted-foreground line-through" : ""}`}
                >
                  {r.name}
                </span>
                <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {fuera ? `sin ${r.name}` : "lleva"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* El total y el botón van fijos abajo, como en el carrito y el checkout:
          lo último que hay que hacer en una pantalla nunca puede quedar debajo
          del pliegue. */}
      <div className="border-t border-border px-6 py-5 md:px-12">
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-3">
          <button
            type="button"
            onClick={confirmar}
            className="flex h-20 w-full items-center justify-between gap-4 rounded-3xl px-8 font-display text-2xl uppercase tracking-wide text-white transition hover:scale-[1.01] active:scale-[0.99] md:text-3xl"
            style={{ background: color }}
          >
            <span className="flex items-center gap-3">
              <Plus className="h-7 w-7" />
              {ctaLabel}
            </span>
            <span className="flex items-center gap-3">
              {sacados.length > 0 && (
                <span className="text-base normal-case tracking-normal opacity-90">
                  {sacados.length === 1 ? "1 cambio" : `${sacados.length} cambios`}
                </span>
              )}
              {formatPrice(producto.price)}
            </span>
          </button>
          {/* Atajo para el cliente que abrió la pantalla sin querer, o que se
              arrepintió: agrega el producto tal cual, ignorando lo tildado. */}
          <button
            type="button"
            onClick={() => onConfirm([])}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-border text-base font-medium transition hover:border-primary active:scale-[0.99]"
          >
            <Check className="h-5 w-5" />
            Dejarlo como viene
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { X, Plus, Minus } from "lucide-react";
import type { TotemProduct, TotemRemovable } from "@/lib/api/totem.functions";
import { formatPrice } from "@/lib/totem-cart";

/** Lo que el cliente pidió de más: el ingrediente con su precio y cuántos. */
export interface ExtraElegido {
  id: number;
  name: string;
  price: string;
  quantity: number;
}

/**
 * "¿Le sacamos o le agregamos algo?", antes de sumar el producto al pedido.
 *
 * Aparece sólo para los productos que el dueño habilitó, y con los
 * ingredientes que él marcó como quitables o agregables: el cliente elige entre
 * lo que el negocio ya decidió, no entre toda la receta. Sacar no cambia el
 * precio; agregar sí, y la pantalla lo muestra en el total.
 *
 * Es una pantalla completa y no un menú chico: esto se toca con el dedo, de
 * pie y a medio metro. Por el mismo motivo cada opción es grande, con su estado
 * escrito además de dibujado.
 */
export function TotemPersonalizar({
  producto,
  accent,
  inicialesSacados,
  inicialesExtras,
  ctaLabel = "Agregar al pedido",
  compacto = false,
  onCancel,
  onConfirm,
}: {
  producto: TotemProduct;
  accent?: string;
  /** Lo ya sacado, para editar una línea del carrito en vez de arrancar limpio. */
  inicialesSacados?: number[];
  /** Los extras ya elegidos (ingredientId -> cantidad), al editar una línea. */
  inicialesExtras?: Record<number, number>;
  /** Texto del botón principal: "Agregar al pedido" al sumar, "Guardar cambios" al editar. */
  ctaLabel?: string;
  /**
   * Modal chico y centrado en vez de pantalla completa. Se usa al editar desde
   * el carrito: ahí ya no hace falta la pantalla entera del flujo de agregar.
   */
  compacto?: boolean;
  onCancel: () => void;
  onConfirm: (cambios: { sacados: TotemRemovable[]; extras: ExtraElegido[] }) => void;
}) {
  const [sacados, setSacados] = useState<number[]>(inicialesSacados ?? []);
  const [extras, setExtras] = useState<Record<number, number>>(inicialesExtras ?? {});
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

  const cambiarExtra = (id: number, delta: number, max: number) =>
    setExtras((prev) => {
      const actual = prev[id] ?? 0;
      const nuevo = Math.max(0, Math.min(max, actual + delta));
      return { ...prev, [id]: nuevo };
    });

  const costoExtras = producto.extras.reduce(
    (t, e) => t + Number(e.price) * (extras[e.id] ?? 0),
    0,
  );
  const total = Number(producto.price) + costoExtras;
  const cantidadCambios =
    sacados.length + producto.extras.reduce((n, e) => n + (extras[e.id] ?? 0 ? 1 : 0), 0);

  const confirmar = () =>
    onConfirm({
      sacados: producto.removables.filter((r) => sacados.includes(r.id)),
      extras: producto.extras
        .filter((e) => (extras[e.id] ?? 0) > 0)
        .map((e) => ({ id: e.id, name: e.name, price: e.price, quantity: extras[e.id] })),
    });

  const contenido = (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5 md:px-12">
        <div className="min-w-0">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">{producto.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sacá lo que no querés o agregá extras. Sacar no cambia el precio.
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
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
          {producto.removables.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Sacar
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
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
          )}

          {producto.extras.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Agregar
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {producto.extras.map((e) => {
                  const cant = extras[e.id] ?? 0;
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-4 rounded-3xl border-2 border-border px-6 py-4"
                    >
                      <div className="min-w-0">
                        <div className="font-display text-2xl leading-tight">{e.name}</div>
                        <div className="text-sm text-muted-foreground">
                          +{formatPrice(e.price)} c/u
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-1 rounded-2xl p-1"
                        style={{ background: cant > 0 ? color : "var(--muted)" }}
                      >
                        <button
                          type="button"
                          onClick={() => cambiarExtra(e.id, -1, e.max)}
                          disabled={cant === 0}
                          aria-label={`Menos ${e.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition hover:bg-black/20 active:scale-95 disabled:opacity-40"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                        <span className="min-w-8 text-center font-display text-xl text-white">
                          {cant}
                        </span>
                        <button
                          type="button"
                          onClick={() => cambiarExtra(e.id, 1, e.max)}
                          disabled={cant >= e.max}
                          aria-label={`Más ${e.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition hover:bg-black/20 active:scale-95 disabled:opacity-40"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
              {cantidadCambios > 0 && (
                <span className="text-base normal-case tracking-normal opacity-90">
                  {cantidadCambios === 1 ? "1 cambio" : `${cantidadCambios} cambios`}
                </span>
              )}
              {formatPrice(total)}
            </span>
          </button>
        </div>
      </div>
    </>
  );

  if (compacto) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur"
        role="dialog"
        aria-modal="true"
        aria-label={`Personalizar ${producto.name}`}
        onClick={onCancel}
      >
        <div
          className="flex h-[82vh] max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-card"
          onClick={(e) => e.stopPropagation()}
        >
          {contenido}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label={`Personalizar ${producto.name}`}
    >
      {contenido}
    </div>
  );
}

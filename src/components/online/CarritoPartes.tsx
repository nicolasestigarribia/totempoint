import { useMemo, useState } from "react";
import { Minus, Plus, Trash2, Pencil, ImageOff, type LucideIcon } from "lucide-react";
import type { TotemProduct } from "@/lib/api/totem.functions";
import { MAX_POR_LINEA } from "@/lib/pedido-reglas";
import { TotemPersonalizar } from "@/components/totem/TotemPersonalizar";
import { lineaNoDisponible, type MenuDelCarrito } from "@/lib/linea-disponible";
import { useTotemCart, useCartForSlug, precioLinea, formatPrice, claveDe } from "@/lib/totem-cart";

/**
 * Las piezas de "Tu pedido" que comparten el pedido online y el de mesa: la
 * lista de lo que hay en el carrito (con cantidades, sacar, personalizar) y los
 * bloques del formulario. Lo que cambia entre los dos canales —envío, datos del
 * cliente, cómo se paga— queda en cada pantalla.
 */

/** Lo que hay en el carrito, línea por línea, con lo que se puede cambiar de cada una. */
export function LineasCarrito({
  cartKey,
  menu,
  accent,
}: {
  cartKey: string;
  menu: MenuDelCarrito;
  accent: string;
}) {
  const items = useCartForSlug(cartKey);
  const add = useTotemCart((s) => s.add);
  const removeOne = useTotemCart((s) => s.removeOne);
  const removeAll = useTotemCart((s) => s.removeAll);
  const setLineChanges = useTotemCart((s) => s.setLineChanges);

  const productosPorId = useMemo(
    () => new Map(menu.products.map((p) => [p.id, p])),
    [menu.products],
  );
  const noDisponible = lineaNoDisponible(menu);

  const [editando, setEditando] = useState<{
    clave: string;
    producto: TotemProduct;
    inicialesSacados: number[];
    inicialesExtras: Record<number, number>;
  } | null>(null);

  return (
    <>
      <ul className="mt-4 space-y-3">
        {items.map((i) => {
          const clave = claveDe(i);
          const prod = i.kind === "producto" ? productosPorId.get(i.refId) : undefined;
          const editable = !!prod && (prod.removables.length > 0 || prod.extras.length > 0);
          const agotado = noDisponible(i);
          return (
            <li
              key={clave}
              className={`flex gap-3 rounded-2xl border bg-card/40 p-3 ${
                agotado ? "border-destructive/60" : "border-border"
              }`}
            >
              {i.photoUrl ? (
                <img
                  src={i.photoUrl}
                  alt=""
                  className={`h-16 w-16 shrink-0 rounded-xl object-cover ${agotado ? "opacity-50" : ""}`}
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <ImageOff className="h-5 w-5 text-muted-foreground" />
                </div>
              )}

              {/* Dos renglones: arriba qué es, abajo cuántos y cuánto. En una sola
                      fila, con los nombres de una carta real ("02 · Jamón y
                      aceitunas"), el nombre quedaba a una palabra por renglón. */}
              <div className="min-w-0 flex-1">
                <p
                  className={`font-bold leading-tight ${agotado ? "line-through opacity-60" : ""}`}
                >
                  {i.name}
                </p>
                {agotado && (
                  <p className="text-sm font-bold text-destructive">
                    Ya no está a la venta: sacalo para seguir
                  </p>
                )}
                {i.tamanio && <p className="text-sm text-muted-foreground">{i.tamanio}</p>}
                {i.pan && <p className="text-sm text-muted-foreground">Pan {i.pan}</p>}
                {i.elecciones && i.elecciones.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {i.elecciones.map((e) => `${e.quantity} ${e.name}`).join(" · ")}
                  </p>
                )}
                {i.removed.length > 0 && (
                  <p className="text-sm text-amber-400">
                    {i.removed.map((r) => `sin ${r.name}`).join(", ")}
                  </p>
                )}
                {i.extras.length > 0 && (
                  <p className="text-sm text-emerald-400">
                    {i.extras.map((x) => `+${x.quantity} ${x.name}`).join(", ")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{formatPrice(precioLinea(i))} c/u</p>
                {editable && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditando({
                        clave,
                        producto: prod!,
                        inicialesSacados: i.removed.map((r) => r.id),
                        inicialesExtras: Object.fromEntries(
                          i.extras.map((x) => [x.id, x.quantity]),
                        ),
                      })
                    }
                    className="mt-1 flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    <Pencil className="h-3 w-3" /> Cambiar
                  </button>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Quitar uno"
                      onClick={() => removeOne(clave)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center font-bold">{i.quantity}</span>
                    <button
                      type="button"
                      aria-label="Agregar uno"
                      disabled={i.quantity >= MAX_POR_LINEA}
                      onClick={() =>
                        add(cartKey, {
                          kind: i.kind,
                          refId: i.refId,
                          name: i.name,
                          price: i.price,
                          photoUrl: i.photoUrl,
                          removed: i.removed,
                          extras: i.extras,
                          pan: i.pan,
                          tamanio: i.tamanio,
                          elecciones: i.elecciones,
                          regalo: i.regalo,
                        })
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="ml-auto font-bold">
                    {formatPrice(precioLinea(i) * i.quantity)}
                  </span>
                  <button
                    type="button"
                    aria-label="Sacar del pedido"
                    onClick={() => removeAll(clave)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-destructive text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {editando && (
        <TotemPersonalizar
          producto={editando.producto}
          accent={accent}
          inicialesSacados={editando.inicialesSacados}
          inicialesExtras={editando.inicialesExtras}
          ctaLabel="Guardar"
          compacto
          onCancel={() => setEditando(null)}
          onConfirm={({ sacados, extras }) => {
            setLineChanges(
              cartKey,
              editando.clave,
              sacados,
              extras.map((x) => ({ id: x.id, name: x.name, price: x.price, quantity: x.quantity })),
            );
            setEditando(null);
          }}
        />
      )}
    </>
  );
}

export function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 font-display text-2xl">{titulo}</h2>
      {children}
    </section>
  );
}

export function Opcion({
  activa,
  accent,
  onClick,
  icono: Icono,
  titulo,
}: {
  activa: boolean;
  accent: string;
  onClick: () => void;
  icono: LucideIcon;
  titulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`flex h-14 items-center justify-center gap-2 rounded-xl border font-bold transition ${
        activa ? "border-transparent text-white" : "border-border"
      }`}
      style={activa ? { background: accent } : undefined}
    >
      <Icono className="h-5 w-5" />
      {titulo}
    </button>
  );
}

export function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span>{valor}</span>
    </div>
  );
}

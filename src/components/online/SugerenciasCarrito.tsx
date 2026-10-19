import { useMemo } from "react";
import { ImageOff, Plus } from "lucide-react";
import { toast } from "sonner";
import type { TotemCategory, TotemProduct } from "@/lib/api/totem.functions";
import { formatPrice, regaloDeProducto, useCartForSlug, useTotemCart } from "@/lib/totem-cart";

/**
 * Las categorías que se suman a un pedido sin pensarlo: la bebida, el postre.
 * Por nombre, porque cada local las llama a su manera.
 */
const ACOMPANIA = /bebida|gaseosa|cerveza|vino|agua|jugo|postre|dulce|helado|fain[aá]/i;

/**
 * "¿Le sumás algo?" debajo del pedido: bebidas y postres para agregar con un
 * toque, como en las apps de delivery. Es la venta que el cliente iba a hacer
 * igual y se olvidó; sin esto, llega a la casa sin la gaseosa.
 *
 * Solo lo que no está ya en el pedido, y nunca algo que haya que configurar:
 * con tamaño va el primero y con pan el blanco, lo mismo que marca el menú.
 */
export function SugerenciasCarrito({
  cartKey,
  categorias,
  productos,
  accent,
}: {
  cartKey: string;
  categorias: TotemCategory[];
  productos: TotemProduct[];
  accent: string;
}) {
  const add = useTotemCart((s) => s.add);
  const items = useCartForSlug(cartKey);

  const sugeridos = useMemo(() => {
    const cats = new Set(categorias.filter((c) => ACOMPANIA.test(c.name)).map((c) => c.id));
    const enPedido = new Set(items.filter((i) => i.kind === "producto").map((i) => i.refId));
    return productos.filter((p) => cats.has(p.categoryId) && !enPedido.has(p.id)).slice(0, 8);
  }, [categorias, productos, items]);

  if (sugeridos.length === 0) return null;

  return (
    <section className="mt-5">
      <h2 className="mb-2 font-display text-xl">¿Le sumás algo?</h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {sugeridos.map((p) => {
          const tamanio = p.tamanios[0];
          const precio = tamanio?.precio ?? p.price;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                add(cartKey, {
                  kind: "producto",
                  refId: p.id,
                  name: p.name,
                  price: precio,
                  photoUrl: p.photoUrl,
                  pan: p.pan === "ambos" ? "blanco" : undefined,
                  tamanio: tamanio?.nombre,
                  regalo: regaloDeProducto(p),
                });
                toast.success(`${p.name} agregado`);
              }}
              className="flex w-32 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card/60 text-left transition active:scale-95"
            >
              <div className="relative h-24 w-full bg-muted">
                {p.photoUrl ? (
                  <img
                    src={p.photoUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                  </div>
                )}
                <span
                  className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-lg"
                  style={{ background: accent }}
                  aria-hidden
                >
                  <Plus className="h-4 w-4" />
                </span>
              </div>
              <div className="p-2">
                <p className="line-clamp-2 text-xs font-semibold leading-tight">{p.name}</p>
                <p className="mt-1 text-sm font-bold" style={{ color: accent }}>
                  {formatPrice(precio)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

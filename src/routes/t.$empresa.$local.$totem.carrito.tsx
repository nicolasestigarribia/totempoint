import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingCart, ImageOff, Pencil } from "lucide-react";
import { type TotemProduct } from "@/lib/api/totem.functions";
import { getMenuCached } from "@/lib/totem-menu-cache";
import { TotemError } from "@/components/totem/TotemError";
import { TotemPersonalizar } from "@/components/totem/TotemPersonalizar";
import { TotemTopBar } from "@/components/totem/TotemTopBar";
import {
  useTotemCart,
  useCartForSlug,
  useRepriceCart,
  cartTotal,
  formatPrice,
  itemKey,
} from "@/lib/totem-cart";
import { useTotemIdleReset } from "@/lib/use-totem-idle";
import { totemCartKey } from "@/lib/totem-nav";
import { useTotemTheme } from "@/components/totem/useTotemTheme";

export const Route = createFileRoute("/t/$empresa/$local/$totem/carrito")({
  loader: ({ params }) => getMenuCached(params.empresa, params.local, Number(params.totem)),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Tu pedido — ${loaderData.name}` : "Tu pedido" }],
  }),
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  component: CarritoPage,
});

function CarritoPage() {
  const menu = Route.useLoaderData();
  const nav = Route.useParams();
  const cartKey = totemCartKey(nav);
  useRepriceCart(cartKey, menu.products, menu.combos);
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
  const navigate = useNavigate();
  const accent = menu.accentColor || undefined;
  useTotemIdleReset(nav);

  const items = useCartForSlug(cartKey);
  const add = useTotemCart((s) => s.add);
  const removeOne = useTotemCart((s) => s.removeOne);
  const removeAll = useTotemCart((s) => s.removeAll);
  const setLineRemovals = useTotemCart((s) => s.setLineRemovals);
  const total = cartTotal(items);

  // Los productos configurables, por id, para saber qué línea del carrito se
  // puede editar y con qué ingredientes. Sólo productos: los combos no se tocan.
  const productosPorId = useMemo(
    () => new Map(menu.products.map((p) => [p.id, p])),
    [menu.products],
  );
  // Línea que se está editando: su clave (para reubicarla) y el producto del
  // menú (que trae los quitables y lo ya sacado).
  const [editando, setEditando] = useState<{
    clave: string;
    producto: TotemProduct;
    iniciales: number[];
  } | null>(null);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TotemTopBar
        nav={nav}
        name={menu.name}
        logoUrl={menu.logoUrl}
        accent={accent}
        back="categorias"
        paso="pedido"
      />

      <main className="mx-auto w-full max-w-[900px] flex-1 px-6 py-6 md:px-12">
        <h1 className="mb-6 font-display text-4xl md:text-5xl">Tu pedido</h1>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border p-16 text-center">
            <ShoppingCart className="vaiven h-14 w-14 text-muted-foreground" />
            <p className="text-xl text-muted-foreground">Todavía no agregaste nada</p>
            <Link
              to="/t/$empresa/$local/$totem/categorias"
              params={nav}
              className="rounded-2xl px-8 py-4 font-display text-xl uppercase tracking-wide text-white"
              style={{ background: accent ?? "var(--primary)" }}
            >
              Ver el menú
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-4">
              {items.map((i) => {
                // La clave distingue las variantes: "sin cebolla" es otra
                // línea, y los botones tienen que tocar la suya.
                const clave = itemKey(i.kind, i.refId, i.removed);
                const prod = i.kind === "producto" ? productosPorId.get(i.refId) : undefined;
                const editable = !!prod && prod.removables.length > 0;
                return (
                  <li
                    key={clave}
                    className="flex flex-wrap items-center gap-4 rounded-3xl border border-border/60 bg-card/40 p-4"
                  >
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
                      {i.photoUrl ? (
                        <img src={i.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageOff className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-[160px] flex-1">
                      <h2 className="font-display text-2xl leading-tight">{i.name}</h2>
                      {i.removed.length > 0 && (
                        // Lo que se sacó va acá y no en el nombre: el cliente
                        // tiene que poder revisarlo antes de confirmar, que es
                        // la última pantalla donde puede arreglarlo.
                        <p className="mt-0.5 text-sm font-medium text-amber-400">
                          {i.removed.map((r) => `sin ${r.name}`).join(", ")}
                        </p>
                      )}
                      <p className="text-muted-foreground">{formatPrice(i.price)} c/u</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Quitar uno"
                        onClick={() => removeOne(clave)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-border transition hover:border-primary"
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                      <span className="w-10 text-center font-display text-2xl">{i.quantity}</span>
                      <button
                        type="button"
                        aria-label="Agregar uno"
                        onClick={() =>
                          add(cartKey, {
                            kind: i.kind,
                            refId: i.refId,
                            name: i.name,
                            price: i.price,
                            photoUrl: i.photoUrl,
                            removed: i.removed,
                          })
                        }
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-border transition hover:border-primary"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                      {/* Editar y eliminar juntos y apartados de los −/+: son
                          acciones sobre la línea entera, no sobre la cantidad. */}
                      <div className="ml-4 flex items-center gap-2">
                        {editable && (
                          <button
                            type="button"
                            aria-label={`Personalizar ${i.name}`}
                            title="Personalizar ingredientes"
                            onClick={() =>
                              setEditando({
                                clave,
                                producto: prod!,
                                iniciales: i.removed.map((r) => r.id),
                              })
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-xl border transition hover:bg-white/5"
                            // Naranja con mismo L y chroma que el rojo del tacho
                            // (destructive oklch(0.6 0.24 27)), solo cambia el tono.
                            style={{ color: "oklch(0.6 0.24 60)", borderColor: "oklch(0.6 0.24 60)" }}
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Quitar del pedido"
                          onClick={() => removeAll(clave)}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-destructive text-destructive transition hover:bg-destructive/10"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="ml-auto w-28 shrink-0 text-right font-display text-2xl">
                      {formatPrice(Number(i.price) * i.quantity)}
                    </div>
                  </li>
                );
              })}
            </ul>

            <Link
              to="/t/$empresa/$local/$totem/categorias"
              params={nav}
              className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-border py-4 font-display text-lg uppercase tracking-wide text-muted-foreground transition hover:border-primary hover:text-foreground"
            >
              <Plus className="h-5 w-5" />
              Seguir agregando
            </Link>
          </>
        )}
      </main>

      {/* Total y confirmación fijos abajo: con cuatro productos el botón
          quedaba al final de la lista y había que ir a buscarlo. Lo último
          que hay que hacer en esta pantalla no puede estar fuera de la vista. */}
      {items.length > 0 && (
        <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 px-6 py-4 backdrop-blur md:px-12">
          <div className="mx-auto w-full max-w-[900px]">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-2xl uppercase tracking-wide">Total</span>
              <span className="font-display text-4xl" style={{ color: accent }}>
                {formatPrice(total)}
              </span>
            </div>
            {/* Late igual que el botón de la portada: en cada pantalla del
                tótem, lo que hay que tocar para seguir es lo que pulsa. */}
            <button
              type="button"
              onClick={() => navigate({ to: "/t/$empresa/$local/$totem/checkout", params: nav })}
              className="late flex w-full items-center justify-center rounded-3xl px-8 py-6 font-display text-3xl uppercase tracking-wide text-white transition hover:scale-[1.02] active:scale-[0.98]"
              style={
                {
                  background: accent ?? "var(--primary)",
                  "--halo": `color-mix(in oklab, ${accent ?? "var(--primary)"} 55%, transparent)`,
                } as React.CSSProperties
              }
            >
              Confirmar pedido
            </button>
          </div>
        </div>
      )}

      {editando && (
        <TotemPersonalizar
          producto={editando.producto}
          accent={accent}
          iniciales={editando.iniciales}
          ctaLabel="Guardar cambios"
          onCancel={() => setEditando(null)}
          onConfirm={(sacados) => {
            setLineRemovals(cartKey, editando.clave, sacados);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

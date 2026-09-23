import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ImageOff, Plus, Minus, Trash2 } from "lucide-react";
import { getTotemMenu, type TotemProduct } from "@/lib/api/totem.functions";
import { TotemQuitables } from "@/components/totem/TotemQuitables";
import { TotemError } from "@/components/totem/TotemError";
import { TotemTopBar } from "@/components/totem/TotemTopBar";
import { TotemCartBar } from "@/components/totem/TotemCartBar";
import { useTotemCart, useCartForSlug, formatPrice, itemKey } from "@/lib/totem-cart";
import { useTotemIdleReset } from "@/lib/use-totem-idle";
import { totemCartKey } from "@/lib/totem-nav";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { gridColsFor, lastSpanFor } from "@/components/totem/grid";

export const Route = createFileRoute("/t/$empresa/$local/$totem/menu/$category")({
  loader: async ({ params }) => {
    const menu = await getTotemMenu({
      data: { empresa: params.empresa, local: params.local, totem: Number(params.totem) },
    });
    const categoryId = Number(params.category);
    const category = menu.categories.find((c) => c.id === categoryId);
    if (!category) throw notFound();
    return { menu, category, items: menu.products.filter((p) => p.categoryId === categoryId) };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.category.name} — ${loaderData.menu.name}` : "Menú" },
    ],
  }),
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  notFoundComponent: () => <TotemError message="No encontramos esa categoría" />,
  component: MenuCategoryPage,
});

function MenuCategoryPage() {
  const { menu, category, items } = Route.useLoaderData();
  const nav = Route.useParams();
  const cartKey = totemCartKey(nav);
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
  const accent = menu.accentColor || undefined;
  const add = useTotemCart((s) => s.add);
  const removeOne = useTotemCart((s) => s.removeOne);
  const cart = useCartForSlug(cartKey);
  useTotemIdleReset(nav);
  // Qué sacó el cliente de cada producto. Vive acá y no en la tarjeta porque
  // agregar al carrito lo tiene que limpiar: la próxima unidad arranca de
  // nuevo, como viene.
  const [sacados, setSacados] = useState<Record<number, number[]>>({});

  const alternarIngrediente = (productId: number, ingredientId: number) =>
    setSacados((prev) => {
      const actuales = prev[productId] ?? [];
      return {
        ...prev,
        [productId]: actuales.includes(ingredientId)
          ? actuales.filter((x) => x !== ingredientId)
          : [...actuales, ingredientId],
      };
    });

  // Un producto configurable puede estar varias veces en el pedido con cambios
  // distintos, así que el contador de la tarjeta suma todas sus variantes y el
  // − / + sólo maneja la versión sin cambios. Las otras se editan desde el
  // carrito, que es donde se ven una por una.
  const agregar = (p: TotemProduct) => {
    const elegidos = sacados[p.id] ?? [];
    add(cartKey, {
      kind: "producto",
      refId: p.id,
      name: p.name,
      price: p.price,
      photoUrl: p.photoUrl,
      removed: p.removables.filter((r) => elegidos.includes(r.id)),
    });
    // Vuelve a cero: si el cliente quiere otra igual, la vuelve a armar, y si
    // quiere una normal no se le cuela el cambio de la anterior.
    setSacados((prev) => ({ ...prev, [p.id]: [] }));
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TotemTopBar
        nav={nav}
        name={menu.name}
        logoUrl={menu.logoUrl}
        accent={accent}
        back="categorias"
        paso="elegir"
      />

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 py-6 md:px-12">
        <div className="mb-6">
          {category.tagline && (
            <div className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>
              {category.tagline}
            </div>
          )}
          <h1 className="mt-1 font-display text-4xl md:text-6xl">{category.name}</h1>
        </div>

        <div className={`grid auto-rows-fr gap-5 ${gridColsFor(items.length)}`}>
          {items.map((p, i) => {
            // Todas las variantes del producto, con cambios y sin cambios.
            const inCart = cart
              .filter((i) => i.kind === "producto" && i.refId === p.id)
              .reduce((n, i) => n + i.quantity, 0);
            // El − / + de la tarjeta maneja la versión sin cambios; las
            // personalizadas se editan en el carrito, donde se ven separadas.
            const claveSinCambios = itemKey("producto", p.id);
            const configurable = p.removables.length > 0;
            const elegidos = sacados[p.id] ?? [];
            // Con algo tachado el botón agrega esa variante, así que el
            // − / + de la unidad sin cambios no corresponde.
            const conCambios = elegidos.length > 0;
            return (
              <article
                key={p.id}
                // Lo que ya está en el pedido se marca con el color de la marca:
                // así el cliente ve de un vistazo qué lleva, sin tener que leer
                // el número de cada contador.
                className={`aparece flex flex-col overflow-hidden rounded-3xl border bg-card/40 shadow-card transition ${
                  inCart > 0 ? "border-2" : "border-border/60"
                } ${lastSpanFor(items.length, i)}`}
                style={{
                  // Cada tarjeta entra unos milisegundos después que la anterior.
                  animationDelay: `${Math.min(i, 8) * 45}ms`,
                  ...(inCart > 0 ? { borderColor: accent ?? "var(--primary)" } : {}),
                }}
              >
                <div className="relative h-44 w-full overflow-hidden bg-muted">
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageOff className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h2 className="font-display text-2xl leading-tight">{p.name}</h2>
                  {p.description && (
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  )}
                  {configurable && (
                    <TotemQuitables
                      quitables={p.removables}
                      sacados={elegidos}
                      accent={accent}
                      onAlternar={(ingredientId) => alternarIngrediente(p.id, ingredientId)}
                    />
                  )}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                    <span className="font-display text-3xl" style={{ color: accent }}>
                      {formatPrice(p.price)}
                    </span>
                    {inCart > 0 && !conCambios ? (
                      // Con unidades en el pedido el botón se abre en − cantidad +:
                      // equivocarse tocando no puede obligar a ir hasta el carrito.
                      <div
                        className="flex items-center gap-1 rounded-2xl p-1"
                        style={{ background: accent ?? "var(--primary)" }}
                      >
                        <button
                          type="button"
                          onClick={() => removeOne(claveSinCambios)}
                          aria-label={inCart === 1 ? `Quitar ${p.name}` : `Quitar una unidad`}
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-white transition hover:bg-black/20 active:scale-95"
                        >
                          {inCart === 1 ? (
                            <Trash2 className="h-5 w-5" />
                          ) : (
                            <Minus className="h-5 w-5" />
                          )}
                        </button>
                        <span className="min-w-10 text-center font-display text-2xl text-white">
                          {inCart}
                        </span>
                        <button
                          type="button"
                          onClick={() => agregar(p)}
                          aria-label="Agregar una unidad"
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-white transition hover:bg-black/20 active:scale-95"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => agregar(p)}
                        className="flex h-14 items-center gap-2 rounded-2xl px-6 font-display text-lg uppercase tracking-wide text-white transition hover:scale-[1.03] active:scale-[0.97]"
                        style={{ background: accent ?? "var(--primary)" }}
                      >
                        <Plus className="h-5 w-5" />
                        {/* El mismo botón de siempre. Sólo cambia cuando el
                            cliente tachó algo, y ahí dice qué va a agregar. */}
                        {conCambios ? "Agregar así" : "Agregar"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      <TotemCartBar nav={nav} accent={accent} />
    </div>
  );
}

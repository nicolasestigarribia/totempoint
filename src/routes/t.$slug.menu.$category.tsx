import { createFileRoute, notFound } from "@tanstack/react-router";
import { ImageOff, Plus, Minus, Trash2 } from "lucide-react";
import { getTotemMenu } from "@/lib/api/totem.functions";
import { TotemError } from "@/components/totem/TotemError";
import { TotemTopBar } from "@/components/totem/TotemTopBar";
import { useTotemCart, useCartForSlug, formatPrice } from "@/lib/totem-cart";
import { useTotemIdleReset } from "@/lib/use-totem-idle";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { gridColsFor } from "@/components/totem/grid";

export const Route = createFileRoute("/t/$slug/menu/$category")({
  loader: async ({ params }) => {
    const menu = await getTotemMenu({ data: { slug: params.slug } });
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
  useTotemTheme(menu.accentColor, menu.theme);
  const accent = menu.accentColor || undefined;
  const add = useTotemCart((s) => s.add);
  const removeOne = useTotemCart((s) => s.removeOne);
  const cart = useCartForSlug(menu.slug);
  useTotemIdleReset(menu.slug);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TotemTopBar
        slug={menu.slug}
        name={menu.name}
        logoUrl={menu.logoUrl}
        accent={accent}
        back="categorias"
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
          {items.map((p) => {
            const inCart = cart.find((i) => i.productId === p.id)?.quantity ?? 0;
            return (
              <article
                key={p.id}
                className="flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/40 shadow-card"
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
                  <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                    <span className="font-display text-3xl" style={{ color: accent }}>
                      {formatPrice(p.price)}
                    </span>
                    {inCart > 0 ? (
                      // Con unidades en el pedido el botón se abre en − cantidad +:
                      // equivocarse tocando no puede obligar a ir hasta el carrito.
                      <div
                        className="flex items-center gap-1 rounded-2xl p-1"
                        style={{ background: accent ?? "var(--primary)" }}
                      >
                        <button
                          type="button"
                          onClick={() => removeOne(p.id)}
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
                          onClick={() =>
                            add(menu.slug, {
                              productId: p.id,
                              name: p.name,
                              price: p.price,
                              photoUrl: p.photoUrl,
                            })
                          }
                          aria-label="Agregar una unidad"
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-white transition hover:bg-black/20 active:scale-95"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          add(menu.slug, {
                            productId: p.id,
                            name: p.name,
                            price: p.price,
                            photoUrl: p.photoUrl,
                          })
                        }
                        className="flex h-14 items-center gap-2 rounded-2xl px-6 font-display text-lg uppercase tracking-wide text-white transition hover:scale-[1.03] active:scale-[0.97]"
                        style={{ background: accent ?? "var(--primary)" }}
                      >
                        <Plus className="h-5 w-5" />
                        Agregar
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}

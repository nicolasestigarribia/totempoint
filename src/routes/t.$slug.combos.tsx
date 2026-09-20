import { createFileRoute } from "@tanstack/react-router";
import { ImageOff, Plus, Minus, Trash2 } from "lucide-react";
import { getTotemMenu } from "@/lib/api/totem.functions";
import { TotemError } from "@/components/totem/TotemError";
import { TotemTopBar } from "@/components/totem/TotemTopBar";
import { TotemCartBar } from "@/components/totem/TotemCartBar";
import { useTotemCart, useCartForSlug, formatPrice } from "@/lib/totem-cart";
import { useTotemIdleReset } from "@/lib/use-totem-idle";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { gridColsFor, lastSpanFor } from "@/components/totem/grid";

export const Route = createFileRoute("/t/$slug/combos")({
  loader: ({ params }) => getTotemMenu({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Combos — ${loaderData.name}` : "Combos" }],
  }),
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  component: CombosPage,
});

function CombosPage() {
  const menu = Route.useLoaderData();
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
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
        paso="elegir"
      />

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 py-6 md:px-12">
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>
            Más barato que por separado
          </div>
          <h1 className="mt-1 font-display text-4xl md:text-6xl">Combos</h1>
        </div>

        <div className={`grid auto-rows-fr gap-5 ${gridColsFor(menu.combos.length)}`}>
          {menu.combos.map((c, i) => {
            const inCart = cart.find((i) => i.kind === "combo" && i.refId === c.id)?.quantity ?? 0;
            return (
              <article
                key={c.id}
                // Igual que en los productos: lo que ya está en el pedido se
                // marca con el color de la marca.
                className={`aparece flex flex-col overflow-hidden rounded-3xl border bg-card/40 shadow-card transition ${
                  inCart > 0 ? "border-2" : "border-border/60"
                } ${lastSpanFor(menu.combos.length, i)}`}
                style={{
                  animationDelay: `${Math.min(i, 8) * 45}ms`,
                  ...(inCart > 0 ? { borderColor: accent ?? "var(--primary)" } : {}),
                }}
              >
                <div className="relative h-44 w-full overflow-hidden bg-muted">
                  {c.photoUrl ? (
                    <img src={c.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageOff className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h2 className="font-display text-2xl leading-tight">{c.name}</h2>
                  {c.description && (
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                  )}

                  {c.items.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {c.items.map((item) => (
                        <li key={item.name} className="flex gap-2 text-sm text-muted-foreground">
                          <span className="font-display text-base" style={{ color: accent }}>
                            {item.quantity}×
                          </span>
                          {item.name}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                    <span className="font-display text-3xl" style={{ color: accent }}>
                      {formatPrice(c.price)}
                    </span>

                    {inCart > 0 ? (
                      <div
                        className="flex items-center gap-1 rounded-2xl p-1"
                        style={{ background: accent ?? "var(--primary)" }}
                      >
                        <button
                          type="button"
                          onClick={() => removeOne("combo", c.id)}
                          aria-label={inCart === 1 ? `Quitar ${c.name}` : "Quitar una unidad"}
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
                              kind: "combo",
                              refId: c.id,
                              name: c.name,
                              price: c.price,
                              photoUrl: c.photoUrl,
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
                            kind: "combo",
                            refId: c.id,
                            name: c.name,
                            price: c.price,
                            photoUrl: c.photoUrl,
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

      <TotemCartBar slug={menu.slug} accent={accent} />
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingCart, ImageOff } from "lucide-react";
import { getTotemMenu } from "@/lib/api/totem.functions";
import { TotemError } from "@/components/totem/TotemError";
import { TotemTopBar } from "@/components/totem/TotemTopBar";
import { useTotemCart, useCartForSlug, cartTotal, formatPrice } from "@/lib/totem-cart";
import { useTotemIdleReset } from "@/lib/use-totem-idle";
import { useTotemTheme } from "@/components/totem/useTotemTheme";

export const Route = createFileRoute("/t/$slug/carrito")({
  loader: ({ params }) => getTotemMenu({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Tu pedido — ${loaderData.name}` : "Tu pedido" }],
  }),
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  component: CarritoPage,
});

function CarritoPage() {
  const menu = Route.useLoaderData();
  useTotemTheme(menu.accentColor, menu.theme);
  const navigate = useNavigate();
  const accent = menu.accentColor || undefined;
  useTotemIdleReset(menu.slug);

  const items = useCartForSlug(menu.slug);
  const add = useTotemCart((s) => s.add);
  const removeOne = useTotemCart((s) => s.removeOne);
  const removeAll = useTotemCart((s) => s.removeAll);
  const total = cartTotal(items);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TotemTopBar
        slug={menu.slug}
        name={menu.name}
        logoUrl={menu.logoUrl}
        accent={accent}
        back="categorias"
        showCart={false}
      />

      <main className="mx-auto w-full max-w-[900px] flex-1 px-6 py-6 md:px-12">
        <h1 className="mb-6 font-display text-4xl md:text-5xl">Tu pedido</h1>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border p-16 text-center">
            <ShoppingCart className="h-14 w-14 text-muted-foreground" />
            <p className="text-xl text-muted-foreground">Todavía no agregaste nada</p>
            <Link
              to="/t/$slug/categorias"
              params={{ slug: menu.slug }}
              className="rounded-2xl px-8 py-4 font-display text-xl uppercase tracking-wide text-white"
              style={{ background: accent ?? "var(--primary)" }}
            >
              Ver el menú
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-4">
              {items.map((i) => (
                <li
                  key={`${i.kind}-${i.refId}`}
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
                    <p className="text-muted-foreground">{formatPrice(i.price)} c/u</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Quitar uno"
                      onClick={() => removeOne(i.kind, i.refId)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-border transition hover:border-primary"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="w-10 text-center font-display text-2xl">{i.quantity}</span>
                    <button
                      type="button"
                      aria-label="Agregar uno"
                      onClick={() =>
                        add(menu.slug, {
                          kind: i.kind,
                          refId: i.refId,
                          name: i.name,
                          price: i.price,
                          photoUrl: i.photoUrl,
                        })
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-border transition hover:border-primary"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Quitar del pedido"
                      onClick={() => removeAll(i.kind, i.refId)}
                      className="ml-1 flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="ml-auto w-28 shrink-0 text-right font-display text-2xl">
                    {formatPrice(Number(i.price) * i.quantity)}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-3xl border border-border/60 bg-card/40 p-6">
              <div className="flex items-center justify-between">
                <span className="font-display text-2xl uppercase tracking-wide">Total</span>
                <span className="font-display text-4xl" style={{ color: accent }}>
                  {formatPrice(total)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate({ to: "/t/$slug/checkout", params: { slug: menu.slug } })}
                className="mt-6 flex w-full items-center justify-center rounded-3xl px-8 py-6 font-display text-3xl uppercase tracking-wide text-white shadow-glow transition hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: accent ?? "var(--primary)" }}
              >
                Confirmar pedido
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ElegirGustos } from "@/components/online/ElegirGustos";
import { ImageOff, Plus, Minus, Trash2 } from "lucide-react";
import { getMenuCached } from "@/lib/totem-menu-cache";
import { TotemError } from "@/components/totem/TotemError";
import { TotemTopBar } from "@/components/totem/TotemTopBar";
import { TotemCartBar } from "@/components/totem/TotemCartBar";
import {
  useTotemCart,
  useCartForSlug,
  useRepriceCart,
  formatPrice,
  itemKey,
} from "@/lib/totem-cart";
import { useTotemIdleReset } from "@/lib/use-totem-idle";
import { totemCartKey } from "@/lib/totem-nav";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { gridColsFor, lastSpanFor } from "@/components/totem/grid";

export const Route = createFileRoute("/t/$empresa/$local/$totem/combos")({
  loader: ({ params }) => getMenuCached(params.empresa, params.local, Number(params.totem)),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Combos — ${loaderData.name}` : "Combos" }],
  }),
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  component: CombosPage,
});

function CombosPage() {
  const menu = Route.useLoaderData();
  const nav = Route.useParams();
  const cartKey = totemCartKey(nav);
  useRepriceCart(cartKey, menu.products, menu.combos);
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
  const accent = menu.accentColor || undefined;
  const add = useTotemCart((s) => s.add);
  const removeOne = useTotemCart((s) => s.removeOne);
  const cart = useCartForSlug(cartKey);
  useTotemIdleReset(nav);
  // El combo a elección que se está armando: el selector se abre dentro de su
  // tarjeta, sin salir de la pantalla.
  const [armando, setArmando] = useState<number | null>(null);

  return (
    <div className="flex min-h-svh flex-col bg-background">
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
          <div className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>
            Más barato que por separado
          </div>
          <h1 className="mt-1 font-display text-4xl md:text-6xl">Combos</h1>
        </div>

        <div
          className={`grid gap-5 ${armando === null ? "auto-rows-fr" : "items-start"} ${gridColsFor(menu.combos.length)}`}
        >
          {menu.combos.map((c, i) => {
            const aEleccion = c.grupos.length > 0;
            // Un combo a elección puede estar varias veces con gustos
            // distintos: se cuentan todas sus líneas.
            const inCart = cart
              .filter((i) => i.kind === "combo" && i.refId === c.id)
              .reduce((n, i) => n + i.quantity, 0);
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

                  {(c.items.length > 0 || aEleccion) && (
                    <ul className="mt-1 space-y-1">
                      {c.grupos.map((g) => (
                        <li
                          key={`g${g.indice}`}
                          className="flex gap-2 text-sm text-muted-foreground"
                        >
                          <span className="font-display text-base" style={{ color: accent }}>
                            {g.cantidad}×
                          </span>
                          {g.nombre}, a elección
                        </li>
                      ))}
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

                  {armando === c.id && (
                    <ElegirGustos
                      grupos={c.grupos}
                      accent={accent ?? "var(--primary)"}
                      textoBoton={`Agregar al pedido · ${formatPrice(c.price)}`}
                      onCancelar={() => setArmando(null)}
                      onListo={(elecciones) => {
                        add(cartKey, {
                          kind: "combo",
                          refId: c.id,
                          name: c.name,
                          price: c.price,
                          photoUrl: c.photoUrl,
                          regalo: c.regalo,
                          elecciones,
                        });
                        setArmando(null);
                        toast.success(`${c.name} agregado a tu pedido`);
                      }}
                    />
                  )}

                  {/* Si el precio y el botón no entran en una línea (tarjeta angosta,
                      precio largo), el botón baja y ocupa todo el ancho: nunca
                      se sale de la tarjeta. */}
                  <div
                    className={`mt-auto flex flex-wrap items-center justify-between gap-3 pt-3 ${
                      armando === c.id ? "hidden" : ""
                    }`}
                  >
                    <span
                      className="whitespace-nowrap font-display text-3xl"
                      style={{ color: accent }}
                    >
                      {formatPrice(c.price)}
                    </span>

                    {aEleccion ? (
                      <button
                        type="button"
                        onClick={() => setArmando(c.id)}
                        className="flex h-14 grow items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-6 font-display text-lg uppercase tracking-wide text-white transition hover:scale-[1.03] active:scale-[0.97]"
                        style={{ background: accent ?? "var(--primary)" }}
                      >
                        <Plus className="h-5 w-5" />
                        {inCart > 0 ? `Otro (${inCart})` : "Elegir gustos"}
                      </button>
                    ) : inCart > 0 ? (
                      <div
                        className="ml-auto flex items-center gap-1 rounded-2xl p-1"
                        style={{ background: accent ?? "var(--primary)" }}
                      >
                        <button
                          type="button"
                          onClick={() => removeOne(itemKey("combo", c.id))}
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
                            add(cartKey, {
                              kind: "combo",
                              refId: c.id,
                              name: c.name,
                              price: c.price,
                              photoUrl: c.photoUrl,
                              regalo: c.regalo,
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
                          add(cartKey, {
                            kind: "combo",
                            refId: c.id,
                            name: c.name,
                            price: c.price,
                            photoUrl: c.photoUrl,
                            regalo: c.regalo,
                          })
                        }
                        className="flex h-14 grow items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-6 font-display text-lg uppercase tracking-wide text-white transition hover:scale-[1.03] active:scale-[0.97]"
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

      <TotemCartBar nav={nav} accent={accent} />
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, UtensilsCrossed } from "lucide-react";
import { getTotemMenu } from "@/lib/api/totem.functions";
import { TotemError } from "@/components/totem/TotemError";
import { TotemTopBar } from "@/components/totem/TotemTopBar";
import { TotemCartBar } from "@/components/totem/TotemCartBar";
import { useTotemIdleReset } from "@/lib/use-totem-idle";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { gridColsFor, lastSpanFor } from "@/components/totem/grid";

export const Route = createFileRoute("/t/$slug/categorias")({
  loader: ({ params }) => getTotemMenu({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Menú — ${loaderData.name}` : "Menú" }],
  }),
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  component: CategoriasPage,
});

function CategoriasPage() {
  const menu = Route.useLoaderData();
  useTotemTheme(menu.accentColor, menu.theme);
  const accent = menu.accentColor || undefined;
  useTotemIdleReset(menu.slug);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TotemTopBar
        slug={menu.slug}
        name={menu.name}
        logoUrl={menu.logoUrl}
        accent={accent}
        paso="elegir"
      />

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 py-6 md:px-12">
        <div className="mb-6 text-center">
          <h1 className="font-display text-4xl md:text-6xl">Elegí una categoría</h1>
          <p className="mt-1 text-muted-foreground">Tocá una tarjeta para ver los productos</p>
        </div>

        {menu.categories.length === 0 && menu.combos.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <UtensilsCrossed className="vaiven h-14 w-14 text-muted-foreground" />
            <p className="text-xl text-muted-foreground">Todavía no hay productos cargados</p>
          </div>
        ) : (
          <div
            className={`grid flex-1 auto-rows-fr gap-4 ${gridColsFor(
              menu.categories.length + (menu.combos.length > 0 ? 1 : 0),
            )}`}
          >
            {/* Los combos van primeros y con borde de color: son la oferta que
                conviene, no una categoría más perdida entre las otras. */}
            {menu.combos.length > 0 && (
              <Link
                to="/t/$slug/combos"
                params={{ slug: menu.slug }}
                className="aparece group relative flex min-h-[200px] flex-col justify-end overflow-hidden rounded-3xl border-2 shadow-card transition hover:-translate-y-1"
                style={{ borderColor: accent ?? "var(--primary)" }}
              >
                {menu.combos[0].photoUrl ? (
                  <img
                    src={menu.combos[0].photoUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="absolute inset-0 bg-muted" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />

                <div className="relative z-10 flex items-end justify-between gap-4 p-6">
                  <div className="min-w-0">
                    <div
                      className="line-clamp-2 text-[11px] font-bold uppercase leading-tight tracking-[0.12em]"
                      style={{ color: accent }}
                    >
                      Más barato que por separado
                    </div>
                    <h2 className="mt-1.5 font-display text-4xl text-white">Combos</h2>
                    <p className="mt-1 text-sm text-white/70">
                      {menu.combos.length} {menu.combos.length === 1 ? "combo" : "combos"}
                    </p>
                  </div>
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-glow transition group-hover:translate-x-1"
                    style={{ background: accent ?? "var(--primary)" }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </div>
                </div>
              </Link>
            )}
            {menu.categories.map((c, i) => (
              <Link
                key={c.id}
                to="/t/$slug/menu/$category"
                params={{ slug: menu.slug, category: String(c.id) }}
                className={`aparece group relative flex min-h-[200px] flex-col justify-end overflow-hidden rounded-3xl border border-border/60 shadow-card transition hover:-translate-y-1 hover:border-primary ${lastSpanFor(
                  menu.categories.length + (menu.combos.length > 0 ? 1 : 0),
                  i + (menu.combos.length > 0 ? 1 : 0),
                )}`}
                // Escalonadas: la de combos ya entró, estas van detrás.
                style={{
                  animationDelay: `${(i + (menu.combos.length > 0 ? 1 : 0)) * 45}ms`,
                }}
              >
                {c.photoUrl ? (
                  <img
                    src={c.photoUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="absolute inset-0 bg-muted" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />

                <div className="relative z-10 flex items-end justify-between gap-4 p-6">
                  <div className="min-w-0">
                    {c.tagline && (
                      <div
                        className="line-clamp-2 text-[11px] font-bold uppercase leading-tight tracking-[0.12em]"
                        style={{ color: accent }}
                      >
                        {c.tagline}
                      </div>
                    )}
                    <h2 className="mt-1.5 font-display text-4xl text-white">{c.name}</h2>
                    <p className="mt-1 text-sm text-white/70">
                      {c.productCount} {c.productCount === 1 ? "producto" : "productos"}
                    </p>
                  </div>
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-glow transition group-hover:translate-x-1"
                    style={{ background: accent ?? "var(--primary)" }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <TotemCartBar slug={menu.slug} accent={accent} />
    </div>
  );
}

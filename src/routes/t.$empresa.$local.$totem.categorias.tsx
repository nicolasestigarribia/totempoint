import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, UtensilsCrossed } from "lucide-react";
import { getMenuCached } from "@/lib/totem-menu-cache";
import { TotemError } from "@/components/totem/TotemError";
import { TotemTopBar } from "@/components/totem/TotemTopBar";
import { TotemCartBar } from "@/components/totem/TotemCartBar";
import { useTotemIdleReset } from "@/lib/use-totem-idle";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { gridColsFor, lastSpanFor } from "@/components/totem/grid";

export const Route = createFileRoute("/t/$empresa/$local/$totem/categorias")({
  loader: ({ params }) => getMenuCached(params.empresa, params.local, Number(params.totem)),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Menú — ${loaderData.name}` : "Menú" }],
  }),
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  component: CategoriasPage,
});

function CategoriasPage() {
  const menu = Route.useLoaderData();
  const nav = Route.useParams();
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
  const accent = menu.accentColor || undefined;
  useTotemIdleReset(nav);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <TotemTopBar
        nav={nav}
        name={menu.name}
        logoUrl={menu.logoUrl}
        accent={accent}
        paso="elegir"
      />

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 py-6 md:px-12">
        {/* Un título de 60px y una instrucción que nadie necesita —el cliente
            ya sabe que se toca— empujaban una fila entera de categorías fuera
            de la pantalla. Lo que importa acá son las fotos. */}
        <div className="mb-5 text-center">
          <h1 className="font-display text-3xl md:text-4xl">Elegí una categoría</h1>
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
                to="/t/$empresa/$local/$totem/combos"
                params={nav}
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
                {/* La foto la elige el negocio y puede ser clarísima, así que
                    el degradado tapa de verdad la mitad de abajo: es donde va
                    el texto y tiene que leerse siempre. */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/20" />

                <div className="relative z-10 flex items-end justify-between gap-4 p-6">
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-xs font-bold uppercase leading-tight tracking-[0.12em] text-white/75 [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">
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
                to="/t/$empresa/$local/$totem/menu/$category"
                params={{ ...nav, category: String(c.id) }}
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
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/20" />

                <div className="relative z-10 flex items-end justify-between gap-4 p-6">
                  <div className="min-w-0">
                    {c.tagline && (
                      // En blanco y no en el color de la marca: el dueño elige
                      // la foto y el color, y un naranja quemado sobre una foto
                      // clara no se lee. El acento queda donde importa —el
                      // botón— y acá gana el contraste.
                      <div className="line-clamp-2 text-xs font-bold uppercase leading-tight tracking-[0.12em] text-white/75 [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">
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

      <TotemCartBar nav={nav} accent={accent} />
    </div>
  );
}

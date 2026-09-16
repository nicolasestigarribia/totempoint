import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, UtensilsCrossed } from "lucide-react";
import { getTotemMenu } from "@/lib/api/totem.functions";
import { TotemError } from "@/components/totem/TotemError";
import { TotemTopBar } from "@/components/totem/TotemTopBar";
import { useTotemIdleReset } from "@/lib/use-totem-idle";

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
  const accent = menu.accentColor || undefined;
  useTotemIdleReset(menu.slug);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TotemTopBar slug={menu.slug} name={menu.name} logoUrl={menu.logoUrl} accent={accent} />

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 py-6 md:px-12">
        <div className="mb-6 text-center">
          <h1 className="font-display text-4xl md:text-6xl">Elegí una categoría</h1>
          <p className="mt-1 text-muted-foreground">Tocá una tarjeta para ver los productos</p>
        </div>

        {menu.categories.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <UtensilsCrossed className="h-14 w-14 text-muted-foreground" />
            <p className="text-xl text-muted-foreground">Todavía no hay productos cargados</p>
          </div>
        ) : (
          <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menu.categories.map((c) => (
              <Link
                key={c.id}
                to="/t/$slug/menu/$category"
                params={{ slug: menu.slug, category: String(c.id) }}
                className="group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-3xl border border-border/60 shadow-card transition hover:-translate-y-1 hover:border-primary"
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
                  <div>
                    {c.tagline && (
                      <div
                        className="text-[11px] font-bold uppercase tracking-[0.3em]"
                        style={{ color: accent }}
                      >
                        {c.tagline}
                      </div>
                    )}
                    <h2 className="mt-2 font-display text-4xl text-white">{c.name}</h2>
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
    </div>
  );
}

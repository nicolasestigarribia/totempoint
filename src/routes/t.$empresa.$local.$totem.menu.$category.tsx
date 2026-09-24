import { useRef, useState } from "react";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ImageOff, Plus, Minus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { type TotemProduct } from "@/lib/api/totem.functions";
import { getMenuCached } from "@/lib/totem-menu-cache";
import { TotemPersonalizar } from "@/components/totem/TotemPersonalizar";
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
import { gridColsFor } from "@/components/totem/grid";

export const Route = createFileRoute("/t/$empresa/$local/$totem/menu/$category")({
  loader: async ({ params }) => {
    const menu = await getMenuCached(params.empresa, params.local, Number(params.totem));
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
  useRepriceCart(cartKey, menu.products, menu.combos);
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
  const accent = menu.accentColor || undefined;
  const add = useTotemCart((s) => s.add);
  const removeOne = useTotemCart((s) => s.removeOne);
  const cart = useCartForSlug(cartKey);
  useTotemIdleReset(nav);
  // El producto cuya pantalla de "¿le sacamos algo?" está abierta.
  const [personalizando, setPersonalizando] = useState<TotemProduct | null>(null);

  // Carrusel de categorías: en la tablet se desplaza con el dedo; en la PC, con
  // las flechas o la rueda del mouse (que acá mueve en horizontal).
  const carruselRef = useRef<HTMLDivElement>(null);
  const scrollCarrusel = (dir: number) =>
    carruselRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  // Un producto configurable puede estar varias veces en el pedido con cambios
  // distintos, así que el contador de la tarjeta suma todas sus variantes y el
  // − / + de la tarjeta sólo maneja la versión sin cambios. Las otras se
  // editan desde el carrito, que es donde se ven una por una.
  const agregar = (p: TotemProduct, sacados: { id: number; name: string }[] = []) =>
    add(cartKey, {
      kind: "producto",
      refId: p.id,
      name: p.name,
      price: p.price,
      photoUrl: p.photoUrl,
      removed: sacados,
    });

  const alTocarAgregar = (p: TotemProduct) => {
    if (p.removables.length > 0) setPersonalizando(p);
    else agregar(p);
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
        {/* Carrusel de categorías: saltar de una a otra sin volver atrás.
            Mini-tarjetas con foto; en la tablet se desplaza con el dedo, sin
            barra visible. */}
        {(menu.categories.length > 1 || menu.combos.length > 0) && (
          <div className="group/carr relative mb-6">
            <div
              ref={carruselRef}
              onWheel={(e) => {
                if (e.deltaY !== 0) carruselRef.current?.scrollBy({ left: e.deltaY });
              }}
              className="no-scrollbar flex gap-3 overflow-x-auto pb-1"
            >
              {menu.combos.length > 0 && (
                <Link
                  to="/t/$empresa/$local/$totem/combos"
                  params={nav}
                  className="group relative flex h-28 w-52 shrink-0 flex-col justify-end overflow-hidden rounded-2xl border border-border/60 shadow-card"
                >
                  {menu.combos[0].photoUrl ? (
                    <img
                      src={menu.combos[0].photoUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-muted" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
                  <div className="relative z-10 p-3">
                    <h3 className="font-display text-xl leading-none text-white">Combos</h3>
                    <p className="mt-1 text-xs text-white/70">{menu.combos.length} combos</p>
                  </div>
                </Link>
              )}
              {menu.categories.map((c) => {
                const activa = c.id === category.id;
                return (
                  <Link
                    key={c.id}
                    to="/t/$empresa/$local/$totem/menu/$category"
                    params={{ ...nav, category: String(c.id) }}
                    className={`group relative flex h-28 w-52 shrink-0 flex-col justify-end overflow-hidden rounded-2xl shadow-card ${
                      activa ? "border-2" : "border border-border/60"
                    }`}
                    style={activa ? { borderColor: accent ?? "var(--primary)" } : {}}
                  >
                    {c.photoUrl ? (
                      <img
                        src={c.photoUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-muted" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
                    <div className="relative z-10 p-3">
                      <h3 className="font-display text-xl leading-none text-white">{c.name}</h3>
                      <p className="mt-1 text-xs text-white/70">
                        {c.productCount} {c.productCount === 1 ? "producto" : "productos"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Categorías anteriores"
              onClick={() => scrollCarrusel(-1)}
              className="absolute left-0 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 p-1.5 text-muted-foreground shadow-card backdrop-blur transition hover:text-foreground sm:flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Más categorías"
              onClick={() => scrollCarrusel(1)}
              className="absolute right-0 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 p-1.5 text-muted-foreground shadow-card backdrop-blur transition hover:text-foreground sm:flex"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="mb-6">
          {category.tagline && (
            <div className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>
              {category.tagline}
            </div>
          )}
          <h1 className="mt-1 font-display text-4xl md:text-6xl">{category.name}</h1>
        </div>

        <div className={`grid gap-5 ${gridColsFor(items.length)}`}>
          {items.map((p, i) => {
            // Todas las variantes del producto, con cambios y sin cambios.
            const inCart = cart
              .filter((i) => i.kind === "producto" && i.refId === p.id)
              .reduce((n, i) => n + i.quantity, 0);
            // El − / + de la tarjeta maneja la versión sin cambios; las
            // personalizadas se editan en el carrito, donde se ven separadas.
            const claveSinCambios = itemKey("producto", p.id);
            const configurable = p.removables.length > 0;
            return (
              <article
                key={p.id}
                // Lo que ya está en el pedido se marca con el color de la marca:
                // así el cliente ve de un vistazo qué lleva, sin tener que leer
                // el número de cada contador.
                className={`aparece flex flex-col overflow-hidden rounded-3xl border bg-card/40 shadow-card transition ${
                  inCart > 0 ? "border-2" : "border-border/60"
                }`}
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
                  <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                    <span className="font-display text-3xl" style={{ color: accent }}>
                      {formatPrice(p.price)}
                    </span>
                    {inCart > 0 && !configurable ? (
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
                        onClick={() => alTocarAgregar(p)}
                        className="flex h-14 items-center gap-2 rounded-2xl px-6 font-display text-lg uppercase tracking-wide text-white transition hover:scale-[1.03] active:scale-[0.97]"
                        style={{ background: accent ?? "var(--primary)" }}
                      >
                        <Plus className="h-5 w-5" />
                        {/* Un producto configurable no suma de a uno callado:
                            el botón anuncia que va a preguntar antes. */}
                        {configurable
                          ? inCart > 0
                            ? `Agregar otro · ${inCart}`
                            : "Elegir"
                          : "Agregar"}
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

      {personalizando && (
        <TotemPersonalizar
          producto={personalizando}
          accent={accent}
          onCancel={() => setPersonalizando(null)}
          onConfirm={(sacados) => {
            agregar(personalizando, sacados);
            setPersonalizando(null);
          }}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ImageOff, Plus, Minus, ShoppingBag } from "lucide-react";
import type { TotemProduct, TotemCombo } from "@/lib/api/totem.functions";
import { MAX_POR_LINEA } from "@/lib/pedido-reglas";
import { getOnlineMenuCached, onlineCartKey } from "@/lib/online-menu-cache";
import { OnlineError } from "@/components/online/OnlineError";
import { OnlineHeader } from "@/components/online/OnlineHeader";
import { ElegirPan } from "@/components/totem/ElegirPan";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import {
  useTotemCart,
  useCartForSlug,
  useRepriceCart,
  cartTotal,
  cartCount,
  formatPrice,
  itemKey,
  claveDe,
  regaloDeProducto,
  type Pan,
} from "@/lib/totem-cart";

export const Route = createFileRoute("/p/$empresa/$local/")({
  loader: ({ params }) => getOnlineMenuCached(params.empresa, params.local),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Pedí online — ${loaderData.name}` : "Pedido online" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  errorComponent: ({ error }) => <OnlineError message={error.message} />,
  component: OnlineMenuPage,
});

/**
 * El menú del pedido online, pensado para el celular del cliente: una sola
 * lista con todas las categorías, y una barra de categorías pegada arriba para
 * saltar entre ellas. En un teléfono se scrollea con el pulgar; navegar de
 * pantalla en pantalla como en el tótem serían toques de más.
 */
function OnlineMenuPage() {
  const menu = Route.useLoaderData();
  const { empresa, local } = Route.useParams();
  const cartKey = onlineCartKey(empresa, local);
  useRepriceCart(cartKey, menu.products, menu.combos);
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
  const accent = menu.accentColor || "var(--primary)";

  const items = useCartForSlug(cartKey);
  const total = cartTotal(items);
  const cantidad = cartCount(items);

  const secciones = useMemo(
    () =>
      menu.categories.map((c) => ({
        ...c,
        productos: menu.products.filter((p) => p.categoryId === c.id),
      })),
    [menu.categories, menu.products],
  );

  const minimo = Number(menu.minOrder);

  // La categoría que se está viendo, marcada en la barra. En un menú largo,
  // scrolleando con el pulgar, es la forma de saber dónde estás sin volver
  // arriba.
  const ids = useMemo(
    () => [...(menu.combos.length > 0 ? ["combos"] : []), ...secciones.map((c) => `cat-${c.id}`)],
    [menu.combos.length, secciones],
  );
  const [activa, setActiva] = useState<string | null>(null);
  const barra = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Una sección cuenta como "la que se ve" cuando cruza una franja justo
    // debajo de la barra de categorías.
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.find((e) => e.isIntersecting);
        if (visible) setActiva(visible.target.id);
      },
      { rootMargin: "-140px 0px -65% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [ids]);

  // La barra se corre sola para que la categoría marcada no quede escondida a
  // un costado. Se mueve solo la barra, nunca la página.
  useEffect(() => {
    const cont = barra.current;
    const chip = cont?.querySelector<HTMLElement>(`[data-cat="${activa}"]`);
    if (!cont || !chip) return;
    cont.scrollTo({
      left: chip.offsetLeft - cont.clientWidth / 2 + chip.clientWidth / 2,
      behavior: "smooth",
    });
  }, [activa]);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <OnlineHeader
        empresa={empresa}
        local={local}
        name={menu.name}
        sucursal={menu.locationName}
        logoUrl={menu.logoUrl}
        minimoLabel={minimo > 0 ? `Mínimo ${formatPrice(minimo)}` : undefined}
      />

      {(secciones.length > 1 || menu.combos.length > 0) && (
        <nav
          aria-label="Categorías"
          className="sticky top-16 z-20 mt-3 border-b border-border bg-background"
        >
          <div
            ref={barra}
            className="mx-auto flex w-full max-w-2xl gap-2 overflow-x-auto px-4 py-3"
          >
            {menu.combos.length > 0 && (
              <ChipCategoria id="combos" label="Combos" activa={activa} accent={accent} />
            )}
            {secciones.map((c) => (
              <ChipCategoria
                key={c.id}
                id={`cat-${c.id}`}
                label={c.name}
                activa={activa}
                accent={accent}
              />
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-4">
        {/* Todo apagado o agotado: una pantalla en blanco parece un error. */}
        {menu.combos.length === 0 && secciones.length === 0 && (
          <div className="mt-10 rounded-3xl border border-border bg-card/60 p-6 text-center">
            <h2 className="font-display text-3xl">Por ahora no hay nada disponible</h2>
            <p className="mt-2 text-muted-foreground">
              Se nos terminó lo que teníamos para hoy. Volvé a mirar en un rato.
            </p>
          </div>
        )}

        {menu.combos.length > 0 && (
          <section id="combos" className="scroll-mt-32 pb-6">
            <h2 className="mb-3 font-display text-3xl">Combos</h2>
            <div className="space-y-3">
              {menu.combos.map((c) => (
                <FilaCombo key={c.id} combo={c} cartKey={cartKey} accent={accent} />
              ))}
            </div>
          </section>
        )}

        {secciones.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32 pb-6">
            <h2 className="font-display text-3xl">{c.name}</h2>
            {c.tagline && <p className="text-sm text-muted-foreground">{c.tagline}</p>}
            <div className="mt-3 space-y-3">
              {c.productos.map((p) => (
                <FilaProducto key={p.id} producto={p} cartKey={cartKey} accent={accent} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {cantidad > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background p-4">
          <Link
            to="/p/$empresa/$local/carrito"
            params={{ empresa, local }}
            className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between rounded-2xl px-5 font-bold text-white"
            style={{ background: accent }}
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Ver mi pedido · {cantidad}
            </span>
            <span className="text-lg">{formatPrice(total)}</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function ChipCategoria({
  id,
  label,
  activa,
  accent,
}: {
  id: string;
  label: string;
  activa: string | null;
  accent: string;
}) {
  const esta = activa === id;
  return (
    <a
      href={`#${id}`}
      data-cat={id}
      aria-current={esta ? "true" : undefined}
      onClick={(e) => {
        // Deslizar hasta la categoría en vez de saltar de golpe: en el
        // celular el salto seco desorienta.
        e.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition ${
        esta ? "border-transparent text-white" : "border-border hover:border-primary"
      }`}
      style={esta ? { background: accent } : undefined}
    >
      {label}
    </a>
  );
}

function Foto({ url }: { url: string | null }) {
  return (
    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted">
      {url ? (
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageOff className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

/**
 * El botón de agregar, que se abre en − cantidad + cuando ya hay unidades: así
 * equivocarse tocando se arregla ahí mismo, sin ir al pedido.
 */
function Cantidad({
  clave,
  enCarrito,
  accent,
  onAgregar,
  nombre,
}: {
  clave: string;
  enCarrito: number;
  accent: string;
  onAgregar: () => void;
  nombre: string;
}) {
  const removeOne = useTotemCart((s) => s.removeOne);
  if (enCarrito === 0) {
    return (
      <button
        type="button"
        onClick={onAgregar}
        aria-label={`Agregar ${nombre}`}
        className="flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold text-white active:scale-95"
        style={{ background: accent }}
      >
        <Plus className="h-4 w-4" /> Agregar
      </button>
    );
  }
  return (
    <div
      className="flex items-center gap-1 rounded-xl p-1 text-white"
      style={{ background: accent }}
    >
      <button
        type="button"
        onClick={() => removeOne(clave)}
        aria-label={`Quitar un ${nombre}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg active:scale-95"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-6 text-center font-bold">{enCarrito}</span>
      <button
        type="button"
        onClick={onAgregar}
        disabled={enCarrito >= MAX_POR_LINEA}
        aria-label={`Agregar otro ${nombre}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg active:scale-95 disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function FilaProducto({
  producto: p,
  cartKey,
  accent,
}: {
  producto: TotemProduct;
  cartKey: string;
  accent: string;
}) {
  const add = useTotemCart((s) => s.add);
  const items = useCartForSlug(cartKey);
  // En los que se hacen en blanco o negro, el − / + maneja el pan marcado.
  const [panElegido, setPanElegido] = useState<Pan>("blanco");
  const pan = p.pan === "ambos" ? panElegido : undefined;
  // El − / + maneja la versión sin cambios; las personalizadas se editan en
  // "Tu pedido", donde se ven una por una.
  const clave = itemKey("producto", p.id, [], [], pan);
  const enCarrito = items.find((i) => claveDe(i) === clave)?.quantity;
  const personalizable = p.removables.length > 0 || p.extras.length > 0;

  return (
    <article className="flex gap-3 rounded-2xl border border-border bg-card/40 p-3">
      <Foto url={p.photoUrl} />
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-bold leading-tight">{p.name}</h3>
        {p.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
        )}
        {personalizable && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Le podés sacar o agregar cosas desde tu pedido
          </p>
        )}
        <div className="mt-1.5">
          <ElegirPan pan={p.pan} elegido={panElegido} onElegir={setPanElegido} accent={accent} />
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-display text-xl" style={{ color: accent }}>
            {formatPrice(p.price)}
          </span>
          <Cantidad
            clave={clave}
            enCarrito={enCarrito ?? 0}
            accent={accent}
            nombre={p.name}
            onAgregar={() =>
              add(cartKey, {
                kind: "producto",
                refId: p.id,
                name: p.name,
                price: p.price,
                photoUrl: p.photoUrl,
                pan,
                regalo: regaloDeProducto(p),
              })
            }
          />
        </div>
      </div>
    </article>
  );
}

function FilaCombo({
  combo: c,
  cartKey,
  accent,
}: {
  combo: TotemCombo;
  cartKey: string;
  accent: string;
}) {
  const add = useTotemCart((s) => s.add);
  const items = useCartForSlug(cartKey);
  const clave = itemKey("combo", c.id);
  const enCarrito = items.find((i) => claveDe(i) === clave)?.quantity;

  return (
    <article className="flex gap-3 rounded-2xl border border-border bg-card/40 p-3">
      <Foto url={c.photoUrl} />
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-bold leading-tight">{c.name}</h3>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
          {c.items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ""}${i.name}`).join(" + ")}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-display text-xl" style={{ color: accent }}>
            {formatPrice(c.price)}
          </span>
          <Cantidad
            clave={clave}
            enCarrito={enCarrito ?? 0}
            accent={accent}
            nombre={c.name}
            onAgregar={() =>
              add(cartKey, {
                kind: "combo",
                refId: c.id,
                name: c.name,
                price: c.price,
                photoUrl: c.photoUrl,
                regalo: c.regalo,
              })
            }
          />
        </div>
      </div>
    </article>
  );
}

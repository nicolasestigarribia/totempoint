import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ImageOff, Plus, Minus, Bike, Store, ShoppingBag } from "lucide-react";
import type { TotemProduct, TotemCombo } from "@/lib/api/totem.functions";
import { getOnlineMenuCached, onlineCartKey } from "@/lib/online-menu-cache";
import { OnlineError } from "@/components/online/OnlineError";
import { OnlineHeader } from "@/components/online/OnlineHeader";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import {
  useTotemCart,
  useCartForSlug,
  useRepriceCart,
  cartTotal,
  cartCount,
  formatPrice,
  itemKey,
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

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <OnlineHeader
        empresa={empresa}
        local={local}
        name={menu.name}
        sucursal={menu.locationName}
        logoUrl={menu.logoUrl}
      />

      {/* Cómo se puede pedir, antes de que el cliente arme nada: enterarse en
          el último paso de que no hacen envío es la peor forma de enterarse. */}
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
          {menu.delivery && (
            <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5">
              <Bike className="h-3.5 w-3.5" /> Envío
            </span>
          )}
          {menu.pickup && (
            <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5">
              <Store className="h-3.5 w-3.5" /> Retiro en el local
            </span>
          )}
          {minimo > 0 && (
            <span className="rounded-full border border-border px-3 py-1.5 text-muted-foreground">
              Mínimo {formatPrice(minimo)}
            </span>
          )}
        </div>
      </div>

      {(secciones.length > 1 || menu.combos.length > 0) && (
        <nav
          aria-label="Categorías"
          className="sticky top-16 z-20 mt-3 border-b border-border bg-background"
        >
          <div className="mx-auto flex w-full max-w-2xl gap-2 overflow-x-auto px-4 py-3">
            {menu.combos.length > 0 && <ChipCategoria href="#combos" label="Combos" />}
            {secciones.map((c) => (
              <ChipCategoria key={c.id} href={`#cat-${c.id}`} label={c.name} />
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-4">
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

function ChipCategoria({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="shrink-0 rounded-full border border-border px-4 py-2 text-sm font-bold whitespace-nowrap transition hover:border-primary"
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
        aria-label={`Agregar otro ${nombre}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg active:scale-95"
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
  // El − / + maneja la versión sin cambios; las personalizadas se editan en
  // "Tu pedido", donde se ven una por una.
  const clave = itemKey("producto", p.id);
  const enCarrito = items.find(
    (i) => itemKey(i.kind, i.refId, i.removed, i.extras) === clave,
  )?.quantity;
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
  const enCarrito = items.find(
    (i) => itemKey(i.kind, i.refId, i.removed, i.extras) === clave,
  )?.quantity;

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
              })
            }
          />
        </div>
      </div>
    </article>
  );
}

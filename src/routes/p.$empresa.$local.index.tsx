import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ImageOff,
  Plus,
  Minus,
  ShoppingBag,
  ChevronDown,
  Gift,
  Bike,
  Store,
  Wallet,
} from "lucide-react";
import type { TotemProduct, TotemCombo, OnlineMenu } from "@/lib/api/totem.functions";
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
  regaloDelCarrito,
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
  const regalo = regaloDelCarrito(items);

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

      <InfoDelLocal menu={menu} />

      {(secciones.length > 1 || menu.combos.length > 0) && (
        <nav
          aria-label="Categorías"
          className="sticky top-16 z-20 mt-3 border-b border-border bg-background"
        >
          <div
            ref={barra}
            className="no-scrollbar mx-auto flex w-full max-w-2xl gap-2 overflow-x-auto px-4 py-3"
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

        {secciones.map((c, idx) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32 pb-6">
            <h2 className="font-display text-3xl">{c.name}</h2>
            {/* La misma bajada en varias categorías seguidas (las de miga) se
                lee una vez: repetida cinco veces era un muro de texto. */}
            {c.tagline && c.tagline !== secciones[idx - 1]?.tagline && (
              <Bajada
                texto={c.tagline}
                regalo={c.productos.some((p) => p.regalo)}
                accent={accent}
              />
            )}
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
          {/* Ya ganó sándwiches de regalo y no los eligió: se le recuerda acá,
              que es donde está mirando mientras arma el pedido. */}
          {regalo.pendientes > 0 && (
            <p className="mx-auto mb-2 flex w-full max-w-2xl items-center justify-center gap-1.5 text-sm font-bold text-emerald-400">
              <Gift className="h-4 w-4" />
              Te {regalo.pendientes === 1 ? "corresponde" : "corresponden"} {regalo.pendientes} de
              regalo: elegilos y no te los cobramos
            </p>
          )}
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

/**
 * Lo que el cliente quiere saber antes de elegir: si le llevan, si puede
 * retirar y cómo paga. Una franja de una línea, debajo de la marca.
 */
function InfoDelLocal({ menu }: { menu: OnlineMenu }) {
  const envioDesde = menu.tiers.length ? Math.min(...menu.tiers.map((t) => Number(t.price))) : null;
  const pagos = [menu.mercadoPago && "Mercado Pago", menu.cash && "efectivo"].filter(Boolean);
  const datos = [
    menu.delivery && {
      icono: Bike,
      texto:
        envioDesde === null
          ? "Envío a domicilio"
          : envioDesde === 0
            ? "Envío gratis cerca"
            : `Envío desde ${formatPrice(envioDesde)}`,
    },
    menu.pickup && { icono: Store, texto: "Retiro en el local" },
    pagos.length > 0 && { icono: Wallet, texto: pagos.join(" o ") },
  ].filter((d): d is { icono: typeof Bike; texto: string } => !!d);
  if (datos.length === 0) return null;

  return (
    <div className="no-scrollbar mx-auto flex w-full max-w-2xl gap-2 overflow-x-auto px-4 pt-3">
      {datos.map(({ icono: Icono, texto }) => (
        <span
          key={texto}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-card/60 px-3 py-1.5 text-xs font-bold text-muted-foreground"
        >
          <Icono className="h-3.5 w-3.5" />
          {texto}
        </span>
      ))}
    </div>
  );
}

/** La bajada de una categoría. Si tiene regalo, va como aviso, con su ícono. */
function Bajada({ texto, regalo, accent }: { texto: string; regalo: boolean; accent: string }) {
  if (!regalo) return <p className="text-sm text-muted-foreground">{texto}</p>;
  return (
    <p className="mt-2 flex items-start gap-2.5 rounded-2xl border border-border bg-card/40 p-3 text-sm text-muted-foreground">
      <Gift className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
      {texto}
    </p>
  );
}

/**
 * "01 · Jamón y queso" → el número aparte, para mostrarlo como en la carta
 * de la casa ("N°1"). Los que no tienen número quedan como están.
 */
function partirNombre(nombre: string): { numero: string | null; resto: string } {
  const m = nombre.match(/^0*(\d+)\s*·\s*(.+)$/);
  return m ? { numero: m[1], resto: m[2] } : { numero: null, resto: nombre };
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

/**
 * Una tarjeta del menú que se abre en el lugar.
 *
 * Cerrada es una fila compacta, para recorrer el menú rápido. Tocando la foto o
 * el texto se abre ahí mismo: la foto grande y todo lo que dice, sin recortes
 * —en un combo, cada cosa que trae en su renglón—. Tocando de nuevo se cierra.
 * El agregar y el pan quedan afuera de esa zona, así que nunca se abre por
 * querer agregar, ni se agrega por querer mirar.
 */
function TarjetaMenu({
  accent,
  foto,
  nombre,
  resumen,
  detalle,
  hayMas,
  opciones,
  pie,
}: {
  accent: string;
  foto: string | null;
  nombre: string;
  /** Lo que se lee cerrada, recortado a dos renglones. */
  resumen: React.ReactNode;
  /** Lo que se lee abierta, completo. */
  detalle: React.ReactNode;
  /** Si abrirla muestra algo que cerrada no se ve: ahí se ofrece "Ver más". */
  hayMas: boolean;
  /** Lo que se elige (el pan): fuera de la zona que abre. */
  opciones?: React.ReactNode;
  /** Precio y agregar. */
  pie: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  const alternar = () => setAbierta((a) => !a);

  const { numero, resto: nombreSolo } = partirNombre(nombre);
  const texto = (
    <>
      <h3 className="flex items-start gap-2 font-bold leading-tight">
        {numero && (
          <span
            className="mt-px shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none text-white"
            style={{ background: accent }}
            aria-label={`Número ${numero}`}
          >
            N°{numero}
          </span>
        )}
        <span>{nombreSolo}</span>
      </h3>
      <div className="mt-0.5 text-sm text-muted-foreground">{abierta ? detalle : resumen}</div>
      {(hayMas || abierta) && (
        <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-bold text-muted-foreground">
          {abierta ? "Ver menos" : "Ver más"}
          <ChevronDown className={`h-3.5 w-3.5 transition ${abierta ? "rotate-180" : ""}`} />
        </span>
      )}
    </>
  );
  const resto = (
    <>
      {opciones && <div className="mt-1.5">{opciones}</div>}
      <div className="mt-auto flex items-center justify-between gap-2 pt-2">{pie}</div>
    </>
  );

  // Abierta: la foto grande arriba y todo el texto debajo.
  if (abierta) {
    return (
      <article className="rounded-2xl border border-border bg-card/40 p-3">
        <button type="button" onClick={alternar} aria-expanded className="block w-full text-left">
          <div className="mb-3 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted">
            {foto ? (
              <img src={foto} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageOff className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          {texto}
        </button>
        {resto}
      </article>
    );
  }

  // Cerrada: la fila compacta de siempre. La foto y el texto abren; el pan y el
  // agregar, no.
  return (
    <article className="flex gap-3 rounded-2xl border border-border bg-card/40 p-3">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={false}
        aria-label={`Ver ${nombre}`}
        className="shrink-0 self-start"
      >
        <Foto url={foto} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <button type="button" onClick={alternar} aria-expanded={false} className="text-left">
          {texto}
        </button>
        {resto}
      </div>
    </article>
  );
}

/** Más de esto en una descripción ya no entra en dos renglones de la tarjeta. */
const LARGO_RESUMEN = 70;

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
  const aviso = personalizable ? "Le podés sacar o agregar cosas desde tu pedido" : null;

  return (
    <TarjetaMenu
      accent={accent}
      foto={p.photoUrl}
      nombre={p.name}
      hayMas={(p.description?.length ?? 0) > LARGO_RESUMEN}
      resumen={
        <>
          {p.description && <p className="line-clamp-2">{p.description}</p>}
          {aviso && <p className="text-xs">{aviso}</p>}
        </>
      }
      detalle={
        <>
          {p.description && <p>{p.description}</p>}
          {aviso && <p className="text-xs">{aviso}</p>}
        </>
      }
      opciones={
        p.pan && (
          <ElegirPan pan={p.pan} elegido={panElegido} onElegir={setPanElegido} accent={accent} />
        )
      }
      pie={
        <>
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
        </>
      }
    />
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
  const unidades = c.items.reduce((t, i) => t + i.quantity, 0);

  return (
    <TarjetaMenu
      accent={accent}
      foto={c.photoUrl}
      nombre={c.name}
      // Un combo casi nunca entra en dos renglones: siempre se puede abrir.
      hayMas
      resumen={
        <p className="line-clamp-2">
          {c.description ? `${c.description} · ` : ""}Trae {unidades}{" "}
          {unidades === 1 ? "unidad" : "unidades"}
        </p>
      }
      detalle={
        <>
          {c.description && <p className="mb-2">{c.description}</p>}
          <p className="text-xs font-bold uppercase tracking-wide">
            Trae {unidades} {unidades === 1 ? "unidad" : "unidades"}
          </p>
          <ul className="mt-1 space-y-0.5 text-foreground">
            {c.items.map((i, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="w-7 shrink-0 text-right font-bold">{i.quantity}×</span>
                <span>{i.name}</span>
              </li>
            ))}
          </ul>
        </>
      }
      pie={
        <>
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
        </>
      }
    />
  );
}

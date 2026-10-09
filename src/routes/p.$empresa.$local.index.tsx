import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  Search,
  X,
  RotateCcw,
  Radio,
  Clock,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import type { TotemProduct, TotemCombo, OnlineMenu } from "@/lib/api/totem.functions";
import { MAX_POR_LINEA } from "@/lib/pedido-reglas";
import { getOnlineMenuCached, onlineCartKey } from "@/lib/online-menu-cache";
import { OnlineError } from "@/components/online/OnlineError";
import { ogMeta } from "@/lib/og";
import { OnlineHeader } from "@/components/online/OnlineHeader";
import { useHorario } from "@/components/online/useHorario";
import { ElegirGustos } from "@/components/online/ElegirGustos";
import type { EstadoHorario } from "@/lib/horario";
import {
  haceCuanto,
  leerParaRepetir,
  rearmarPedido,
  type PedidoGuardado,
} from "@/lib/online-repetir";
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
  type TotemCartEleccion,
  useTotemCart as useCarrito,
  type Pan,
} from "@/lib/totem-cart";

/**
 * `?ver=1`: el menú para mirar, sin pedir. Es el que abre el QR pegado en el
 * local (vía "Ver el menú" en la página de la empresa): fotos, precios y
 * descripciones, sin agregar ni carrito.
 */
const SoloVer = createContext(false);

export const Route = createFileRoute("/p/$empresa/$local/")({
  validateSearch: (search: Record<string, unknown>): { ver?: boolean } =>
    search.ver === true || search.ver === 1 || search.ver === "1" || search.ver === "true"
      ? { ver: true }
      : {},
  loader: ({ params }) => getOnlineMenuCached(params.empresa, params.local),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Pedí online — ${loaderData.name}` : "Pedido online" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // El link que el comercio comparte por WhatsApp: que la vista previa
      // diga su nombre y no "Totempoint".
      ...(loaderData
        ? ogMeta({
            title: loaderData.name,
            description: `Hacé tu pedido online a ${loaderData.name}`,
          })
        : []),
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
  const soloVer = Route.useSearch().ver === true;
  const cartKey = onlineCartKey(empresa, local);
  useRepriceCart(cartKey, menu.products, menu.combos);
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
  const accent = menu.accentColor || "var(--primary)";

  const items = useCartForSlug(cartKey);
  const total = cartTotal(items);
  const cantidad = cartCount(items);
  const regalo = regaloDelCarrito(items);
  const horario = useHorario(menu.horarios);

  const secciones = useMemo(
    () =>
      menu.categories.map((c) => ({
        ...c,
        productos: menu.products.filter((p) => p.categoryId === c.id),
      })),
    [menu.categories, menu.products],
  );

  const minimo = Number(menu.minOrder);

  // El buscador: con texto, el menú se reemplaza por lo que coincide.
  const [busqueda, setBusqueda] = useState("");
  const termino = normalizar(busqueda.trim());
  const resultados = useMemo(() => {
    if (!termino) return null;
    const coincide = (...textos: (string | null | undefined)[]) =>
      textos.some((t) => t && normalizar(t).includes(termino));
    return {
      combos: menu.combos.filter((c) =>
        coincide(c.name, c.description, ...c.items.map((i) => i.name)),
      ),
      // Por número y nombre ("21 ·" antes que "40 ·"), no en el orden del menú,
      // que mezcla categorías.
      productos: menu.products
        .filter((p) => coincide(p.name, p.description))
        .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true })),
    };
  }, [termino, menu.combos, menu.products]);

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
    <SoloVer.Provider value={soloVer}>
      <div className="flex min-h-svh flex-col bg-background">
        <OnlineHeader
          empresa={empresa}
          local={local}
          name={menu.name}
          sucursal={menu.locationName}
          logoUrl={menu.logoUrl}
          minimoLabel={minimo > 0 ? `Mínimo ${formatPrice(minimo)}` : undefined}
          cambiarSucursal={menu.sucursalesOnline > 1}
        />

        {soloVer ? (
          <div className="mx-auto mt-3 flex w-full max-w-2xl items-center gap-3 px-4">
            <p className="flex flex-1 items-center gap-1.5 text-sm text-muted-foreground">
              <Eye className="h-4 w-4 shrink-0" /> Estás viendo el menú
            </p>
            {/* Con varias sucursales vuelve a elegir envío o retiro: la que le
                lleva puede no ser la que estaba mirando. */}
            {menu.sucursalesOnline > 1 ? (
              <Link
                to="/p/$empresa"
                params={{ empresa }}
                className="shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white"
                style={{ background: accent }}
              >
                Pedir online
              </Link>
            ) : (
              <Link
                to="/p/$empresa/$local"
                params={{ empresa, local }}
                search={{}}
                className="shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white"
                style={{ background: accent }}
              >
                Pedir online
              </Link>
            )}
          </div>
        ) : (
          <InfoDelLocal menu={menu} horario={horario} />
        )}

        {(secciones.length > 1 || menu.combos.length > 0) && (
          <nav
            aria-label="Categorías"
            className="sticky top-16 z-20 mt-3 border-b border-border bg-background"
          >
            <div className="mx-auto w-full max-w-2xl px-4 pt-1">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    window.scrollTo({ top: 0 });
                  }}
                  placeholder="Buscar: roquefort, palta, 21…"
                  aria-label="Buscar en el menú"
                  enterKeyHint="search"
                  className="h-11 w-full rounded-full border border-border bg-card/40 pl-9 pr-10 text-base outline-none focus:border-primary"
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => setBusqueda("")}
                    aria-label="Borrar búsqueda"
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
            </div>
            <div
              hidden={!!resultados}
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

          {resultados ? (
            <Resultados
              resultados={resultados}
              busqueda={busqueda.trim()}
              cartKey={cartKey}
              accent={accent}
            />
          ) : (
            <>
              {!horario.abierto && !soloVer && (
                <div className="mb-5 flex items-start gap-3 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-bold">Ahora estamos cerrados</p>
                    <p className="text-sm opacity-90">
                      Tomamos pedidos {horario.texto}. Mientras tanto podés mirar el menú y armar tu
                      pedido.
                    </p>
                  </div>
                </div>
              )}
              {cantidad === 0 && !soloVer && (
                <RepetirPedido cartKey={cartKey} menu={menu} empresa={empresa} local={local} />
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
            </>
          )}
        </main>

        {cantidad > 0 && !soloVer && (
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
              key={cantidad}
              className="latido mx-auto flex h-14 w-full max-w-2xl items-center justify-between rounded-2xl px-5 font-bold text-white"
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
    </SoloVer.Provider>
  );
}

/**
 * Lo que el cliente quiere saber antes de elegir: si le llevan, si puede
 * retirar y cómo paga. Una franja de una línea, debajo de la marca.
 */
function InfoDelLocal({ menu, horario }: { menu: OnlineMenu; horario: EstadoHorario }) {
  const envioDesde = menu.tiers.length ? Math.min(...menu.tiers.map((t) => Number(t.price))) : null;
  const pagos = [menu.mercadoPago && "Mercado Pago", menu.cash && "efectivo"].filter(Boolean);
  const minimo = Number(menu.minOrder);
  const conRegalo = menu.products.find((p) => p.regalo)?.regalo;
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
    pagos.length > 0 && { icono: Wallet, texto: `Pagás con ${pagos.join(" o ")}` },
    conRegalo && {
      icono: Gift,
      texto: `Cada ${conRegalo.cada}, ${conRegalo.cantidad} de regalo`,
    },
    minimo > 0 && { icono: ShoppingBag, texto: `Pedido mínimo ${formatPrice(minimo)}` },
    { icono: Radio, texto: "Seguí tu pedido en vivo" },
  ].filter((d): d is { icono: typeof Bike; texto: string } => !!d);

  // El estado va primero y fijo, con su punto que late: es lo único que cambia
  // con la hora y lo primero que alguien quiere saber.
  const estado = (
    <span
      className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
        horario.abierto ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-300"
      }`}
    >
      <span className="relative flex h-2 w-2">
        {horario.abierto && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            horario.abierto ? "bg-emerald-400" : "bg-amber-300"
          }`}
        />
      </span>
      {horario.abierto
        ? horario.texto
          ? `Abierto ${horario.texto}`
          : "Abierto ahora"
        : `Cerrado · abre ${horario.texto}`}
    </span>
  );

  const pastilla = ({ icono: Icono, texto }: (typeof datos)[number], copia: number) => (
    <span
      key={`${copia}-${texto}`}
      className="mr-2 flex shrink-0 items-center gap-1.5 rounded-full bg-card/60 px-3 py-1.5 text-xs font-bold text-muted-foreground"
    >
      <Icono className="h-3.5 w-3.5" />
      {texto}
    </span>
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 pt-3">
      {estado}
      {/* Pasa sola, de derecha a izquierda; con el dedo encima se frena. */}
      <div className="marquesina-caja min-w-0 flex-1">
        <div
          className="marquesina"
          style={{ "--marquesina-duracion": `${datos.length * 5}s` } as React.CSSProperties}
        >
          {datos.map((d) => pastilla(d, 0))}
          {datos.map((d) => pastilla(d, 1))}
        </div>
      </div>
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

/** Para buscar sin que importen tildes ni mayúsculas: "jamon" encuentra "Jamón". */
function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function Resultados({
  resultados,
  busqueda,
  cartKey,
  accent,
}: {
  resultados: { combos: TotemCombo[]; productos: TotemProduct[] };
  busqueda: string;
  cartKey: string;
  accent: string;
}) {
  const total = resultados.combos.length + resultados.productos.length;
  if (total === 0) {
    return (
      <div className="mt-8 text-center">
        <p className="font-display text-2xl">No encontramos “{busqueda}”</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Probá con otra palabra, un ingrediente o el número del sándwich.
        </p>
      </div>
    );
  }
  return (
    <section className="pb-6">
      <p className="mb-3 text-sm text-muted-foreground">
        {total} {total === 1 ? "resultado" : "resultados"} para “{busqueda}”
      </p>
      <div className="space-y-3">
        {resultados.combos.map((c) => (
          <FilaCombo key={`c${c.id}`} combo={c} cartKey={cartKey} accent={accent} />
        ))}
        {resultados.productos.map((p) => (
          <FilaProducto key={`p${p.id}`} producto={p} cartKey={cartKey} accent={accent} />
        ))}
      </div>
    </section>
  );
}

/**
 * "Tu último pedido", arriba del menú, para el que vuelve. Lo guarda el celular
 * al enviar; repetir lo rearma con los precios de hoy y lo lleva a su pedido
 * para que lo revise antes de mandarlo.
 */
function RepetirPedido({
  cartKey,
  menu,
  empresa,
  local,
}: {
  cartKey: string;
  menu: OnlineMenu;
  empresa: string;
  local: string;
}) {
  const navigate = useNavigate();
  const [guardado, setGuardado] = useState<PedidoGuardado | null>(null);
  // Se lee en el navegador: en el servidor no hay celular que lo recuerde.
  useEffect(() => setGuardado(leerParaRepetir(cartKey)), [cartKey]);
  if (!guardado) return null;

  const { lineas, faltan } = rearmarPedido(guardado, menu.products, menu.combos);
  if (lineas.length === 0) return null;
  // Con los precios y el regalo de hoy: es lo que va a pagar si lo repite.
  const total = cartTotal(lineas);
  const resumen = lineas.map((l) => `${l.quantity}× ${l.name}${l.pan ? ` (pan ${l.pan})` : ""}`);

  const repetir = () => {
    useCarrito.setState({ slug: cartKey, items: lineas });
    if (faltan.length > 0) {
      toast(`${faltan.join(", ")} ya no está en el menú: armamos el resto`, { duration: 6000 });
    }
    void navigate({ to: "/p/$empresa/$local/carrito", params: { empresa, local } });
  };

  return (
    <section className="mb-6 rounded-3xl border border-border bg-card/40 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Tu último pedido · {haceCuanto(guardado.hecho)}
      </p>
      <p className="mt-1 line-clamp-2 text-sm">
        {resumen.slice(0, 3).join(" · ")}
        {resumen.length > 3 ? ` y ${resumen.length - 3} más` : ""}
      </p>
      <button
        type="button"
        onClick={repetir}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border font-bold"
      >
        <RotateCcw className="h-4 w-4" />
        Repetir pedido · {formatPrice(total)}
      </button>
    </section>
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
  const [cargada, setCargada] = useState(false);
  return (
    <div
      className={`h-24 w-24 shrink-0 overflow-hidden rounded-2xl ${url && !cargada ? "cargando-foto" : "bg-muted"}`}
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          onLoad={() => setCargada(true)}
          // Si ya estaba en caché, terminó de cargar antes de que la página
          // se activara y el onLoad no llega: se mira al montarla.
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0 && !cargada) setCargada(true);
          }}
          className={`h-full w-full object-cover transition-opacity duration-500 ${cargada ? "opacity-100" : "opacity-0"}`}
        />
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
  forzarAbierta = false,
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
  /** Abierta sí o sí: mientras el cliente arma un combo a elección. */
  forzarAbierta?: boolean;
}) {
  const [abiertaPropia, setAbierta] = useState(false);
  const abierta = abiertaPropia || forzarAbierta;
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
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">{pie}</div>
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
  const soloVer = useContext(SoloVer);
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
        p.pan &&
        (soloVer ? (
          <p className="text-xs text-muted-foreground">
            {p.pan === "ambos" ? "En pan blanco o negro" : `En pan ${p.pan}`}
          </p>
        ) : (
          <ElegirPan pan={p.pan} elegido={panElegido} onElegir={setPanElegido} accent={accent} />
        ))
      }
      pie={
        <>
          <span className="font-display text-xl" style={{ color: accent }}>
            {formatPrice(p.price)}
          </span>
          {!soloVer && (
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
          )}
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
  const aEleccion = c.grupos.length > 0;
  // Un combo a elección puede estar varias veces con gustos distintos: se
  // cuentan todas sus líneas.
  const enCarrito = aEleccion
    ? items
        .filter((i) => i.kind === "combo" && i.refId === c.id)
        .reduce((t, i) => t + i.quantity, 0)
    : items.find((i) => claveDe(i) === clave)?.quantity;
  const unidades =
    c.items.reduce((t, i) => t + i.quantity, 0) + c.grupos.reduce((t, g) => t + g.cantidad, 0);
  const [armando, setArmando] = useState(false);
  const soloVer = useContext(SoloVer);

  const agregar = (elecciones?: TotemCartEleccion[]) =>
    add(cartKey, {
      kind: "combo",
      refId: c.id,
      name: c.name,
      price: c.price,
      photoUrl: c.photoUrl,
      regalo: c.regalo,
      elecciones,
    });

  return (
    <TarjetaMenu
      accent={accent}
      foto={c.photoUrl}
      nombre={c.name}
      // Un combo casi nunca entra en dos renglones: siempre se puede abrir.
      hayMas
      forzarAbierta={armando}
      resumen={
        <p className="line-clamp-2">
          {c.description ? `${c.description} · ` : ""}
          {aEleccion ? "Elegís los gustos · " : ""}Trae {unidades}{" "}
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
            {c.grupos.map((g) => (
              <li key={`g${g.indice}`} className="flex gap-2">
                <span className="w-7 shrink-0 text-right font-bold">{g.cantidad}×</span>
                <span>{g.nombre}, a elección</span>
              </li>
            ))}
            {c.items.map((i, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="w-7 shrink-0 text-right font-bold">{i.quantity}×</span>
                <span>{i.name}</span>
              </li>
            ))}
          </ul>
        </>
      }
      opciones={
        armando ? (
          <ElegirGustos
            grupos={c.grupos}
            accent={accent}
            textoBoton={`Agregar al pedido · ${formatPrice(c.price)}`}
            onCancelar={() => setArmando(false)}
            onListo={(elecciones) => {
              agregar(elecciones);
              setArmando(false);
              toast.success(`${c.name} agregado a tu pedido`);
            }}
          />
        ) : undefined
      }
      pie={
        armando ? null : (
          <>
            <span className="font-display text-xl" style={{ color: accent }}>
              {formatPrice(c.price)}
            </span>
            {soloVer ? null : aEleccion ? (
              <button
                type="button"
                onClick={() => setArmando(true)}
                className="flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-bold text-white"
                style={{ background: accent }}
              >
                <Plus className="h-4 w-4" />
                {enCarrito ? `Otro (${enCarrito})` : "Elegir gustos"}
              </button>
            ) : (
              <Cantidad
                clave={clave}
                enCarrito={enCarrito ?? 0}
                accent={accent}
                nombre={c.name}
                onAgregar={() => agregar()}
              />
            )}
          </>
        )
      }
    />
  );
}

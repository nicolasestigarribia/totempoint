import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ShoppingBag,
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
import type { OnlineMenu } from "@/lib/api/totem.functions";
import { mesaCartKey, onlineCartKey } from "@/lib/online-menu-cache";
import {
  buscarEnMenu,
  hashDeSeccion,
  idDeCategoria,
  ID_COMBOS,
  seccionDelHash,
} from "@/lib/menu-online";
import { OnlineHeader } from "@/components/online/OnlineHeader";
import { HojaSucursales } from "@/components/online/HojaSucursales";
import { MesaHeader } from "@/components/mesa/MesaHeader";
import { useHorario } from "@/components/online/useHorario";
import { SoloVer } from "@/components/online/menu/solo-ver";
import { TarjetaCombo, TarjetaProducto } from "@/components/online/menu/TarjetaProducto";
import { GrillaCategorias, type CategoriaVisible } from "@/components/online/menu/GrillaCategorias";
import { CarruselCategorias } from "@/components/online/menu/CarruselCategorias";
import { useRevelar } from "@/components/online/menu/useRevelar";
import type { EstadoHorario } from "@/lib/horario";
import {
  haceCuanto,
  leerParaRepetir,
  rearmarPedido,
  type PedidoGuardado,
} from "@/lib/online-repetir";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import {
  useCartForSlug,
  useRepriceCart,
  cartTotal,
  cartCount,
  formatPrice,
  regaloDelCarrito,
  useTotemCart as useCarrito,
} from "@/lib/totem-cart";

/** Por qué canal se abrió el menú. */
export type CanalMenu =
  | { tipo: "online"; empresa: string; local: string; soloVer: boolean }
  | { tipo: "mesa"; token: string; numero: number; onInicio?: () => void };

/** El link a "Tu pedido" de cada canal. */
function IrAlPedido({
  canal,
  className,
  style,
  children,
}: {
  canal: CanalMenu;
  className: string;
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  return canal.tipo === "online" ? (
    <Link
      to="/p/$empresa/$local/carrito"
      params={{ empresa: canal.empresa, local: canal.local }}
      className={className}
      style={style}
    >
      {children}
    </Link>
  ) : (
    <Link
      to="/m/$token/carrito"
      params={{ token: canal.token }}
      className={className}
      style={style}
    >
      {children}
    </Link>
  );
}

/**
 * Si la app ya hidrató. Solo la primera vez hace falta dibujar la grilla antes
 * de mirar el hash: al volver del carrito el menú se monta de nuevo en el
 * navegador, y un cuadro de grilla ahí sería un parpadeo y el scroll perdido.
 */
let hidratado = false;

/** Lo que tapan el encabezado y el carrusel: una sección es "la que se ve" al cruzar esa línea. */
const ALTO_TAPADO = 150;

/** Lo que hace falta para dibujar una sección: su tarjeta de categoría y lo que trae. */
type Bloque =
  | (CategoriaVisible & { tipo: "combos" })
  | (CategoriaVisible & {
      tipo: "categoria";
      categoria: OnlineMenu["categories"][number];
      productos: OnlineMenu["products"];
    });

/**
 * El menú del pedido online, con la identidad del tótem: al entrar, las
 * categorías con foto; al tocar una, el menú entero en una sola lista que
 * arranca en esa categoría y sigue con las demás, con las categorías pegadas
 * arriba para saber dónde estás y saltar a otra. Las tarjetas son las del
 * tótem: la foto manda.
 *
 * La categoría abierta va en el hash de la URL, así el "atrás" del celular
 * vuelve a la grilla en vez de sacarlo del menú.
 *
 * Lo usan dos canales: el pedido online (/p/...) y el pedido en mesa (/m/...).
 * Cambian el encabezado, la franja de datos y a dónde lleva "Ver mi pedido";
 * el menú, el buscador y las tarjetas son los mismos.
 */
export function MenuOnline({ menu, canal }: { menu: OnlineMenu; canal: CanalMenu }) {
  const soloVer = canal.tipo === "online" && canal.soloVer;
  const cartKey =
    canal.tipo === "online" ? onlineCartKey(canal.empresa, canal.local) : mesaCartKey(canal.token);
  useRepriceCart(cartKey, menu.products, menu.combos);
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
  const accent = menu.accentColor || "var(--primary)";

  const items = useCartForSlug(cartKey);
  const total = cartTotal(items);
  const cantidad = cartCount(items);
  const regalo = regaloDelCarrito(items);
  const horario = useHorario(menu.horarios);
  const minimo = Number(menu.minOrder);

  // Una categoría sin nada para vender hoy no merece una tarjeta en la grilla.
  const bloques = useMemo<Bloque[]>(() => {
    const deCategorias = menu.categories
      .map((c) => ({ c, productos: menu.products.filter((p) => p.categoryId === c.id) }))
      .filter(({ productos }) => productos.length > 0)
      .map(
        ({ c, productos }): Bloque => ({
          tipo: "categoria",
          id: idDeCategoria(c.id),
          nombre: c.name,
          foto: c.photoUrl,
          cantidad: productos.length,
          categoria: c,
          productos,
        }),
      );
    return menu.combos.length > 0
      ? [
          {
            tipo: "combos",
            id: ID_COMBOS,
            nombre: "Combos",
            foto: menu.combos.find((c) => c.photoUrl)?.photoUrl ?? null,
            cantidad: menu.combos.length,
          },
          ...deCategorias,
        ]
      : deCategorias;
  }, [menu.categories, menu.products, menu.combos]);
  const ids = useMemo(() => bloques.map((b) => b.id), [bloques]);

  // El buscador: con texto, el menú se reemplaza por lo que coincide.
  const [busqueda, setBusqueda] = useState("");
  const [cambiandoSucursal, setCambiandoSucursal] = useState(false);
  const resultados = useMemo(
    () => buscarEnMenu(busqueda, menu.combos, menu.products),
    [busqueda, menu.combos, menu.products],
  );

  // Grilla o lista. Con una sola sección la grilla sería una tarjeta sola: se
  // va directo a la lista.
  const router = useRouter();
  // La URL cambia apenas se toca un link, antes de que cargue la otra página:
  // mientras "Ver mi pedido" carga, este menú sigue en pantalla y leería una
  // URL sin categoría, con lo que saltaba a la grilla. Solo cuenta el hash de
  // esta misma página; yéndose, queda el último.
  const [rutaPropia] = useState(() => router.state.location.pathname);
  const hashVivo = useLocation({ select: (l) => (l.pathname === rutaPropia ? l.hash : null) });
  const ultimoHash = useRef(hashVivo ?? "");
  if (hashVivo !== null) ultimoHash.current = hashVivo;
  const hash = ultimoHash.current;
  // El servidor no recibe el hash: hasta montar se dibuja la grilla, como él,
  // para que React no encuentre otra pantalla al hidratar.
  const [montado, setMontado] = useState(hidratado);
  // A dónde llevar el scroll en el próximo cuadro. Solo lo pide algo que hizo
  // el cliente (abrir, volver, dejar de buscar) o el link que ya traía la
  // categoría; si no, manda la restauración del router (al volver del carrito).
  const scrollPendiente = useRef<{ a: string } | "arriba" | null>(null);
  useEffect(() => {
    if (hidratado) return;
    hidratado = true;
    const delLink = seccionDelHash(window.location.hash, ids);
    if (delLink) scrollPendiente.current = { a: delLink };
    setMontado(true);
    // Solo al hidratar: los ids de ese momento son los del link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const abierta = ids.length <= 1 ? (ids[0] ?? null) : montado ? seccionDelHash(hash, ids) : null;
  const vieneDeLaGrilla = useRef(false);
  const navigate = useNavigate();

  const abrir = (id: string) => {
    vieneDeLaGrilla.current = true;
    scrollPendiente.current = { a: id };
    setActiva(id);
    void navigate({
      to: ".",
      search: (s: Record<string, unknown>) => s,
      hash: hashDeSeccion(id),
      resetScroll: false,
      hashScrollIntoView: false,
    } as never);
  };
  const volver = () => {
    scrollPendiente.current = "arriba";
    // Si entró desde la grilla, volver es el "atrás" de siempre; si abrió el
    // link ya con la categoría, no hay grilla atrás: se reemplaza.
    if (vieneDeLaGrilla.current) {
      vieneDeLaGrilla.current = false;
      router.history.back();
      return;
    }
    void navigate({
      to: ".",
      search: (s: Record<string, unknown>) => s,
      hash: "",
      replace: true,
    } as never);
  };

  // La categoría que se está viendo, marcada en el carrusel. En un menú largo,
  // scrolleando con el pulgar, es la forma de saber dónde estás.
  const [activa, setActiva] = useState<string | null>(abierta);
  const enLista = !!abierta && !resultados;

  // El scroll pedido, después del cuadro para no pelearse con la restauración
  // del router. Se da por hecho recién cuando corrió: si el cuadro se cancela,
  // el próximo render lo vuelve a intentar.
  useEffect(() => {
    const destino = scrollPendiente.current;
    if (!destino || (destino !== "arriba" && !enLista)) return;
    const cuadro = requestAnimationFrame(() => {
      scrollPendiente.current = null;
      if (destino === "arriba") window.scrollTo({ top: 0 });
      else document.getElementById(destino.a)?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(cuadro);
  }, [abierta, enLista]);

  // Mientras el carrusel lleva a una categoría con scroll suave, la página pasa
  // por las del medio: no se marcan, o el carrusel parpadea.
  const saltando = useRef<number | null>(null);
  useEffect(() => () => window.clearTimeout(saltando.current ?? undefined), []);

  useEffect(() => {
    if (!enLista) return;
    // Una sección cuenta como "la que se ve" cuando cruza una franja justo
    // debajo del carrusel.
    const obs = new IntersectionObserver(
      (entradas) => {
        if (saltando.current !== null) return;
        const visible = entradas.find((e) => e.isIntersecting);
        if (visible) setActiva(visible.target.id);
      },
      { rootMargin: `-${ALTO_TAPADO}px 0px -60% 0px` },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [ids, enLista]);

  const irA = (id: string) => {
    setActiva(id);
    window.clearTimeout(saltando.current ?? undefined);
    saltando.current = window.setTimeout(() => (saltando.current = null), 900);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Al empezar a buscar, los resultados arrancan arriba; al dejar de buscar,
  // vuelve a la categoría donde estaba.
  const cambiarBusqueda = (texto: string) => {
    const antes = !!busqueda.trim();
    const ahora = !!texto.trim();
    setBusqueda(texto);
    if (!antes && ahora) window.scrollTo({ top: 0 });
    if (antes && !ahora) {
      const donde = activa ?? abierta;
      scrollPendiente.current = donde && abierta ? { a: donde } : "arriba";
    }
  };

  const vacio = bloques.length === 0;

  return (
    <SoloVer.Provider value={soloVer}>
      <div className="relative flex min-h-svh flex-col bg-background">
        {/* Luces del color de la marca, como en la portada de la empresa. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          style={{ "--portada-acento": accent } as React.CSSProperties}
        >
          <div className="portada-grilla" />
          <div className="portada-luz -left-24 -top-24 h-72 w-72" />
          <div className="portada-luz portada-luz-2 -right-20 top-1/2 h-64 w-64" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col">
          {canal.tipo === "online" ? (
            <OnlineHeader
              empresa={canal.empresa}
              local={canal.local}
              name={menu.name}
              sucursal={menu.locationName}
              logoUrl={menu.logoUrl}
              minimoLabel={minimo > 0 ? `Mínimo ${formatPrice(minimo)}` : undefined}
              onCambiarSucursal={
                menu.sucursalesOnline > 1 ? () => setCambiandoSucursal(true) : undefined
              }
            />
          ) : (
            <MesaHeader
              token={canal.token}
              name={menu.name}
              sucursal={menu.locationName}
              logoUrl={menu.logoUrl}
              mesa={canal.numero}
              accent={accent}
              onInicio={canal.onInicio}
            />
          )}

          {canal.tipo === "mesa" ? null : canal.soloVer ? (
            <div className="mx-auto mt-3 flex w-full max-w-2xl items-center gap-3 px-4">
              <p className="flex flex-1 items-center gap-1.5 text-sm text-muted-foreground">
                <Eye className="h-4 w-4 shrink-0" /> Estás viendo el menú
              </p>
              {/* Con varias sucursales vuelve a elegir envío o retiro: la que le
                  lleva puede no ser la que estaba mirando. */}
              {menu.sucursalesOnline > 1 ? (
                <Link
                  to="/p/$empresa"
                  params={{ empresa: canal.empresa }}
                  className="shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white"
                  style={{ background: accent }}
                >
                  Pedir online
                </Link>
              ) : (
                <Link
                  to="/p/$empresa/$local"
                  params={{ empresa: canal.empresa, local: canal.local }}
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

          <div className="mx-auto w-full max-w-2xl px-4 pt-4">
            {!horario.abierto && !soloVer && (
              <div className="mb-4 flex items-start gap-3 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
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
            {(!abierta || ids.length <= 1) &&
              cantidad === 0 &&
              canal.tipo === "online" &&
              !soloVer && (
                <RepetirPedido
                  cartKey={cartKey}
                  menu={menu}
                  empresa={canal.empresa}
                  local={canal.local}
                />
              )}
            {!vacio && (
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={busqueda}
                  onChange={(e) => cambiarBusqueda(e.target.value)}
                  placeholder="Buscar: roquefort, palta, 21…"
                  aria-label="Buscar en el menú"
                  enterKeyHint="search"
                  className="h-12 w-full rounded-full border border-border bg-card/60 pl-10 pr-11 text-base outline-none focus:border-primary"
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => cambiarBusqueda("")}
                    aria-label="Borrar búsqueda"
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
            )}
          </div>

          {/* Hijo directo de la columna alta: dentro de otro div, el sticky solo
              se movería dentro de él y no quedaría pegado. */}
          {enLista && ids.length > 1 && (
            <CarruselCategorias
              className="mt-3"
              categorias={bloques}
              activa={activa ?? abierta}
              accent={accent}
              onElegir={irA}
              onVolver={volver}
            />
          )}

          <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-4">
            {/* Todo apagado o agotado: una pantalla en blanco parece un error. */}
            {vacio ? (
              <div className="mt-6 rounded-3xl border border-border bg-card/60 p-6 text-center">
                <h2 className="font-display text-3xl">Por ahora no hay nada disponible</h2>
                <p className="mt-2 text-muted-foreground">
                  Se nos terminó lo que teníamos para hoy. Volvé a mirar en un rato.
                </p>
              </div>
            ) : resultados ? (
              <Resultados
                resultados={resultados}
                busqueda={busqueda.trim()}
                cartKey={cartKey}
                accent={accent}
              />
            ) : !abierta ? (
              <div key="grilla" className="aparece">
                <GrillaCategorias categorias={bloques} accent={accent} onAbrir={abrir} />
              </div>
            ) : (
              <div key="lista" className="entra-vista">
                {bloques.map((b, idx) => (
                  <Fragment key={b.id}>
                    {idx > 0 && (
                      <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                        <span className="h-px flex-1 bg-border" />
                        Sigue: {b.nombre}
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <section id={b.id} className="scroll-mt-40 pb-2">
                      <TituloSeccion nombre={b.nombre} accent={accent} />
                      {/* La misma bajada en varias categorías seguidas (las de miga)
                        se lee una vez: repetida cinco veces era un muro de texto. */}
                      {b.tipo === "categoria" &&
                        b.categoria.tagline &&
                        b.categoria.tagline !== tagline(bloques[idx - 1]) && (
                          <Bajada
                            texto={b.categoria.tagline}
                            regalo={b.productos.some((p) => p.regalo)}
                            accent={accent}
                          />
                        )}
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        {b.tipo === "combos"
                          ? menu.combos.map((c, i) => (
                              <TarjetaCombo
                                key={c.id}
                                combo={c}
                                cartKey={cartKey}
                                accent={accent}
                                indice={i}
                              />
                            ))
                          : b.productos.map((p, i) => (
                              <TarjetaProducto
                                key={p.id}
                                producto={p}
                                cartKey={cartKey}
                                accent={accent}
                                indice={i}
                              />
                            ))}
                      </div>
                    </section>
                  </Fragment>
                ))}
              </div>
            )}
          </main>

          {cantidad > 0 && !soloVer && (
            <div className="sube-barra fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/90 to-transparent p-4 pt-6">
              {/* Ya ganó sándwiches de regalo y no los eligió: se le recuerda acá,
                  que es donde está mirando mientras arma el pedido. */}
              {regalo.pendientes > 0 && (
                <p className="mx-auto mb-2 flex w-full max-w-2xl items-center justify-center gap-1.5 text-sm font-bold text-emerald-400">
                  <Gift className="h-4 w-4" />
                  Te {regalo.pendientes === 1 ? "corresponde" : "corresponden"} {regalo.pendientes}{" "}
                  de regalo: elegilos y no te los cobramos
                </p>
              )}
              <IrAlPedido
                canal={canal}
                key={cantidad}
                className="latido mx-auto flex h-14 w-full max-w-2xl items-center justify-between rounded-2xl px-5 font-bold text-white transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: accent, boxShadow: `0 12px 30px -10px ${accent}` }}
              >
                <span className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Ver mi pedido · {cantidad}
                </span>
                <span className="font-display text-2xl leading-none">{formatPrice(total)}</span>
              </IrAlPedido>
            </div>
          )}
        </div>
      </div>
      {canal.tipo === "online" && menu.sucursalesOnline > 1 && (
        <HojaSucursales
          abierta={cambiandoSucursal}
          onAbierta={setCambiandoSucursal}
          empresa={canal.empresa}
          actual={canal.local}
          soloVer={canal.soloVer}
          marca={{ logoUrl: menu.logoUrl, nombre: menu.name, accent }}
        />
      )}
    </SoloVer.Provider>
  );
}

/** El título de una sección, con una raya del color de la marca que se estira al llegar. */
function TituloSeccion({ nombre, accent }: { nombre: string; accent: string }) {
  const [revelar, visible] = useRevelar<HTMLDivElement>();
  return (
    <div ref={revelar} className={`revela titulo-seccion ${visible ? "visible" : ""}`}>
      <h2 className="font-display text-4xl leading-none">{nombre}</h2>
      <span className="mt-2 block h-1 w-14 rounded-full" style={{ background: accent }} />
    </div>
  );
}

function tagline(b: Bloque | undefined): string | null {
  return b?.tipo === "categoria" ? b.categoria.tagline : null;
}

function Resultados({
  resultados,
  busqueda,
  cartKey,
  accent,
}: {
  resultados: NonNullable<ReturnType<typeof buscarEnMenu>>;
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
      <div className="grid gap-4 sm:grid-cols-2">
        {resultados.combos.map((c, i) => (
          <TarjetaCombo key={`c${c.id}`} combo={c} cartKey={cartKey} accent={accent} indice={i} />
        ))}
        {resultados.productos.map((p, i) => (
          <TarjetaProducto
            key={`p${p.id}`}
            producto={p}
            cartKey={cartKey}
            accent={accent}
            indice={resultados.combos.length + i}
          />
        ))}
      </div>
    </section>
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

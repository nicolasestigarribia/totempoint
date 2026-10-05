import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Minus,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Bike,
  Store,
  Banknote,
  Smartphone,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { createOnlineOrder, type TotemProduct } from "@/lib/api/totem.functions";
import { MAX_POR_LINEA, PRECIOS_CAMBIARON } from "@/lib/pedido-reglas";
import { getOnlineMenuCached, onlineCartKey, olvidarMenuOnline } from "@/lib/online-menu-cache";
import { OnlineError } from "@/components/online/OnlineError";
import { TotemPersonalizar } from "@/components/totem/TotemPersonalizar";
import { OnlineHeader } from "@/components/online/OnlineHeader";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { DireccionEntrega, type Destino } from "@/components/online/DireccionEntrega";
import { cotizarEnvio, distanciaKm } from "@/lib/delivery";
import {
  useTotemCart,
  useCartForSlug,
  useRepriceCart,
  cartTotal,
  precioLinea,
  formatPrice,
  itemKey,
} from "@/lib/totem-cart";
import { mensajeDeError } from "@/lib/error-message";

export const Route = createFileRoute("/p/$empresa/$local/carrito")({
  loader: ({ params }) => getOnlineMenuCached(params.empresa, params.local),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Tu pedido — ${loaderData.name}` : "Tu pedido" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  errorComponent: ({ error }) => <OnlineError message={error.message} />,
  component: CarritoOnlinePage,
});

type Entrega = "mostrador" | "envio";
type Pago = "efectivo" | "mercadopago";

/**
 * Los datos del cliente quedan en su celular para la próxima vez: el que pide
 * todos los días desde la playa no tiene por qué escribir su nombre, su
 * teléfono y su parador cada vez. No viajan a ningún lado más que al pedido.
 */
const CLAVE_CLIENTE = "pedido-online-cliente";

interface DatosGuardados {
  nombre?: string;
  telefono?: string;
  /** La última dirección de entrega, con su punto en el mapa. */
  destino?: Destino;
}

function leerCliente(): DatosGuardados {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CLIENTE) ?? "{}") as DatosGuardados;
  } catch {
    return {};
  }
}

function guardarCliente(d: DatosGuardados) {
  try {
    localStorage.setItem(CLAVE_CLIENTE, JSON.stringify(d));
  } catch {
    // Sin almacenamiento (modo incógnito): la próxima vez los vuelve a escribir.
  }
}

/**
 * El último pedido que hizo este celular en esta sucursal. Sirve para el caso
 * en que el cliente sale de la página de Mercado Pago con "atrás": vuelve a
 * "Tu pedido" con el carrito ya vacío, y tiene que poder llegar a su pedido en
 * vez de encontrarse con "no agregaste nada".
 */
const CLAVE_ULTIMO = "pedido-online-ultimo";
/** Pasado este tiempo, el pedido anterior ya no se ofrece: es de otra comida. */
const VIGENCIA_ULTIMO_MS = 3 * 60 * 60 * 1000;

interface UltimoPedido {
  sucursal: string;
  token: string;
  hecho: number;
}

function guardarUltimo(u: UltimoPedido) {
  try {
    localStorage.setItem(CLAVE_ULTIMO, JSON.stringify(u));
  } catch {
    // Sin almacenamiento: el cliente igual tiene el link de seguimiento.
  }
}

function leerUltimo(sucursal: string): UltimoPedido | null {
  try {
    const u = JSON.parse(localStorage.getItem(CLAVE_ULTIMO) ?? "null") as UltimoPedido | null;
    if (!u || u.sucursal !== sucursal || Date.now() - u.hecho > VIGENCIA_ULTIMO_MS) return null;
    return u;
  } catch {
    return null;
  }
}

function CarritoOnlinePage() {
  const menu = Route.useLoaderData();
  const { empresa, local } = Route.useParams();
  const cartKey = onlineCartKey(empresa, local);
  useRepriceCart(cartKey, menu.products, menu.combos);
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
  const accent = menu.accentColor || "var(--primary)";
  const navigate = useNavigate();
  const router = useRouter();
  const placeOrder = useServerFn(createOnlineOrder);

  const items = useCartForSlug(cartKey);
  const add = useTotemCart((s) => s.add);
  const removeOne = useTotemCart((s) => s.removeOne);
  const removeAll = useTotemCart((s) => s.removeAll);
  const setLineChanges = useTotemCart((s) => s.setLineChanges);
  const clear = useTotemCart((s) => s.clear);

  const productosPorId = useMemo(
    () => new Map(menu.products.map((p) => [p.id, p])),
    [menu.products],
  );
  // Lo que quedó en el carrito pero ya no está en el menú: el dueño lo apagó o
  // lo sacó mientras el cliente compraba (el carrito vive en el celular). Se
  // marca en la lista y no deja enviar hasta sacarlo, en vez de descubrirlo
  // recién con un error al final.
  const combosIds = useMemo(() => new Set(menu.combos.map((c) => c.id)), [menu.combos]);
  const noDisponible = (i: { kind: string; refId: number }) =>
    i.kind === "producto" ? !productosPorId.has(i.refId) : !combosIds.has(i.refId);
  const hayNoDisponibles = items.some(noDisponible);

  const [editando, setEditando] = useState<{
    clave: string;
    producto: TotemProduct;
    inicialesSacados: number[];
    inicialesExtras: Record<number, number>;
  } | null>(null);

  // Envío primero si lo hacen: es el motivo por el que la mayoría pide online.
  const [entrega, setEntrega] = useState<Entrega>(menu.delivery ? "envio" : "mostrador");
  const [destino, setDestino] = useState<Destino | null>(null);
  const [anterior, setAnterior] = useState<Destino | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pago, setPago] = useState<Pago>(menu.mercadoPago ? "mercadopago" : "efectivo");
  const [pagaCon, setPagaCon] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [enviando, setEnviando] = useState(false);
  // El pedido ya está tomado y el cliente va camino a pagar a Mercado Pago.
  // Mientras esa página carga, esta no puede mostrar el carrito vacío.
  const [aPagar, setAPagar] = useState<{ url: string; token: string } | null>(null);
  const [ultimo, setUltimo] = useState<UltimoPedido | null>(null);

  // Se lee después de montar: en el servidor no hay localStorage.
  useEffect(() => {
    const d = leerCliente();
    if (d.nombre) setNombre(d.nombre);
    if (d.telefono) setTelefono(d.telefono);
    if (d.destino) setAnterior(d.destino);
    setUltimo(leerUltimo(cartKey));
  }, [cartKey]);

  const subtotal = cartTotal(items);
  // El costo que ve el cliente; el servidor lo vuelve a calcular y es el que vale.
  const cotizacion =
    entrega === "envio" && destino && menu.origin
      ? cotizarEnvio(menu.tiers, distanciaKm(menu.origin, destino))
      : null;
  const envio = cotizacion?.llega ? cotizacion.precio : 0;
  const total = subtotal + envio;
  const minimo = Number(menu.minOrder);
  const faltaParaMinimo = minimo > 0 && subtotal < minimo ? minimo - subtotal : 0;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    if (hayNoDisponibles) {
      toast.error("Hay cosas en tu pedido que ya no están a la venta: sacalas para seguir");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (entrega === "envio" && !destino) {
      toast.error("Buscá tu dirección o marcala en el mapa");
      // Lo lleva hasta donde falta: el aviso solo, abajo, no dice dónde.
      document.getElementById("bloque-direccion")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }
    if (cotizacion && !cotizacion.llega) {
      toast.error("No llegamos hasta esa dirección. Podés elegir retirarlo.");
      return;
    }
    if (faltaParaMinimo > 0) {
      toast.error(`Te faltan ${formatPrice(faltaParaMinimo)} para el pedido mínimo`);
      return;
    }
    const pagaConNumero = pagaCon ? Number(pagaCon) : undefined;
    if (pago === "efectivo" && pagaConNumero !== undefined && pagaConNumero < total) {
      toast.error(
        `Con ${formatPrice(pagaConNumero)} no alcanza: el total es ${formatPrice(total)}`,
      );
      return;
    }

    setEnviando(true);
    guardarCliente({
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      destino: entrega === "envio" && destino ? destino : leerCliente().destino,
    });
    try {
      const r = await placeOrder({
        data: {
          empresa,
          local,
          customerName: nombre,
          phone: telefono,
          deliveryMethod: entrega,
          address: entrega === "envio" ? destino?.address : undefined,
          details: entrega === "envio" ? destino?.details || undefined : undefined,
          lat: entrega === "envio" ? destino?.lat : undefined,
          lng: entrega === "envio" ? destino?.lng : undefined,
          paymentMethod: pago,
          paysWith: pago === "efectivo" ? pagaConNumero : undefined,
          comments: comentarios.trim() || undefined,
          items: items.map((i) => ({
            kind: i.kind,
            id: i.refId,
            quantity: i.quantity,
            removedIngredientIds: i.removed.map((r) => r.id),
            extras: i.extras.map((x) => ({ id: x.id, quantity: x.quantity })),
          })),
          totalEsperado: total,
        },
      });
      guardarUltimo({ sucursal: cartKey, token: r.trackingToken, hecho: Date.now() });
      // Con Mercado Pago se paga en la página de Mercado Pago, que al terminar
      // vuelve a la de seguimiento. Si el cliente la abandona, el seguimiento
      // le vuelve a ofrecer el pago. Primero se muestra que vamos para allá y
      // recién después se vacía el carrito: al revés, mientras Mercado Pago
      // carga, el cliente veía "Todavía no agregaste nada".
      if (r.pagarEn) {
        setAPagar({ url: r.pagarEn, token: r.trackingToken });
        clear();
        window.location.assign(r.pagarEn);
        return;
      }
      clear();
      navigate({
        to: "/p/$empresa/$local/pedido/$token",
        params: { empresa, local, token: r.trackingToken },
        replace: true,
      });
    } catch (err) {
      const mensaje = mensajeDeError(err, "No se pudo enviar el pedido");
      toast.error(mensaje, { duration: 8000 });
      setEnviando(false);
      // Cambió algo del menú mientras armaba el pedido: se trae el menú nuevo,
      // así el carrito muestra los precios de ahora y marca lo que ya no hay.
      if (mensaje === PRECIOS_CAMBIARON || /ya no está a la venta|Ahora no hay/.test(mensaje)) {
        olvidarMenuOnline();
        void router.invalidate();
      }
    }
  };

  if (aPagar) {
    return (
      <div className="flex min-h-svh flex-col bg-background">
        <OnlineHeader
          empresa={empresa}
          local={local}
          name={menu.name}
          sucursal={menu.locationName}
          logoUrl={menu.logoUrl}
        />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: accent }} />
          <p className="font-display text-3xl">Te llevamos a Mercado Pago</p>
          <p className="text-muted-foreground">
            Tu pedido ya está anotado. Pagá ahí y volvés solo a ver cuándo lo tenés.
          </p>
          <a
            href={aPagar.url}
            className="mt-2 flex h-12 w-full max-w-xs items-center justify-center rounded-2xl font-bold text-white"
            style={{ background: accent }}
          >
            Ir a pagar
          </a>
          <Link
            to="/p/$empresa/$local/pedido/$token"
            params={{ empresa, local, token: aPagar.token }}
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            Ver mi pedido
          </Link>
        </main>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-svh flex-col bg-background">
        <OnlineHeader
          empresa={empresa}
          local={local}
          name={menu.name}
          sucursal={menu.locationName}
          logoUrl={menu.logoUrl}
          volver="Volver al menú"
        />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          {/* Volvió de Mercado Pago con "atrás", o entró de nuevo después de
              pedir: su pedido existe, y es lo primero que tiene que ver. */}
          {ultimo ? (
            <>
              <p className="font-display text-3xl">Ya hiciste tu pedido</p>
              <p className="text-muted-foreground">
                Fijate cómo va, o si te faltó pagarlo con Mercado Pago.
              </p>
              <Link
                to="/p/$empresa/$local/pedido/$token"
                params={{ empresa, local, token: ultimo.token }}
                className="rounded-2xl px-6 py-3 font-bold text-white"
                style={{ background: accent }}
              >
                Ver mi pedido
              </Link>
              <Link
                to="/p/$empresa/$local"
                params={{ empresa, local }}
                className="text-sm text-muted-foreground underline underline-offset-4"
              >
                Hacer otro pedido
              </Link>
            </>
          ) : (
            <>
              <p className="text-lg text-muted-foreground">Todavía no agregaste nada</p>
              <Link
                to="/p/$empresa/$local"
                params={{ empresa, local }}
                className="rounded-2xl px-6 py-3 font-bold text-white"
                style={{ background: accent }}
              >
                Ver el menú
              </Link>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <OnlineHeader
        empresa={empresa}
        local={local}
        name={menu.name}
        sucursal={menu.locationName}
        logoUrl={menu.logoUrl}
        volver="Volver al menú"
      />

      <form onSubmit={enviar} className="mx-auto w-full max-w-2xl flex-1 px-4 pb-40 pt-4">
        <h1 className="font-display text-4xl">Tu pedido</h1>

        <ul className="mt-4 space-y-3">
          {items.map((i) => {
            const clave = itemKey(i.kind, i.refId, i.removed, i.extras);
            const prod = i.kind === "producto" ? productosPorId.get(i.refId) : undefined;
            const editable = !!prod && (prod.removables.length > 0 || prod.extras.length > 0);
            const agotado = noDisponible(i);
            return (
              <li
                key={clave}
                className={`rounded-2xl border bg-card/40 p-3 ${
                  agotado ? "border-destructive/60" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`font-bold leading-tight ${agotado ? "line-through opacity-60" : ""}`}
                    >
                      {i.name}
                    </p>
                    {agotado && (
                      <p className="text-sm font-bold text-destructive">
                        Ya no está a la venta: sacalo para seguir
                      </p>
                    )}
                    {i.removed.length > 0 && (
                      <p className="text-sm text-amber-400">
                        {i.removed.map((r) => `sin ${r.name}`).join(", ")}
                      </p>
                    )}
                    {i.extras.length > 0 && (
                      <p className="text-sm text-emerald-400">
                        {i.extras.map((x) => `+${x.quantity} ${x.name}`).join(", ")}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(precioLinea(i))} c/u
                    </p>
                  </div>
                  <span className="shrink-0 font-bold">
                    {formatPrice(precioLinea(i) * i.quantity)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Quitar uno"
                    onClick={() => removeOne(clave)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-bold">{i.quantity}</span>
                  <button
                    type="button"
                    aria-label="Agregar uno"
                    disabled={i.quantity >= MAX_POR_LINEA}
                    onClick={() =>
                      add(cartKey, {
                        kind: i.kind,
                        refId: i.refId,
                        name: i.name,
                        price: i.price,
                        photoUrl: i.photoUrl,
                        removed: i.removed,
                        extras: i.extras,
                      })
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    {editable && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditando({
                            clave,
                            producto: prod!,
                            inicialesSacados: i.removed.map((r) => r.id),
                            inicialesExtras: Object.fromEntries(
                              i.extras.map((x) => [x.id, x.quantity]),
                            ),
                          })
                        }
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm"
                      >
                        <Pencil className="h-4 w-4" /> Cambiar
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Sacar del pedido"
                      onClick={() => removeAll(clave)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-destructive text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <Link
          to="/p/$empresa/$local"
          params={{ empresa, local }}
          className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground"
        >
          <Plus className="h-4 w-4" /> Agregar algo más
        </Link>

        {/* ¿Cómo lo querés? */}
        <Bloque titulo="¿Cómo lo querés?">
          <div className="grid grid-cols-2 gap-2">
            {menu.delivery && (
              <Opcion
                activa={entrega === "envio"}
                accent={accent}
                onClick={() => setEntrega("envio")}
                icono={Bike}
                titulo="Envío"
              />
            )}
            {menu.pickup && (
              <Opcion
                activa={entrega === "mostrador"}
                accent={accent}
                onClick={() => setEntrega("mostrador")}
                icono={Store}
                titulo="Retiro"
              />
            )}
          </div>

          {entrega === "mostrador" && menu.locationAddress && (
            <p className="mt-2 text-sm text-muted-foreground">
              Lo retirás en {menu.locationAddress}.
            </p>
          )}

          {entrega === "envio" && menu.origin && (
            <div id="bloque-direccion" className="mt-4 scroll-mt-24">
              <p className="mb-2 text-sm font-bold">¿A dónde te lo llevamos?</p>
              <DireccionEntrega
                origen={menu.origin}
                tramos={menu.tiers}
                destino={destino}
                anterior={anterior}
                onCambiar={setDestino}
                accent={accent}
              />
            </div>
          )}
        </Bloque>

        <Bloque titulo="Tus datos">
          <div className="space-y-3">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              maxLength={120}
              autoComplete="name"
              placeholder="Tu nombre"
              className="h-12 w-full rounded-xl border border-border bg-card/40 px-4 outline-none focus:border-primary"
            />
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
              type="tel"
              inputMode="tel"
              maxLength={40}
              autoComplete="tel"
              placeholder="Tu teléfono (por si hay que llamarte)"
              className="h-12 w-full rounded-xl border border-border bg-card/40 px-4 outline-none focus:border-primary"
            />
          </div>
        </Bloque>

        <Bloque titulo="¿Cómo pagás?">
          <div className="grid grid-cols-2 gap-2">
            {menu.mercadoPago && (
              <Opcion
                activa={pago === "mercadopago"}
                accent={accent}
                onClick={() => setPago("mercadopago")}
                icono={Smartphone}
                titulo="Mercado Pago"
              />
            )}
            {menu.cash && (
              <Opcion
                activa={pago === "efectivo"}
                accent={accent}
                onClick={() => setPago("efectivo")}
                icono={Banknote}
                titulo="Efectivo"
              />
            )}
          </div>
          {pago === "mercadopago" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Al enviar el pedido pagás desde tu celular con Mercado Pago.
            </p>
          )}
          {pago === "efectivo" && (
            <div className="mt-3">
              <label htmlFor="paga-con" className="mb-2 block text-sm font-bold">
                ¿Con cuánto pagás? <span className="text-muted-foreground">(para el vuelto)</span>
              </label>
              <input
                id="paga-con"
                type="number"
                inputMode="numeric"
                min={0}
                value={pagaCon}
                onChange={(e) => setPagaCon(e.target.value)}
                placeholder={`Justo, ${formatPrice(total)}`}
                className="h-12 w-full rounded-xl border border-border bg-card/40 px-4 outline-none focus:border-primary"
              />
            </div>
          )}
        </Bloque>

        <Bloque titulo="¿Algo más?">
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Aclaraciones para el pedido (opcional)"
            className="w-full rounded-xl border border-border bg-card/40 p-3 outline-none focus:border-primary"
          />
        </Bloque>

        {/* Total y botón fijos abajo: lo último que hay que hacer en la
            pantalla no puede quedar debajo del pliegue. */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-4 py-3">
          <div className="mx-auto w-full max-w-2xl">
            <div className="mb-2 space-y-0.5 text-sm">
              {envio > 0 && (
                <>
                  <Fila label="Productos" valor={formatPrice(subtotal)} />
                  <Fila label="Envío" valor={formatPrice(envio)} />
                </>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold">
                  Total
                  {/* Sin dirección todavía no hay costo de envío: que el
                      total no parezca el final. */}
                  {entrega === "envio" && !cotizacion && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      + envío según tu dirección
                    </span>
                  )}
                </span>
                <span className="font-display text-3xl" style={{ color: accent }}>
                  {formatPrice(total)}
                </span>
              </div>
              {faltaParaMinimo > 0 && (
                <p className="text-amber-400">
                  El mínimo es {formatPrice(minimo)}: te faltan {formatPrice(faltaParaMinimo)}.
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={enviando || faltaParaMinimo > 0 || hayNoDisponibles}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold text-white disabled:opacity-50"
              style={{ background: accent }}
            >
              {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
              {pago === "mercadopago" ? "Enviar y pagar" : "Enviar pedido"}
            </button>
          </div>
        </div>
      </form>

      {editando && (
        <TotemPersonalizar
          producto={editando.producto}
          accent={accent}
          inicialesSacados={editando.inicialesSacados}
          inicialesExtras={editando.inicialesExtras}
          ctaLabel="Guardar"
          compacto
          onCancel={() => setEditando(null)}
          onConfirm={({ sacados, extras }) => {
            setLineChanges(
              cartKey,
              editando.clave,
              sacados,
              extras.map((x) => ({ id: x.id, name: x.name, price: x.price, quantity: x.quantity })),
            );
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 font-display text-2xl">{titulo}</h2>
      {children}
    </section>
  );
}

function Opcion({
  activa,
  accent,
  onClick,
  icono: Icono,
  titulo,
}: {
  activa: boolean;
  accent: string;
  onClick: () => void;
  icono: typeof Bike;
  titulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`flex h-14 items-center justify-center gap-2 rounded-xl border font-bold transition ${
        activa ? "border-transparent text-white" : "border-border"
      }`}
      style={activa ? { background: accent } : undefined}
    >
      <Icono className="h-5 w-5" />
      {titulo}
    </button>
  );
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span>{valor}</span>
    </div>
  );
}

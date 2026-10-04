import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  LocateFixed,
  CheckCircle2,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { createOnlineOrder, type TotemProduct } from "@/lib/api/totem.functions";
import { getOnlineMenuCached, onlineCartKey } from "@/lib/online-menu-cache";
import { OnlineError } from "@/components/online/OnlineError";
import { TotemPersonalizar } from "@/components/totem/TotemPersonalizar";
import { OnlineHeader } from "@/components/online/OnlineHeader";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
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
  direccion?: string;
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

type Ubicacion =
  | { estado: "nada" }
  | { estado: "buscando" }
  | { estado: "lista"; lat: number; lng: number }
  | { estado: "error"; motivo: string };

function CarritoOnlinePage() {
  const menu = Route.useLoaderData();
  const { empresa, local } = Route.useParams();
  const cartKey = onlineCartKey(empresa, local);
  useRepriceCart(cartKey, menu.products, menu.combos);
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
  const accent = menu.accentColor || "var(--primary)";
  const navigate = useNavigate();
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
  const [editando, setEditando] = useState<{
    clave: string;
    producto: TotemProduct;
    inicialesSacados: number[];
    inicialesExtras: Record<number, number>;
  } | null>(null);

  // Envío primero si lo hacen: es el motivo por el que la mayoría pide online.
  const [entrega, setEntrega] = useState<Entrega>(menu.delivery ? "envio" : "mostrador");
  const [zonaId, setZonaId] = useState<number | null>(
    menu.zones.length === 1 ? menu.zones[0].id : null,
  );
  const [direccion, setDireccion] = useState("");
  const [ubicacion, setUbicacion] = useState<Ubicacion>({ estado: "nada" });
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pago, setPago] = useState<Pago>(menu.mercadoPago ? "mercadopago" : "efectivo");
  const [pagaCon, setPagaCon] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Se lee después de montar: en el servidor no hay localStorage.
  useEffect(() => {
    const d = leerCliente();
    if (d.nombre) setNombre(d.nombre);
    if (d.telefono) setTelefono(d.telefono);
    if (d.direccion) setDireccion(d.direccion);
  }, []);

  const subtotal = cartTotal(items);
  const zona = menu.zones.find((z) => z.id === zonaId) ?? null;
  const envio = entrega === "envio" && zona ? Number(zona.price) : 0;
  const total = subtotal + envio;
  const minimo = Number(menu.minOrder);
  const faltaParaMinimo = minimo > 0 && subtotal < minimo ? minimo - subtotal : 0;

  const pedirUbicacion = () => {
    if (!("geolocation" in navigator)) {
      setUbicacion({ estado: "error", motivo: "Tu celular no permite compartir la ubicación" });
      return;
    }
    setUbicacion({ estado: "buscando" });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUbicacion({ estado: "lista", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () =>
        setUbicacion({
          estado: "error",
          motivo: "No pudimos tomar tu ubicación. Escribí bien dónde estás y listo.",
        }),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    if (entrega === "envio" && !zona) {
      toast.error("Elegí a qué zona te lo llevamos");
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
      direccion: entrega === "envio" ? direccion.trim() : leerCliente().direccion,
    });
    try {
      const r = await placeOrder({
        data: {
          empresa,
          local,
          customerName: nombre,
          phone: telefono,
          deliveryMethod: entrega,
          zoneId: entrega === "envio" ? (zona?.id ?? undefined) : undefined,
          address: entrega === "envio" ? direccion : undefined,
          lat: entrega === "envio" && ubicacion.estado === "lista" ? ubicacion.lat : undefined,
          lng: entrega === "envio" && ubicacion.estado === "lista" ? ubicacion.lng : undefined,
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
        },
      });
      clear();
      // Con Mercado Pago se paga en la página de Mercado Pago, que al terminar
      // vuelve a la de seguimiento. Si el cliente la abandona, el seguimiento
      // le vuelve a ofrecer el pago.
      if (r.pagarEn) {
        window.location.href = r.pagarEn;
        return;
      }
      navigate({
        to: "/p/$empresa/$local/pedido/$token",
        params: { empresa, local, token: r.trackingToken },
        replace: true,
      });
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo enviar el pedido"));
      setEnviando(false);
    }
  };

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
          <p className="text-lg text-muted-foreground">Todavía no agregaste nada</p>
          <Link
            to="/p/$empresa/$local"
            params={{ empresa, local }}
            className="rounded-2xl px-6 py-3 font-bold text-white"
            style={{ background: accent }}
          >
            Ver el menú
          </Link>
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
            return (
              <li key={clave} className="rounded-2xl border border-border bg-card/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold leading-tight">{i.name}</p>
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
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"
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

          {entrega === "envio" && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-sm font-bold">¿A qué zona?</p>
                <div className="space-y-2">
                  {menu.zones.map((z) => (
                    <label
                      key={z.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${
                        zonaId === z.id ? "border-transparent text-white" : "border-border"
                      }`}
                      style={zonaId === z.id ? { background: accent } : undefined}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="zona"
                          className="sr-only"
                          checked={zonaId === z.id}
                          onChange={() => setZonaId(z.id)}
                        />
                        {z.name}
                      </span>
                      <span className="font-bold">
                        {Number(z.price) > 0 ? formatPrice(z.price) : "Gratis"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="direccion" className="mb-2 block text-sm font-bold">
                  ¿Dónde estás?
                </label>
                <textarea
                  id="direccion"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  required
                  minLength={3}
                  maxLength={255}
                  rows={2}
                  placeholder="Dirección, o en la playa: parador, bajada, color de la sombrilla…"
                  className="w-full rounded-xl border border-border bg-card/40 p-3 outline-none focus:border-primary"
                />
                {/* La ubicación del celular ayuda al repartidor, sobre todo en
                    la playa, donde no hay dirección. Es opcional: lo escrito
                    alcanza. */}
                <button
                  type="button"
                  onClick={pedirUbicacion}
                  disabled={ubicacion.estado === "buscando"}
                  className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold"
                >
                  {ubicacion.estado === "buscando" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : ubicacion.estado === "lista" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <LocateFixed className="h-4 w-4" />
                  )}
                  {ubicacion.estado === "lista"
                    ? "Ubicación compartida"
                    : "Compartir mi ubicación (opcional)"}
                </button>
                {ubicacion.estado === "error" && (
                  <p className="mt-1 text-sm text-amber-400">{ubicacion.motivo}</p>
                )}
              </div>
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
                  <Fila label={`Envío · ${zona?.name}`} valor={formatPrice(envio)} />
                </>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold">Total</span>
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
              disabled={enviando || faltaParaMinimo > 0}
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

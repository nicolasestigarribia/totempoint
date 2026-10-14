import { useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, Banknote, Smartphone, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { createMesaOrder } from "@/lib/api/totem.functions";
import { PRECIOS_CAMBIARON } from "@/lib/pedido-reglas";
import { getMesaMenuCached, mesaCartKey, olvidarMenuOnline } from "@/lib/online-menu-cache";
import { OnlineError } from "@/components/online/OnlineError";
import { MesaHeader } from "@/components/mesa/MesaHeader";
import { AvisoRegalo } from "@/components/totem/AvisoRegalo";
import { Bloque, LineasCarrito, Opcion } from "@/components/online/CarritoPartes";
import { lineaNoDisponible } from "@/lib/linea-disponible";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import {
  useTotemCart,
  useCartForSlug,
  useCarritoCargado,
  useRepriceCart,
  cartTotal,
  formatPrice,
} from "@/lib/totem-cart";
import { mensajeDeError } from "@/lib/error-message";

export const Route = createFileRoute("/m/$token/carrito")({
  loader: ({ params }) => getMesaMenuCached(params.token),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Tu pedido — Mesa ${loaderData.mesa}` : "Tu pedido" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  errorComponent: ({ error }) => <OnlineError message={error.message} />,
  component: CarritoMesaPage,
});

type Pago = "efectivo" | "mercadopago";

/**
 * "Tu pedido" desde la mesa: lo pedido, cómo paga y nada más. Sin envío,
 * dirección ni teléfono: el mozo lo lleva a la mesa, y si es en efectivo lo
 * cobra ahí. Tampoco pide nombre: la mesa ya dice a quién llevárselo.
 */
function CarritoMesaPage() {
  const menu = Route.useLoaderData();
  const { token } = Route.useParams();
  const cartKey = mesaCartKey(token);
  useRepriceCart(cartKey, menu.products, menu.combos);
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
  const accent = menu.accentColor || "var(--primary)";
  const navigate = useNavigate();
  const router = useRouter();
  const placeOrder = useServerFn(createMesaOrder);

  const items = useCartForSlug(cartKey);
  const carritoCargado = useCarritoCargado();
  const clear = useTotemCart((s) => s.clear);

  const [pago, setPago] = useState<Pago>(menu.mercadoPago ? "mercadopago" : "efectivo");
  const [comentarios, setComentarios] = useState("");
  const [enviando, setEnviando] = useState(false);
  // Ya tomado y yendo a Mercado Pago: mientras carga, no mostrar el carrito vacío.
  const [aPagar, setAPagar] = useState<string | null>(null);

  const total = cartTotal(items);
  const hayNoDisponibles = items.some(lineaNoDisponible(menu));

  const header = (
    <MesaHeader
      token={token}
      name={menu.name}
      sucursal={menu.locationName}
      logoUrl={menu.logoUrl}
      mesa={menu.mesa}
      accent={accent}
      volver="Volver al menú"
    />
  );

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    if (hayNoDisponibles) {
      toast.error("Hay cosas en tu pedido que ya no están a la venta: sacalas para seguir");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setEnviando(true);
    try {
      const r = await placeOrder({
        data: {
          token,
          paymentMethod: pago,
          comments: comentarios.trim() || undefined,
          items: items.map((i) => ({
            kind: i.kind,
            id: i.refId,
            quantity: i.quantity,
            removedIngredientIds: i.removed.map((x) => x.id),
            extras: i.extras.map((x) => ({ id: x.id, quantity: x.quantity })),
            pan: i.pan,
            elecciones: i.elecciones?.map((x) => ({
              grupo: x.grupo,
              productId: x.productId,
              quantity: x.quantity,
            })),
          })),
          totalEsperado: total,
        },
      });
      if (r.pagarEn) {
        setAPagar(r.pagarEn);
        clear();
        window.location.assign(r.pagarEn);
        return;
      }
      clear();
      navigate({
        to: "/m/$token/pedido/$tracking",
        params: { token, tracking: r.trackingToken },
        replace: true,
      });
    } catch (err) {
      const mensaje = mensajeDeError(err, "No se pudo enviar el pedido");
      toast.error(mensaje, { duration: 8000 });
      setEnviando(false);
      if (
        mensaje === PRECIOS_CAMBIARON ||
        /ya no está a la venta|Ahora no hay|No alcanza el stock|Se agotó/.test(mensaje)
      ) {
        olvidarMenuOnline();
        void router.invalidate();
      }
    }
  };

  if (aPagar) {
    return (
      <div className="flex min-h-svh flex-col bg-background">
        {header}
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: accent }} />
          <p className="font-display text-3xl">Te llevamos a Mercado Pago</p>
          <p className="text-muted-foreground">
            Tu pedido ya está anotado. Cuando lo pagues, entra a la cocina.
          </p>
          <a
            href={aPagar}
            className="mt-2 flex h-12 w-full max-w-xs items-center justify-center rounded-2xl font-bold text-white"
            style={{ background: accent }}
          >
            Ir a pagar
          </a>
        </main>
      </div>
    );
  }

  if (!carritoCargado) {
    return <div className="flex min-h-svh flex-col bg-background">{header}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-svh flex-col bg-background">
        {header}
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">Todavía no agregaste nada</p>
          <Link
            to="/m/$token"
            params={{ token }}
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
      {header}

      <form onSubmit={enviar} className="mx-auto w-full max-w-2xl flex-1 px-4 pb-48 pt-4">
        <h1 className="font-display text-4xl">Tu pedido</h1>

        <LineasCarrito cartKey={cartKey} menu={menu} accent={accent} />

        <div className="mt-3">
          <AvisoRegalo items={items} />
        </div>

        <Link
          to="/m/$token"
          params={{ token }}
          className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground"
        >
          <Plus className="h-4 w-4" /> Agregar algo más
        </Link>

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
            <Opcion
              activa={pago === "efectivo"}
              accent={accent}
              onClick={() => setPago("efectivo")}
              icono={Banknote}
              titulo="Efectivo"
            />
          </div>
          {pago === "mercadopago" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Al enviar el pedido pagás desde tu celular, y entra a la cocina apenas se acredita.
            </p>
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

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-4 py-3">
          <div className="mx-auto w-full max-w-2xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold">Total</span>
              <span className="font-display text-3xl" style={{ color: accent }}>
                {formatPrice(total)}
              </span>
            </div>
            <button
              type="submit"
              disabled={enviando || hayNoDisponibles}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold text-white disabled:opacity-50"
              style={{ background: accent }}
            >
              {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
              {pago === "mercadopago" ? "Enviar y pagar" : "Enviar pedido"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

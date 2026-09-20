import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Store, UtensilsCrossed, Banknote, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { getTotemMenu, createTotemOrder } from "@/lib/api/totem.functions";
import { TotemError } from "@/components/totem/TotemError";
import { TotemTopBar } from "@/components/totem/TotemTopBar";
import { useTotemCart, useCartForSlug, cartTotal, formatPrice } from "@/lib/totem-cart";
import { useTotemIdleReset } from "@/lib/use-totem-idle";
import { useTotemTheme } from "@/components/totem/useTotemTheme";

export const Route = createFileRoute("/t/$slug/checkout")({
  loader: ({ params }) => getTotemMenu({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Confirmar — ${loaderData.name}` : "Confirmar" }],
  }),
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  component: CheckoutPage,
});

type Delivery = "local" | "mostrador";
type Pago = "efectivo" | "mercadopago";

function CheckoutPage() {
  const menu = Route.useLoaderData();
  useTotemTheme(menu.accentColor, menu.theme);
  const navigate = useNavigate();
  const accent = menu.accentColor || undefined;
  useTotemIdleReset(menu.slug);

  const items = useCartForSlug(menu.slug);
  const clear = useTotemCart((s) => s.clear);
  const placeOrder = useServerFn(createTotemOrder);

  const [customerName, setCustomerName] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("local");
  const [pago, setPago] = useState<Pago>("efectivo");
  const [comments, setComments] = useState("");
  const [sending, setSending] = useState(false);

  const total = cartTotal(items);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Tu pedido está vacío");
      return;
    }
    setSending(true);
    try {
      const { orderId, pagarEn } = await placeOrder({
        data: {
          slug: menu.slug,
          customerName,
          deliveryMethod: delivery,
          paymentMethod: pago,
          comments: comments.trim() || undefined,
          items: items.map((i) => ({ kind: i.kind, id: i.refId, quantity: i.quantity })),
        },
      });
      clear();
      // Con Mercado Pago el pedido ya existe pero todavía no se cobró: el
      // cliente pasa por el QR. Si algo falló al generarlo, cae igual en la
      // pantalla del número y lo cobran en la caja.
      if (pagarEn) {
        navigate({
          to: "/t/$slug/pagar/$orderId",
          params: { slug: menu.slug, orderId: String(orderId) },
          search: { url: pagarEn },
          replace: true,
        });
        return;
      }
      navigate({
        to: "/t/$slug/listo/$orderId",
        params: { slug: menu.slug, orderId: String(orderId) },
        replace: true,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el pedido");
      setSending(false);
    }
  };

  const options: { value: Delivery; label: string; icon: typeof Store }[] = [
    { value: "local", label: "Comer en el local", icon: UtensilsCrossed },
    { value: "mostrador", label: "Retirar en mostrador", icon: Store },
  ];

  const pagos: { value: Pago; label: string; detalle: string; icon: typeof Store }[] = [
    {
      value: "efectivo",
      label: "Efectivo",
      detalle: "Pagás al retirar",
      icon: Banknote,
    },
    // Mercado Pago aparece solo si la empresa tiene el cobro configurado: no
    // tiene sentido ofrecer un botón que después no va a poder cobrar.
    ...(menu.mercadoPago
      ? [
          {
            value: "mercadopago" as Pago,
            label: "Mercado Pago",
            detalle: "Escaneás un QR con tu celular",
            icon: Smartphone,
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TotemTopBar
        slug={menu.slug}
        name={menu.name}
        logoUrl={menu.logoUrl}
        accent={accent}
        back="categorias"
        paso="pagar"
      />

      <main className="mx-auto w-full max-w-[700px] flex-1 px-6 py-6 md:px-12">
        <h1 className="mb-6 font-display text-4xl md:text-5xl">Último paso</h1>

        <form onSubmit={handleSubmit} className="space-y-7">
          <div className="space-y-2">
            <label htmlFor="name" className="font-display text-2xl">
              ¿A nombre de quién?
            </label>
            <input
              id="name"
              // El foco arranca acá: es el único campo obligatorio y el primer
              // paso de la pantalla, así que el teclado se abre solo y el
              // cliente no tiene que adivinar por dónde empezar.
              autoFocus
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              maxLength={120}
              placeholder="Tu nombre"
              className="h-16 w-full rounded-2xl border border-border bg-card/40 px-5 text-2xl outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <span className="font-display text-2xl">¿Cómo lo querés?</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {options.map((o) => {
                const selected = delivery === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setDelivery(o.value)}
                    className={`flex items-center gap-3 rounded-2xl border px-5 py-5 text-left transition ${
                      selected
                        ? "border-transparent text-white"
                        : "border-border hover:border-primary"
                    }`}
                    style={selected ? { background: accent ?? "var(--primary)" } : undefined}
                  >
                    <o.icon className="h-6 w-6" />
                    <span className="font-display text-xl">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="font-display text-2xl">¿Cómo pagás?</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pagos.map((o) => {
                const selected = pago === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setPago(o.value)}
                    className={`flex items-center gap-3 rounded-2xl border px-5 py-5 text-left transition ${
                      selected
                        ? "border-transparent text-white"
                        : "border-border hover:border-primary"
                    }`}
                    style={selected ? { background: accent ?? "var(--primary)" } : undefined}
                  >
                    <o.icon className="h-6 w-6 shrink-0" />
                    <span>
                      <span className="block font-display text-xl">{o.label}</span>
                      <span
                        className={`block text-sm ${selected ? "text-white/80" : "text-muted-foreground"}`}
                      >
                        {o.detalle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="comments" className="font-display text-2xl">
              ¿Algún comentario? <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Sin cebolla, cortado al medio..."
              className="w-full rounded-2xl border border-border bg-card/40 p-5 text-xl outline-none focus:border-primary"
            />
          </div>

          {/* Total y envío pegados abajo, como en el carrito: el formulario es
              largo y el botón quedaba al final de todo. El cliente tiene que
              ver cuánto va a pagar mientras completa, no después de buscar. */}
          <div className="sticky bottom-0 -mx-6 border-t border-border bg-background/95 px-6 py-4 backdrop-blur md:-mx-12 md:px-12">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-2xl uppercase tracking-wide">Total</span>
              <span className="font-display text-4xl" style={{ color: accent }}>
                {formatPrice(total)}
              </span>
            </div>
            <button
              type="submit"
              disabled={sending}
              className="late flex w-full items-center justify-center gap-3 rounded-3xl px-8 py-6 font-display text-3xl uppercase tracking-wide text-white transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
              style={
                {
                  background: accent ?? "var(--primary)",
                  "--halo": `color-mix(in oklab, ${accent ?? "var(--primary)"} 55%, transparent)`,
                } as React.CSSProperties
              }
            >
              {sending && <Loader2 className="h-7 w-7 animate-spin" />}
              Enviar pedido
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

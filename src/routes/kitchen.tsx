import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Clock,
  ChefHat,
  CheckCheck,
  PackageCheck,
  ChevronRight,
  Undo2,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Ban,
  Banknote,
  Smartphone,
  BadgeCheck,
  Eraser,
  Bike,
  Phone,
  MapPin,
  Volume2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { me } from "@/lib/api/auth.functions";
import {
  listKitchenOrders,
  setOrderStatus,
  setOrderPaid,
  verifyOrderPayment,
  cancelOrder,
  acceptOnlineOrder,
  type KitchenOrder,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/api/orders.functions";
import { formatPrice } from "@/lib/totem-cart";
import { formatearNumeroPedido } from "@/lib/order-number";
import { formatearDistancia, linkNavegacion } from "@/lib/delivery";
import { mensajeDeError } from "@/lib/error-message";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { canEditSection } from "@/lib/auth/permissions";

export const Route = createFileRoute("/kitchen")({
  head: () => ({ meta: [{ title: "Panel de cocina" }] }),
  component: Kitchen,
});

const statusMeta: Record<
  OrderStatus,
  { label: string; pill: string; icon: typeof Clock; accent: string }
> = {
  recibido: {
    label: "Recibido",
    pill: "bg-primary/20 text-primary border-primary/40",
    icon: Clock,
    accent: "border-l-primary",
  },
  preparacion: {
    label: "En preparación",
    pill: "bg-gold/20 text-gold border-gold/40",
    icon: ChefHat,
    accent: "border-l-gold",
  },
  entregado: {
    label: "Entregado",
    pill: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    icon: PackageCheck,
    accent: "border-l-emerald-500",
  },
  cancelado: {
    label: "Cancelado",
    pill: "bg-destructive/20 text-destructive border-destructive/40",
    icon: Ban,
    accent: "border-l-destructive",
  },
};

const flow: Record<OrderStatus, "recibido" | "preparacion" | "entregado" | null> = {
  recibido: "preparacion",
  preparacion: "entregado",
  entregado: null,
  // Un pedido cancelado no vuelve atrás: si el cliente se arrepiente se toma
  // uno nuevo, así el cierre de caja del día no cambia después de hecho.
  cancelado: null,
};

const columns: OrderStatus[] = ["recibido", "preparacion", "entregado", "cancelado"];

// Cuánto se queda un pedido a la vista antes de desaparecer solo de la
// comandera, para que no se acumulen los ya resueltos. Es solo visual: el
// pedido sigue en la base y vuelve si se recarga la pantalla.
//
// Solo se van solos los entregados. "Recibido" antes también se iba a los 3
// minutos, y un pedido que nadie movió a "En preparación" dejaba de verse
// mientras el cliente lo seguía esperando. "En preparación" está en curso, y
// "Cancelado" queda como registro del día. Para despejar la pantalla está el
// botón "Limpiar".
const OCULTAR_MS: Partial<Record<OrderStatus, number>> = {
  entregado: 60_000,
};

function limiteOcultar(o: KitchenOrder): number | undefined {
  return OCULTAR_MS[o.status];
}

const pagoMeta: Record<PaymentMethod, { label: string; icon: typeof Clock }> = {
  efectivo: { label: "Efectivo", icon: Banknote },
  mercadopago: { label: "Mercado Pago", icon: Smartphone },
};

/** Las demoras que se ofrecen al aceptar un pedido online, en minutos. */
const DEMORAS = [20, 30, 45, 60];

/** Un pedido online que todavía nadie aceptó: espera arriba, fuera de las columnas. */
const esPorAceptar = (o: KitchenOrder) =>
  o.channel === "online" && !o.acceptedAt && o.status !== "cancelado";

function entregaLabel(o: KitchenOrder): string {
  if (o.deliveryMethod === "envio") {
    return o.deliveryDistanceKm
      ? `Envío · ${formatearDistancia(Number(o.deliveryDistanceKm))}`
      : "Envío";
  }
  if (o.deliveryMethod === "local") return "Comer en el local";
  return o.channel === "online" ? "Retira en el local" : "Retirar en mostrador";
}

/** Navegación hasta el punto que marcó el cliente. No necesita ninguna clave de API. */
const mapaUrl = (o: KitchenOrder) =>
  o.deliveryLat && o.deliveryLng ? linkNavegacion(o.deliveryLat, o.deliveryLng) : null;

/**
 * La alarma de pedido online, con Web Audio y sin archivo de sonido.
 *
 * Tiene que oírse en un local con ruido, con el celular en el bolsillo o sobre
 * la plancha. Por eso no es un pitido suave: son ondas cuadradas (llenas de
 * armónicos, el oído las percibe mucho más fuertes que una sinusoidal al mismo
 * volumen) en dos tonos que alternan, como una sirena corta, repetida dos
 * veces y pasada por un compresor que la lleva al máximo sin que distorsione.
 *
 * El navegador no deja sonar nada hasta que alguien toca la pantalla, así que
 * el contexto se crea y se destraba con el primer toque.
 */
function pitar(ctx: AudioContext | null) {
  if (!ctx || ctx.state !== "running") return;
  const compresor = ctx.createDynamicsCompressor();
  compresor.threshold.value = -12;
  compresor.ratio.value = 12;
  compresor.connect(ctx.destination);

  const TONOS = [988, 1319]; // si y mi agudos: cortan el ruido de una cocina
  const DURACION = 0.16;
  let t = ctx.currentTime;
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = TONOS[i % 2];
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
      gain.gain.setValueAtTime(0.9, t + DURACION - 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + DURACION);
      osc.connect(gain).connect(compresor);
      osc.start(t);
      osc.stop(t + DURACION + 0.01);
      t += DURACION + 0.02;
    }
    t += 0.35;
  }
}

/** Lo que lleva el pedido, con lo sacado y lo agregado bien a la vista. */
function LineasPedido({ items }: { items: KitchenOrder["items"] }) {
  return (
    <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
      {items.map((i, idx) => (
        <li key={idx}>
          <span className="flex justify-between">
            <span className="truncate">
              <span className="font-bold text-gold">{i.quantity}×</span> {i.productName}
            </span>
          </span>
          {/* Lo que hay que sacar va debajo del producto y resaltado:
              equivocarse acá significa rehacer el plato, así que no puede
              parecer un detalle del renglón. */}
          {i.removed.length > 0 && (
            <span className="mt-0.5 block pl-5 text-xs font-bold uppercase tracking-wide text-amber-400">
              {i.removed.map((r) => `sin ${r}`).join(" · ")}
            </span>
          )}
          {/* Los extras van igual de resaltados: agregar de más también
              cambia el plato. */}
          {i.extras.length > 0 && (
            <span className="mt-0.5 block pl-5 text-xs font-bold uppercase tracking-wide text-emerald-400">
              {i.extras.map((e) => `+${e.quantity} ${e.name}`).join(" · ")}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Teléfono, a dónde va y con cuánto paga: lo que necesita quien lo despacha. */
function DatosOnline({ o }: { o: KitchenOrder }) {
  const mapa = mapaUrl(o);
  const vuelto =
    o.paymentMethod === "efectivo" && o.cashPaysWith
      ? Number(o.cashPaysWith) - Number(o.total)
      : null;
  return (
    <div className="mt-3 space-y-1.5 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
      {o.customerPhone && (
        <a
          href={`tel:${o.customerPhone.replace(/[^\d+]/g, "")}`}
          className="flex items-center gap-2 font-bold text-sky-300 underline-offset-4 hover:underline"
        >
          <Phone className="h-4 w-4 shrink-0" />
          {o.customerPhone}
        </a>
      )}
      {o.deliveryMethod === "envio" && (
        <>
          <p className="flex items-start gap-2">
            <Bike className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
            <span>
              <span className="font-bold">{o.deliveryAddress}</span>
              {o.deliveryDetails && <span className="block">{o.deliveryDetails}</span>}
              <span className="block text-muted-foreground">
                {o.deliveryDistanceKm && formatearDistancia(Number(o.deliveryDistanceKm))}
                {o.deliveryFee && ` · envío ${formatPrice(o.deliveryFee)}`}
              </span>
            </span>
          </p>
          {mapa && (
            <a
              href={mapa}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sky-300 underline underline-offset-4"
            >
              <MapPin className="h-4 w-4 shrink-0" />
              Cómo llegar (Google Maps)
            </a>
          )}
        </>
      )}
      {vuelto !== null && (
        <p className="flex items-center gap-2">
          <Banknote className="h-4 w-4 shrink-0 text-sky-300" />
          Paga con {formatPrice(o.cashPaysWith!)} · vuelto{" "}
          <span className="font-bold">{formatPrice(vuelto)}</span>
        </p>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.max(s, 0)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// Cuánto le queda al pedido antes de salir solo de la comanda, con el mismo
// criterio que lo oculta: null si su estado no tiene límite. El entregado cuenta
// desde que se entregó; el recibido, desde que se creó.
function restanteMs(
  o: KitchenOrder,
  ahora: number,
  desdeEntregado: Map<number, number>,
): number | null {
  const limite = limiteOcultar(o);
  if (limite == null) return null;
  const desde =
    o.status === "entregado"
      ? (desdeEntregado.get(o.id) ?? new Date(o.createdAt).getTime())
      : llegadaACocina(o);
  return Math.max(0, limite - (ahora - desde));
}

/**
 * Desde cuándo está el pedido en la cocina. Uno online entra recién cuando lo
 * aceptan, que puede ser bastante después de creado: medirlo desde la creación
 * lo haría desaparecer de "Recibido" apenas aceptado.
 */
function llegadaACocina(o: KitchenOrder): number {
  return new Date(o.acceptedAt ?? o.createdAt).getTime();
}

function cuentaRegresiva(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Kitchen() {
  const navigate = useNavigate();
  const doMe = useServerFn(me);
  const fetchOrders = useServerFn(listKitchenOrders);
  const updateStatus = useServerFn(setOrderStatus);
  const updatePaid = useServerFn(setOrderPaid);
  const doVerify = useServerFn(verifyOrderPayment);
  const doCancel = useServerFn(cancelOrder);
  const doAccept = useServerFn(acceptOnlineOrder);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  // Mirar la comandera y mover los pedidos son cosas distintas: al encargado
  // con "solo ver" el servidor le rechaza el cambio, así que no le mostramos
  // botones que no va a poder usar. El personal de cocina siempre puede.
  const [puedeOperar, setPuedeOperar] = useState(true);
  // Cancelar se confirma con un diálogo propio y no con window.confirm: la
  // comandera vive en una tablet en modo kiosco, donde el cartel del navegador
  // queda fuera de lugar y a veces ni aparece.
  const [aCancelar, setACancelar] = useState<KitchenOrder | null>(null);
  const [cancelando, setCancelando] = useState(false);
  // Quien entra desde el panel vuelve al panel. El personal de cocina no tiene
  // panel: para ellos esta pantalla es todo, y no se les muestra salida.
  const [tienePanel, setTienePanel] = useState(false);
  // Pedido de Mercado Pago que Mercado Pago no registra como pagado: antes de
  // pasarlo a efectivo se pregunta, porque cambia cómo cuenta en el cierre.
  const [aEfectivo, setAEfectivo] = useState<KitchenOrder | null>(null);
  const [cobrando, setCobrando] = useState<number | null>(null);
  // Reloj que avanza solo para reevaluar qué pedidos ya cumplieron su tiempo y
  // sacarlos de la vista sin esperar a que entre uno nuevo.
  const [ahora, setAhora] = useState(() => Date.now());
  // Cuándo se vio cada pedido entregado: su minuto corre desde que se entregó,
  // y eso no está en la base. Los recibidos se miden por antigüedad (createdAt).
  const entregadoDesdeRef = useRef<Map<number, number>>(new Map());
  // Pedidos que el botón "Limpiar" sacó de la vista a mano. Es solo en memoria:
  // se pierde al recargar, así que la limpieza nunca borra nada de la base.
  const limpiadosRef = useRef<Set<number>>(new Set());
  // Los online que estaban esperando en el refresco anterior. Si uno pasa a
  // cancelado porque lo canceló el cliente, quien atiende tiene que enterarse:
  // la tarjeta desaparece de "Por aceptar" y sin aviso parecería un error.
  const esperandoRef = useRef<Set<number>>(new Set());
  // Aviso sonoro de pedidos online por aceptar. Quien los atiende está con el
  // celular en la mano haciendo otra cosa: si no suena, el pedido espera.
  const audioRef = useRef<AudioContext | null>(null);
  const [sonidoActivo, setSonidoActivo] = useState(false);
  const [aceptando, setAceptando] = useState<number | null>(null);

  // El navegador no deja sonar nada hasta el primer toque en la página: ese
  // toque, sea donde sea, destraba el sonido.
  const activarSonido = useCallback(async () => {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audioRef.current ??= new Ctor();
      await audioRef.current.resume();
      setSonidoActivo(audioRef.current.state === "running");
    } catch {
      // Sin sonido la comandera igual funciona: queda el cartel.
    }
  }, []);

  useEffect(() => {
    const alTocar = () => void activarSonido();
    window.addEventListener("pointerdown", alTocar, { once: true });
    return () => window.removeEventListener("pointerdown", alTocar);
  }, [activarSonido]);

  const load = useCallback(async () => {
    try {
      const nuevos = await fetchOrders();
      // Mientras haya pedidos online esperando, suena en cada refresco: uno
      // solo al llegar se pierde si nadie estaba mirando.
      if (nuevos.some(esPorAceptar)) {
        pitar(audioRef.current);
        navigator.vibrate?.([200, 100, 200]);
      }
      const vivos = new Set(nuevos.map((o) => o.id));
      const desde = entregadoDesdeRef.current;
      // Olvidar los pedidos que ya no vienen del servidor, para que los mapas no
      // crezcan sin fin en una pantalla que queda abierta todo el día.
      for (const id of [...desde.keys()]) if (!vivos.has(id)) desde.delete(id);
      for (const id of [...limpiadosRef.current]) {
        if (!vivos.has(id)) limpiadosRef.current.delete(id);
      }
      for (const o of nuevos) {
        if (o.status === "entregado") {
          if (!desde.has(o.id)) desde.set(o.id, Date.now());
        } else {
          desde.delete(o.id);
        }
      }
      for (const o of nuevos) {
        if (o.canceladoPorCliente && esperandoRef.current.has(o.id)) {
          toast.warning(
            `El cliente canceló el pedido ${formatearNumeroPedido(o.businessDate, o.orderNumber)}`,
            { duration: 10_000 },
          );
        }
      }
      esperandoRef.current = new Set(nuevos.filter(esPorAceptar).map((o) => o.id));
      setOrders(nuevos);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los pedidos");
    }
  }, [fetchOrders]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // La sesión y los pedidos se piden a la vez: uno detrás del otro sumaban
      // sus demoras, y la comandera tardaba el doble en mostrar algo. Si no hay
      // sesión, los pedidos fallan solos y se va al login igual.
      const pedidos = load();
      const user = await doMe();
      if (!user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      if (alive) {
        setTienePanel(
          user.roles.includes("owner") ||
            user.roles.includes("encargado") ||
            user.roles.includes("superadmin"),
        );
        setPuedeOperar(
          user.roles.includes("kitchen") ||
            user.roles.includes("owner") ||
            user.roles.includes("superadmin") ||
            canEditSection(user.permissions, "comandera"),
        );
      }
      await pedidos;
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [doMe, navigate, load]);

  // La cocina queda abierta todo el día: refrescamos solos para que entren los
  // pedidos nuevos sin que nadie toque la pantalla.
  useEffect(() => {
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  // Avanza el reloj para que los pedidos vencidos salgan de la vista aunque no
  // entre ninguno nuevo.
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Los que siguen a la vista: se van cayendo los que cumplieron su tiempo y los
  // que se limpiaron a mano. Depende de `ahora` para reevaluarse con el reloj.
  const visibles = useMemo(() => {
    return orders.filter((o) => {
      // Los online sin aceptar van en su propia franja, no en las columnas.
      if (esPorAceptar(o)) return false;
      if (limpiadosRef.current.has(o.id)) return false;
      const limite = limiteOcultar(o);
      if (limite == null) return true;
      const desde =
        o.status === "entregado"
          ? (entregadoDesdeRef.current.get(o.id) ?? new Date(o.createdAt).getTime())
          : llegadaACocina(o);
      return ahora - desde < limite;
    });
  }, [orders, ahora]);

  // Los más viejos primero: el que más esperó es el primero a contestar.
  const porAceptar = useMemo(
    () =>
      orders
        .filter(esPorAceptar)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders],
  );

  // La pestaña avisa también, por si la comandera quedó detrás de otra.
  useEffect(() => {
    document.title =
      porAceptar.length > 0 ? `(${porAceptar.length}) Por aceptar` : "Panel de cocina";
  }, [porAceptar.length]);

  const aceptar = async (order: KitchenOrder, etaMinutes: number) => {
    setAceptando(order.id);
    try {
      await doAccept({ data: { orderId: order.id, etaMinutes } });
      toast.success(
        `Pedido ${formatearNumeroPedido(order.businessDate, order.orderNumber)} aceptado: ${etaMinutes} min`,
      );
      await load();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo aceptar el pedido"));
    } finally {
      setAceptando(null);
    }
  };

  const grouped = useMemo(() => {
    const g: Record<OrderStatus, KitchenOrder[]> = {
      recibido: [],
      preparacion: [],
      entregado: [],
      cancelado: [],
    };
    for (const o of visibles) g[o.status].push(o);
    return g;
  }, [visibles]);

  const limpiar = () => {
    for (const o of orders) limpiadosRef.current.add(o.id);
    setAhora(Date.now());
  };

  // Cancelar no pasa por acá: tiene su propia función porque además decide qué
  // hacer con la plata ya cobrada.
  const changeStatus = async (
    order: KitchenOrder,
    status: "recibido" | "preparacion" | "entregado",
  ) => {
    const previous = order.status;
    // El minuto del entregado arranca ahora, no en el próximo refresco: si no,
    // un pedido viejo recién entregado se mediría contra su createdAt y saldría
    // de la vista al instante en vez de darle su minuto.
    if (status === "entregado") entregadoDesdeRef.current.set(order.id, Date.now());
    else entregadoDesdeRef.current.delete(order.id);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    try {
      await updateStatus({ data: { orderId: order.id, status } });
    } catch (err) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: previous } : o)));
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  };

  const togglePagado = async (order: KitchenOrder) => {
    const pagado = order.paymentStatus === "pagado";
    setCobrando(order.id);
    try {
      // Un pedido de Mercado Pago no se da por cobrado a ojo: primero se le
      // pregunta a Mercado Pago. Si no lo tiene, recién ahí se ofrece
      // cobrarlo en efectivo.
      if (!pagado && order.paymentMethod === "mercadopago") {
        const { pagado: confirmado } = await doVerify({ data: { orderId: order.id } });
        if (confirmado) {
          toast.success(
            `Mercado Pago confirmó el pago del pedido ${formatearNumeroPedido(order.businessDate, order.orderNumber)}`,
          );
          await load();
        } else {
          setAEfectivo(order);
        }
        return;
      }
      await updatePaid({ data: { orderId: order.id, paid: !pagado } });
      await load();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo cambiar el estado del cobro"));
    } finally {
      setCobrando(null);
    }
  };

  const cobrarEnEfectivo = async () => {
    if (!aEfectivo) return;
    setCobrando(aEfectivo.id);
    try {
      const r = await updatePaid({ data: { orderId: aEfectivo.id, paid: true } });
      toast.success(
        r.via === "mercadopago"
          ? "Justo entró el pago por Mercado Pago"
          : `Pedido ${formatearNumeroPedido(aEfectivo.businessDate, aEfectivo.orderNumber)} cobrado en efectivo`,
      );
      setAEfectivo(null);
      await load();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo marcar como cobrado"));
    } finally {
      setCobrando(null);
    }
  };

  const confirmarCancelacion = async () => {
    if (!aCancelar) return;
    const cobrado = aCancelar.paymentStatus === "pagado";
    setCancelando(true);
    try {
      await doCancel({ data: { orderId: aCancelar.id } });
      setACancelar(null);
      await load();
      toast.success(cobrado ? "Cancelado, queda pendiente de reembolso" : "Pedido cancelado");
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo cancelar el pedido"));
    } finally {
      setCancelando(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto max-w-[1700px] px-6 py-8 md:px-10">
        {/* Encabezado al mínimo: cada píxel que se lleva el título es un pedido
            menos a la vista, y acá lo que importa son los pedidos. */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {tienePanel && (
              <a
                href="/admin"
                className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold transition hover:border-primary"
                title="Volver al panel"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Panel</span>
              </a>
            )}
            <h1 className="font-display text-3xl md:text-4xl">Cocina</h1>
            <p className="text-sm text-muted-foreground">
              {visibles.length} {visibles.length === 1 ? "pedido" : "pedidos"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold transition hover:border-primary"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={limpiar}
              disabled={visibles.length === 0}
              className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
              title="Sacar todos los pedidos de la vista (se recuperan al recargar)"
            >
              <Eraser className="h-4 w-4" />
              Limpiar
            </button>
          </div>
        </div>

        {porAceptar.length > 0 && (
          <section className="mb-6 rounded-3xl border-2 border-sky-500/60 bg-sky-500/5 p-4 md:p-5">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-sky-300" />
                <h2 className="font-display text-2xl">Pedidos online por aceptar</h2>
                <span className="rounded-full bg-sky-500 px-3 py-0.5 text-sm font-extrabold text-white">
                  {porAceptar.length}
                </span>
              </div>
              {!sonidoActivo && (
                <button
                  type="button"
                  onClick={activarSonido}
                  className="flex h-10 items-center gap-2 rounded-xl border border-sky-500/60 px-3 text-sm font-bold text-sky-300"
                >
                  <Volume2 className="h-4 w-4" />
                  Activar el aviso con sonido
                </button>
              )}
            </header>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {porAceptar.map((o) => (
                <article
                  key={o.id}
                  className="rounded-2xl border border-border border-l-4 border-l-sky-500 bg-card p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-3xl text-gold">
                        {formatearNumeroPedido(o.businessDate, o.orderNumber)}
                      </div>
                      <div className="text-sm font-bold">{o.customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {entregaLabel(o)}
                        {" · "}
                        <span className="text-gold">hace {timeAgo(o.createdAt)}</span>
                      </div>
                    </div>
                    <span className="shrink-0 font-display text-2xl">{formatPrice(o.total)}</span>
                  </div>

                  <DatosOnline o={o} />
                  <LineasPedido items={o.items} />

                  {o.comments && (
                    <div className="mt-3 rounded-lg bg-secondary p-2 text-xs italic text-muted-foreground">
                      {o.comments}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {(() => {
                      const P = pagoMeta[o.paymentMethod].icon;
                      return <P className="h-3.5 w-3.5" />;
                    })()}
                    {pagoMeta[o.paymentMethod].label}
                    {o.paymentMethod === "mercadopago" &&
                      (o.paymentStatus === "pagado" ? (
                        <span className="ml-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                          Pagado
                        </span>
                      ) : (
                        <span className="ml-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                          Esperando pago
                        </span>
                      ))}
                  </div>

                  {puedeOperar && (
                    <>
                      {/* Aceptar es elegir la demora: un solo toque, y el
                          cliente ve en su celular en cuánto lo tiene. */}
                      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Aceptar con demora de
                      </p>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {DEMORAS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            disabled={aceptando !== null}
                            onClick={() => aceptar(o, m)}
                            className="flex h-12 items-center justify-center rounded-xl bg-gradient-primary text-sm font-extrabold text-primary-foreground transition active:scale-95 disabled:opacity-50"
                          >
                            {aceptando === o.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              `${m}'`
                            )}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setACancelar(o)}
                        disabled={aceptando !== null}
                        className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-xs font-bold uppercase tracking-wider text-muted-foreground transition hover:border-destructive hover:text-destructive"
                      >
                        <Ban className="h-4 w-4" /> Rechazar
                      </button>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {visibles.length === 0 && porAceptar.length > 0 ? null : visibles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 p-16 text-center">
            <h2 className="font-display text-3xl">Sin pedidos todavía</h2>
            <p className="mt-2 text-muted-foreground">Apenas entren pedidos aparecerán acá.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((col) => {
              const Icon = statusMeta[col].icon;
              return (
                <section key={col} className="flex flex-col gap-3">
                  <header className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-gold" />
                      <h2 className="font-display text-xl">{statusMeta[col].label}</h2>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-0.5 text-sm font-extrabold">
                      {grouped[col].length}
                    </span>
                  </header>

                  <div className="space-y-3">
                    {grouped[col].map((o) => {
                      const next = flow[o.status];
                      return (
                        <article
                          key={o.id}
                          className={`rounded-2xl border border-border ${statusMeta[o.status].accent} border-l-4 bg-card p-4 shadow-card`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-display text-3xl text-gold">
                                {formatearNumeroPedido(o.businessDate, o.orderNumber)}
                              </div>
                              <div className="text-sm font-bold">{o.customerName}</div>
                              <div className="text-xs text-muted-foreground">
                                {o.channel === "online" && (
                                  <span className="mr-1 rounded bg-sky-500/20 px-1.5 py-0.5 font-bold uppercase text-sky-300">
                                    Online
                                  </span>
                                )}
                                {entregaLabel(o)}
                                {" · "}
                                <span className="text-gold">{timeAgo(o.createdAt)}</span>
                              </div>
                            </div>
                            {/* Esquina: el tiempo que le queda al pedido antes
                                de salir solo de la comanda, y el cancelar. El
                                cartelito de estado no va: el borde de color y la
                                columna ya lo dicen. */}
                            <div className="flex shrink-0 items-center gap-2">
                              {(() => {
                                const restante = restanteMs(o, ahora, entregadoDesdeRef.current);
                                return restante == null ? null : (
                                  <span
                                    className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground"
                                    title="Tiempo hasta que salga de la comanda"
                                  >
                                    <Clock className="h-3 w-3" />
                                    {cuentaRegresiva(restante)}
                                  </span>
                                );
                              })()}
                              {o.status !== "cancelado" && puedeOperar && (
                                <button
                                  type="button"
                                  onClick={() => setACancelar(o)}
                                  aria-label={`Cancelar el pedido ${formatearNumeroPedido(o.businessDate, o.orderNumber)}`}
                                  title="Cancelar pedido"
                                  className="rounded-xl p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Ban className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {o.channel === "online" && <DatosOnline o={o} />}
                          <LineasPedido items={o.items} />

                          {o.comments && (
                            <div className="mt-3 rounded-lg bg-secondary p-2 text-xs italic text-muted-foreground">
                              {o.comments}
                            </div>
                          )}

                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {(() => {
                                  const P = pagoMeta[o.paymentMethod].icon;
                                  return <P className="h-3.5 w-3.5" />;
                                })()}
                                {pagoMeta[o.paymentMethod].label}
                              </span>

                              {/* El efectivo se marca a mano. Lo de Mercado Pago
                                  lo confirma Mercado Pago: cobrado así no se
                                  puede desmarcar, y sin confirmar se consulta
                                  antes de darlo por cobrado en la caja. */}
                              {o.canceladoPorCliente && (
                                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Lo canceló el cliente
                                </span>
                              )}
                              {o.paymentStatus === "reembolso_pendiente" ? (
                                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                  Devolver
                                </span>
                              ) : o.status === "cancelado" ? null : o.mpConfirmado ? (
                                <span
                                  className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300"
                                  title="Mercado Pago confirmó el pago"
                                >
                                  <BadgeCheck className="h-3 w-3" />
                                  Cobrado
                                </span>
                              ) : puedeOperar ? (
                                <button
                                  type="button"
                                  onClick={() => togglePagado(o)}
                                  disabled={cobrando === o.id}
                                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${
                                    o.paymentStatus === "pagado"
                                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                      : o.paymentMethod === "mercadopago"
                                        ? "border-sky-500/40 bg-sky-500/10 text-sky-300 hover:border-sky-300"
                                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                                  }`}
                                >
                                  {cobrando === o.id && (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  )}
                                  {o.paymentStatus === "pagado"
                                    ? "Cobrado"
                                    : o.paymentMethod === "mercadopago"
                                      ? "Esperando pago"
                                      : "Sin cobrar"}
                                </button>
                              ) : (
                                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  {o.paymentStatus === "pagado" ? "Cobrado" : "Sin cobrar"}
                                </span>
                              )}
                            </div>

                            <span className="shrink-0 font-display text-xl">
                              {formatPrice(o.total)}
                            </span>
                          </div>

                          {next && puedeOperar && (
                            <button
                              onClick={() => changeStatus(o, next)}
                              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-extrabold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:scale-[1.02] active:scale-95"
                            >
                              {statusMeta[next].label}
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                          {o.status === "entregado" && puedeOperar && (
                            <button
                              onClick={() => changeStatus(o, "preparacion")}
                              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                            >
                              <Undo2 className="h-4 w-4" /> Revertir
                            </button>
                          )}
                        </article>
                      );
                    })}
                    {grouped[col].length === 0 && (
                      // En el celular las columnas van una debajo de la otra, y un
                      // "Sin pedidos" por cada una empujaba fuera de la
                      // pantalla lo que sí hay que atender. El contador del
                      // encabezado ya dice que está vacía.
                      <div className="hidden rounded-2xl border border-dashed border-border/60 p-6 text-center text-xs uppercase tracking-wider text-muted-foreground md:block">
                        Sin pedidos
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={aEfectivo !== null} onOpenChange={(o) => !o && setAEfectivo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mercado Pago no registra el pago del{" "}
              {aEfectivo && formatearNumeroPedido(aEfectivo.businessDate, aEfectivo.orderNumber)}
            </DialogTitle>
            <DialogDescription>
              El cliente eligió pagar con Mercado Pago, pero el pago no aparece en la cuenta. Si lo
              cobraste en la caja, marcalo como efectivo: así cuenta en el cierre junto con el resto
              del efectivo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAEfectivo(null)}
              disabled={cobrando !== null}
              className="flex h-11 items-center rounded-xl border border-border px-5 text-sm font-bold transition hover:border-primary"
            >
              Todavía no pagó
            </button>
            <button
              type="button"
              onClick={cobrarEnEfectivo}
              disabled={cobrando !== null}
              className="flex h-11 items-center gap-2 rounded-xl bg-gradient-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
            >
              {cobrando !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Banknote className="h-4 w-4" />
              )}
              Cobrado en efectivo
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aCancelar !== null} onOpenChange={(o) => !o && setACancelar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {aCancelar && esPorAceptar(aCancelar) ? "Rechazar" : "Cancelar"} el pedido{" "}
              {aCancelar && formatearNumeroPedido(aCancelar.businessDate, aCancelar.orderNumber)}
            </DialogTitle>
            <DialogDescription>
              {aCancelar?.paymentStatus === "pagado"
                ? "Este pedido ya está cobrado. Al cancelarlo queda marcado como pendiente de reembolso y la plata se devuelve a mano, por caja o por Mercado Pago."
                : aCancelar && esPorAceptar(aCancelar)
                  ? "El cliente ve en su celular que no se lo pueden hacer. Si querés explicarle por qué, llamalo al teléfono del pedido."
                  : "El pedido deja de contar para el cierre de caja del día."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            No se puede deshacer: si el cliente se arrepiente, se toma un pedido nuevo.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setACancelar(null)}
              disabled={cancelando}
              className="flex h-11 items-center rounded-xl border border-border px-5 text-sm font-bold transition hover:border-primary"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={confirmarCancelacion}
              disabled={cancelando}
              className="flex h-11 items-center gap-2 rounded-xl bg-destructive px-5 text-sm font-bold text-destructive-foreground transition hover:brightness-110"
            >
              {cancelando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              {aCancelar && esPorAceptar(aCancelar) ? "Rechazar" : "Cancelar"} el pedido
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
  Trash2,
  AlertTriangle,
  Gift,
  CircleHelp,
  X,
  Printer,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { me } from "@/lib/api/auth.functions";
import { getMyBusiness } from "@/lib/api/business.functions";
import { guardarMarca, useFaviconMarca } from "@/lib/marca";
import {
  listKitchenOrders,
  setOrderStatus,
  setOrderPaid,
  verifyOrderPayment,
  cancelOrder,
  acceptOnlineOrder,
  markOrderDispatched,
  type KitchenOrder,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/api/orders.functions";
import { formatPrice } from "@/lib/totem-cart";
import { formatearNumeroPedido } from "@/lib/order-number";
import { formatearDistancia, linkNavegacion, linkNavegacionADireccion } from "@/lib/delivery";
import { mensajeDeError } from "@/lib/error-message";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { canEditSection } from "@/lib/auth/permissions";
import { PantallaCarga } from "@/components/PantallaCarga";
import { comandasHtml } from "@/lib/print/comanda";
import { linkWhatsApp } from "@/lib/whatsapp";
import { horaArgentina } from "@/lib/jornada";
import { imprimirHtml } from "@/lib/print/navegador";

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

/**
 * El botón grande de cada pedido dice qué hacer, no a qué estado pasa:
 * "En preparación" sobre un pedido recibido no se entendía si era un cartel o
 * un botón.
 */
const accionHacia: Record<"recibido" | "preparacion" | "entregado", string> = {
  // Nadie vuelve un pedido a recibido desde el botón grande; está por el tipo.
  recibido: "Volver a recibido",
  preparacion: "Empezar a preparar",
  entregado: "Listo, entregado",
};

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

/**
 * Un pedido online (o de mesa, si la empresa no los acepta solos) que todavía
 * nadie aceptó: espera arriba, fuera de las columnas.
 */
const esPorAceptar = (o: KitchenOrder) =>
  o.channel !== "totem" && !o.acceptedAt && o.status !== "cancelado";

/**
 * "Mesa 7", grande al lado del número: es lo que necesita el que lleva el
 * pedido, y lo tiene que leer de lejos.
 */
/**
 * El código que el cliente tiene que mostrar al retirar. Se le pide antes de
 * entregar: el número de pedido arranca en 1 cada día y cualquiera puede decir
 * "soy el 3".
 */
function ChipCodigo({ codigo }: { codigo: string | null }) {
  if (!codigo) return null;
  return (
    <span
      className="rounded-lg border border-border px-2 py-0.5 font-mono text-sm font-bold tracking-[0.2em] text-foreground"
      title="Código del cliente: pedíselo al entregar"
    >
      {codigo}
    </span>
  );
}

function ChipMesa({ o }: { o: KitchenOrder }) {
  if (o.channel !== "mesa" || o.tableNumber === null) return null;
  return (
    <span className="rounded-lg bg-violet-500 px-2.5 py-0.5 font-display text-2xl text-white">
      Mesa {o.tableNumber}
    </span>
  );
}

function entregaLabel(o: KitchenOrder): string {
  if (o.deliveryMethod === "envio") {
    return o.deliveryDistanceKm
      ? `Envío · ${formatearDistancia(Number(o.deliveryDistanceKm))}`
      : "Envío";
  }
  if (o.channel === "mesa") return "Llevar a la mesa";
  if (o.deliveryMethod === "local") return "Comer en el local";
  return o.channel === "online" ? "Retira en el local" : "Retirar en mostrador";
}

/**
 * Navegación hasta el punto que marcó el cliente. No necesita ninguna clave de
 * API. Si el punto es solo la calle (el mapa no tenía la altura), se navega por
 * la dirección escrita: al punto, el repartidor llegaría a la cuadra equivocada.
 */
const mapaUrl = (o: KitchenOrder) =>
  o.deliveryApprox && o.deliveryAddress
    ? linkNavegacionADireccion(o.deliveryAddress)
    : o.deliveryLat && o.deliveryLng
      ? linkNavegacion(o.deliveryLat, o.deliveryLng)
      : null;

/**
 * Un "ding" corto cuando entra un pedido nuevo a las columnas (del tótem, o
 * de mesa aceptado solo). No es la sirena de "por aceptar": ese pedido no
 * espera a nadie, solo hay que enterarse de que llegó.
 */
function campanita(ctx: AudioContext | null) {
  if (!ctx || ctx.state !== "running") return;
  let t = ctx.currentTime;
  for (const f of [1047, 1568]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.7, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
    t += 0.14;
  }
}

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
function LineasPedido({
  items,
  regalo,
  regaloDescuento,
}: {
  items: KitchenOrder["items"];
  regalo: number;
  regaloDescuento: number;
}) {
  return (
    <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
      {items.map((i, idx) => (
        <li key={idx}>
          <span className="flex justify-between">
            <span className="truncate">
              <span className="font-bold text-gold">{i.quantity}×</span> {i.productName}
            </span>
          </span>
          {/* Los gustos de un combo a elección: es lo que hay que armar, uno por
              renglón para contarlos rápido. */}
          {i.elecciones.length > 0 && (
            <ul className="mt-0.5 space-y-px pl-5 text-xs font-bold text-sky-300">
              {i.elecciones.map((e, k) => (
                <li key={k}>
                  {e.quantity}× {e.name}
                </li>
              ))}
            </ul>
          )}
          {/* El tamaño, en lo que se hace en más de uno: una chica por una
              grande es una pizza equivocada. */}
          {i.tamanio && (
            <span className="mt-0.5 block pl-5 text-xs font-bold uppercase tracking-wide text-sky-300">
              {i.tamanio}
            </span>
          )}
          {/* El pan, para el que arma la bandeja: un blanco por un negro es
              un sándwich equivocado. */}
          {i.pan && (
            <span className="mt-0.5 block pl-5 text-xs font-bold uppercase tracking-wide text-sky-300">
              Pan {i.pan}
            </span>
          )}
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
      {/* "Cada 12, 2 de regalo": la app cuenta, la cocina elige cuáles. Va
          resaltado porque es lo que más fácil se olvida en un pedido grande. */}
      {regaloDescuento > 0 && (
        <li className="flex items-center gap-2 text-xs text-emerald-400">
          <Gift className="h-3.5 w-3.5 shrink-0" />
          Incluye sándwiches de regalo que eligió el cliente (−{formatPrice(regaloDescuento)})
        </li>
      )}
      {regalo > 0 && (
        <li className="flex items-center gap-2 rounded-lg bg-gold/15 px-2 py-1 font-bold text-gold">
          <Gift className="h-4 w-4 shrink-0" />+{regalo} de regalo (a elección del local)
        </li>
      )}
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a
            href={`tel:${o.customerPhone.replace(/[^\d+]/g, "")}`}
            className="flex items-center gap-2 font-bold text-sky-300 underline-offset-4 hover:underline"
          >
            <Phone className="h-4 w-4 shrink-0" />
            {o.customerPhone}
          </a>
          {/* Para avisarle algo sin llamar ("se demora 10 minutos", "estoy en
              la puerta"), con el número de pedido ya escrito. */}
          {(() => {
            const wa = linkWhatsApp(
              o.customerPhone,
              `Hola ${o.customerName}! Te escribimos por tu pedido ${formatearNumeroPedido(o.businessDate, o.orderNumber)}.`,
            );
            return wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sky-300 underline underline-offset-4"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                WhatsApp
              </a>
            ) : null;
          })()}
        </div>
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

/**
 * Un pedido en curso que ya se pasó: de la demora que se le prometió al
 * cliente, o de 20 minutos si no se le prometió ninguna (tótem). Es lo que
 * hay que atender primero, y en una pantalla llena no se ve sin marcarlo.
 */
const SIN_DEMORA_MS = 20 * 60 * 1000;
function minutosDeAtraso(o: KitchenOrder, ahora: number): number {
  if (o.status !== "recibido" && o.status !== "preparacion") return 0;
  if (o.dispatchedAt) return 0;
  const limite = o.etaMinutes
    ? new Date(o.acceptedAt ?? o.createdAt).getTime() + o.etaMinutes * 60_000
    : llegadaACocina(o) + SIN_DEMORA_MS;
  return ahora > limite ? Math.floor((ahora - limite) / 60_000) : 0;
}

function cuentaRegresiva(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Qué pedidos ya imprimió esta comandera. Vive en el navegador: imprimir es
 * algo de este equipo y su impresora, no del pedido. Se olvidan solos a los
 * dos días para que la lista no crezca.
 */
const CLAVE_IMPRESOS = "comandera-impresos";
const CLAVE_AUTO = "comandera-imprimir-auto";
// Un pedido que entró hace más que esto no se imprime solo al abrir la
// comandera: sería tirar de golpe todo lo que llegó mientras estaba cerrada.
const IMPRIMIR_HASTA_MS = 30 * 60 * 1000;

function leerImpresos(): Record<string, number> {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE_IMPRESOS) ?? "{}");
    return crudo && typeof crudo === "object" ? crudo : {};
  } catch {
    return {};
  }
}

function anotarImpresos(ids: number[]) {
  try {
    const lista = leerImpresos();
    const ahora = Date.now();
    for (const [id, t] of Object.entries(lista)) {
      if (ahora - t > 2 * 24 * 60 * 60 * 1000) delete lista[id];
    }
    for (const id of ids) lista[id] = ahora;
    localStorage.setItem(CLAVE_IMPRESOS, JSON.stringify(lista));
  } catch {
    // Sin almacenamiento: puede repetir alguna comanda al recargar.
  }
}

function Kitchen() {
  const navigate = useNavigate();
  const doMe = useServerFn(me);
  const fetchBusiness = useServerFn(getMyBusiness);
  // La marca de la empresa en la pestaña y arriba: la comandera es del local.
  const [marca, setMarca] = useState<{ nombre: string; logo: string | null } | null>(null);
  useEffect(() => {
    fetchBusiness()
      .then((b) => {
        if (!b) return;
        const m = { nombre: b.name, logo: b.logo_url };
        setMarca(m);
        guardarMarca(m);
      })
      .catch(() => {
        // Sin la marca la comandera funciona igual.
      });
  }, [fetchBusiness]);
  useFaviconMarca(marca?.logo);
  const fetchOrders = useServerFn(listKitchenOrders);
  const updateStatus = useServerFn(setOrderStatus);
  const updatePaid = useServerFn(setOrderPaid);
  const doVerify = useServerFn(verifyOrderPayment);
  const doCancel = useServerFn(cancelOrder);
  const doAccept = useServerFn(acceptOnlineOrder);
  const doDispatch = useServerFn(markOrderDispatched);

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
  const [cancelarTodos, setCancelarTodos] = useState(false);
  const [cancelandoTodos, setCancelandoTodos] = useState(false);
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
  // Los que ya estaban en las columnas: un id nuevo ahí es un pedido que
  // acaba de llegar a la cocina. Null hasta la primera carga, que no suena.
  const enColumnasRef = useRef<Set<number> | null>(null);
  // Aviso sonoro de pedidos online por aceptar. Quien los atiende está con el
  // celular en la mano haciendo otra cosa: si no suena, el pedido espera.
  const audioRef = useRef<AudioContext | null>(null);
  const [sonidoActivo, setSonidoActivo] = useState(false);
  // La guía de cómo se usa: abierta la primera vez en esta tablet, después
  // solo si la piden. Quien la cerró no la vuelve a ver al recargar.
  const [guiaAbierta, setGuiaAbierta] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem("comandera-guia-vista")) setGuiaAbierta(true);
    } catch {
      // Sin almacenamiento: queda cerrada, con el botón para abrirla.
    }
  }, []);
  const cerrarGuia = () => {
    setGuiaAbierta(false);
    try {
      localStorage.setItem("comandera-guia-vista", "1");
    } catch {
      // Sin almacenamiento: vuelve a aparecer al recargar.
    }
  };
  const [aceptando, setAceptando] = useState<number | null>(null);

  // Comanda impresa: cada pedido que entra a la cocina sale en papel solo, si
  // en este equipo se prendió. Apagado de entrada, porque no todos los locales
  // tienen impresora al lado de la comandera.
  const [autoImprimir, setAutoImprimir] = useState(false);
  useEffect(() => {
    try {
      setAutoImprimir(localStorage.getItem(CLAVE_AUTO) === "1");
    } catch {
      // Sin almacenamiento queda apagado.
    }
  }, []);
  // También en memoria: si el navegador no deja guardar, la lista guardada
  // vuelve vacía y sin esto se reimprimiría todo en cada refresco.
  const impresosRef = useRef<Set<number>>(new Set());
  const marcarImpresos = useCallback((ids: number[]) => {
    for (const id of ids) impresosRef.current.add(id);
    anotarImpresos(ids);
  }, []);
  const imprimirPedidos = useCallback(
    (lista: KitchenOrder[]) => {
      if (lista.length === 0) return;
      imprimirHtml(comandasHtml(lista));
      marcarImpresos(lista.map((o) => o.id));
    },
    [marcarImpresos],
  );

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
      // Uno que estaba "por aceptar" y alguien aceptó no suena: ya lo vieron.
      const estabanEsperando = esperandoRef.current;
      esperandoRef.current = new Set(nuevos.filter(esPorAceptar).map((o) => o.id));
      const enColumnas = new Set(
        nuevos.filter((o) => !esPorAceptar(o) && o.status === "recibido").map((o) => o.id),
      );
      const antes = enColumnasRef.current;
      // Solo los que llegaron recién: uno que vuelve de "en preparación" o que
      // se aceptó en otra pantalla hace rato no es una novedad.
      const recien = (o: KitchenOrder) => Date.now() - llegadaACocina(o) < 2 * 60 * 1000;
      const llegaron = nuevos.filter(
        (o) => enColumnas.has(o.id) && !antes?.has(o.id) && !estabanEsperando.has(o.id),
      );
      if (antes && llegaron.some(recien)) {
        campanita(audioRef.current);
      }
      // Todos los que ya entraron a las columnas, en cualquier estado, y solo
      // los que siguen viniendo: la pantalla queda abierta todo el día.
      enColumnasRef.current = new Set(nuevos.filter((o) => !esPorAceptar(o)).map((o) => o.id));
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

  useEffect(() => {
    if (!autoImprimir) return;
    const impresos = leerImpresos();
    const ahoraMs = Date.now();
    const nuevos = orders.filter(
      (o) =>
        !esPorAceptar(o) &&
        (o.status === "recibido" || o.status === "preparacion") &&
        !(o.id in impresos) &&
        !impresosRef.current.has(o.id) &&
        ahoraMs - llegadaACocina(o) < IMPRIMIR_HASTA_MS,
    );
    imprimirPedidos(nuevos);
  }, [orders, autoImprimir, imprimirPedidos]);

  const alternarAutoImprimir = () => {
    const nuevo = !autoImprimir;
    try {
      localStorage.setItem(CLAVE_AUTO, nuevo ? "1" : "0");
    } catch {
      // Queda así hasta recargar.
    }
    if (nuevo) {
      // Lo que ya está en pantalla no se imprime de golpe: desde ahora, los nuevos.
      marcarImpresos(orders.map((o) => o.id));
      toast.success("Desde ahora cada pedido nuevo sale impreso", {
        description:
          "Para que imprima sin preguntar, abrí Chrome con --kiosk-printing y dejá la térmica como impresora predeterminada.",
        duration: 8000,
      });
    }
    setAutoImprimir(nuevo);
  };

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

  const limpiarColumna = (lista: KitchenOrder[]) => {
    for (const o of lista) limpiadosRef.current.add(o.id);
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

  const salioAEntregar = async (order: KitchenOrder) => {
    const ahoraIso = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, dispatchedAt: ahoraIso } : o)),
    );
    try {
      await doDispatch({ data: { orderId: order.id } });
    } catch (err) {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, dispatchedAt: order.dispatchedAt } : o)),
      );
      toast.error(mensajeDeError(err, "No se pudo marcar que salió"));
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

  const confirmarCancelarTodos = async () => {
    const ids = grouped.recibido.map((o) => o.id);
    if (ids.length === 0) {
      setCancelarTodos(false);
      return;
    }
    setCancelandoTodos(true);
    try {
      const res = await Promise.allSettled(ids.map((orderId) => doCancel({ data: { orderId } })));
      const fallaron = res.filter((r) => r.status === "rejected").length;
      setCancelarTodos(false);
      await load();
      if (fallaron === 0) {
        toast.success(`Se cancelaron ${ids.length} pedidos recibidos`);
      } else {
        toast.error(`Quedaron ${fallaron} sin cancelar de ${ids.length}. Probá de nuevo.`);
      }
    } finally {
      setCancelandoTodos(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return <PantallaCarga />;
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
            {marca?.logo && (
              <img
                src={marca.logo}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full bg-white object-cover"
              />
            )}
            <h1 className="font-display text-3xl md:text-4xl">Cocina</h1>
            <p className="text-sm text-muted-foreground">
              {visibles.length + porAceptar.length}{" "}
              {visibles.length + porAceptar.length === 1 ? "pedido" : "pedidos"}
            </p>
            <button
              type="button"
              onClick={() => setGuiaAbierta((v) => !v)}
              aria-expanded={guiaAbierta}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-2.5 text-xs font-bold text-muted-foreground transition hover:border-primary hover:text-foreground"
            >
              <CircleHelp className="h-4 w-4" />
              <span className="hidden sm:inline">Cómo se usa</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={alternarAutoImprimir}
              aria-pressed={autoImprimir}
              className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${
                autoImprimir
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                  : "border-border hover:border-primary"
              }`}
              title="Imprime en este equipo una comanda por cada pedido que entra a la cocina"
            >
              <Printer className="h-4 w-4" />
              {autoImprimir ? "Imprime solo" : "Imprimir solo"}
            </button>
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
              title="Saca los pedidos de la pantalla para despejarla. No borra nada: vuelven al recargar"
            >
              <Eraser className="h-4 w-4" />
              Despejar pantalla
            </button>
          </div>
        </div>

        {guiaAbierta && (
          <section className="relative mb-6 rounded-3xl border border-primary/30 bg-primary/5 p-5 pr-12">
            <button
              type="button"
              onClick={cerrarGuia}
              aria-label="Cerrar la guía"
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-display text-2xl">Cómo se usa la comandera</h2>
            <ol className="mt-3 grid gap-3 text-sm md:grid-cols-4">
              <li>
                <span className="font-bold text-primary">1. Aceptar.</span> Los pedidos online y de
                mesa llegan arriba, en azul, y suenan. Tocá en cuánto tiempo está listo: el cliente
                lo ve en su celular.
              </li>
              <li>
                <span className="font-bold text-primary">2. Preparar.</span> En “Recibido” tocá{" "}
                <b>Empezar a preparar</b> cuando lo arrancan en la cocina.
              </li>
              <li>
                <span className="font-bold text-primary">3. Entregar.</span> Pedile al cliente su{" "}
                <b>código</b> (el que está al lado del número) y tocá <b>Listo, entregado</b>. Si
                fue un error, se puede revertir. En un envío, tocá <b>Salió a entregar</b> cuando
                sale el repartidor: el cliente lo ve en su celular.
              </li>
              <li>
                <span className="font-bold text-primary">4. Cobrar.</span> Al cobrar en efectivo
                tocá <b>Marcar cobrado</b>. Mercado Pago se marca solo cuando entra el pago.
              </li>
            </ol>
          </section>
        )}

        {porAceptar.length > 0 && (
          <section className="mb-6 rounded-3xl border-2 border-sky-500/60 bg-sky-500/5 p-4 md:p-5">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-sky-300" />
                <h2 className="font-display text-2xl">Pedidos por aceptar</h2>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-display text-3xl text-gold">
                          {formatearNumeroPedido(o.businessDate, o.orderNumber)}
                        </div>
                        <ChipMesa o={o} />
                        <ChipCodigo codigo={o.codigo} />
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

                  {o.channel === "online" && <DatosOnline o={o} />}
                  <LineasPedido
                    items={o.items}
                    regalo={o.regaloUnidades}
                    regaloDescuento={Number(o.regaloDescuento)}
                  />

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
                        ¿En cuánto está listo? Tocá para aceptar
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
                              `${m} min`
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
                    <div className="flex items-center gap-2">
                      {col === "recibido" && puedeOperar && grouped.recibido.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCancelarTodos(true)}
                          aria-label="Cancelar todos los recibidos"
                          title="Cancelar todos los recibidos"
                          className="flex h-8 items-center gap-1.5 rounded-full px-2 text-xs font-bold text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Cancelar todos
                        </button>
                      )}
                      {col !== "recibido" && grouped[col].length > 0 && (
                        <button
                          type="button"
                          onClick={() => limpiarColumna(grouped[col])}
                          aria-label={`Limpiar ${statusMeta[col].label}`}
                          title="Saca estos pedidos de la pantalla. No borra nada: vuelven al recargar"
                          className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-bold text-muted-foreground transition hover:border-primary hover:text-foreground"
                        >
                          <Eraser className="h-3.5 w-3.5" />
                          Ocultar
                        </button>
                      )}
                      <span className="rounded-full bg-secondary px-3 py-0.5 text-sm font-extrabold">
                        {grouped[col].length}
                      </span>
                    </div>
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
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-display text-3xl text-gold">
                                  {formatearNumeroPedido(o.businessDate, o.orderNumber)}
                                </div>
                                <ChipMesa o={o} />
                                <ChipCodigo codigo={o.codigo} />
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
                                {(() => {
                                  const atraso = minutosDeAtraso(o, ahora);
                                  return atraso > 0 ? (
                                    <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-destructive px-1.5 py-0.5 font-bold uppercase text-destructive-foreground">
                                      <AlertTriangle className="h-3 w-3" />
                                      Atrasado {atraso} min
                                    </span>
                                  ) : null;
                                })()}
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
                              {o.status !== "cancelado" && (
                                <button
                                  type="button"
                                  onClick={() => imprimirPedidos([o])}
                                  aria-label={`Imprimir la comanda del ${formatearNumeroPedido(o.businessDate, o.orderNumber)}`}
                                  title="Imprimir comanda"
                                  className="flex items-center rounded-xl px-2 py-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                              )}
                              {o.status !== "cancelado" && puedeOperar && (
                                <button
                                  type="button"
                                  onClick={() => setACancelar(o)}
                                  aria-label={`Cancelar el pedido ${formatearNumeroPedido(o.businessDate, o.orderNumber)}`}
                                  title="Cancelar pedido"
                                  className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Ban className="h-4 w-4" />
                                  <span className="hidden sm:inline">Cancelar</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {o.channel === "online" && <DatosOnline o={o} />}
                          <LineasPedido
                            items={o.items}
                            regalo={o.regaloUnidades}
                            regaloDescuento={Number(o.regaloDescuento)}
                          />

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
                                        : "border-amber-500/50 text-amber-300 hover:border-amber-300 hover:bg-amber-500/10"
                                  }`}
                                >
                                  {cobrando === o.id && (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  )}
                                  {o.paymentStatus === "pagado" ? (
                                    <>
                                      <CheckCheck className="h-3 w-3" /> Cobrado
                                    </>
                                  ) : o.paymentMethod === "mercadopago" ? (
                                    "Esperando pago"
                                  ) : (
                                    <>
                                      <Banknote className="h-3 w-3" /> Marcar cobrado
                                    </>
                                  )}
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

                          {o.deliveryMethod === "envio" &&
                            o.status === "preparacion" &&
                            o.dispatchedAt && (
                              <p className="mt-3 flex items-center gap-2 rounded-xl bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-300">
                                <Bike className="h-4 w-4" /> En camino desde las{" "}
                                {horaArgentina(o.dispatchedAt)}
                              </p>
                            )}
                          {/* Un envío tiene un paso más, que el cliente sigue
                              desde su celular: cuando sale con el repartidor. */}
                          {puedeOperar &&
                          o.deliveryMethod === "envio" &&
                          o.status === "preparacion" &&
                          !o.dispatchedAt ? (
                            <button
                              onClick={() => salioAEntregar(o)}
                              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-extrabold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:scale-[1.02] active:scale-95"
                            >
                              <Bike className="h-4 w-4" />
                              Salió a entregar
                            </button>
                          ) : (
                            next &&
                            puedeOperar && (
                              <button
                                onClick={() => changeStatus(o, next)}
                                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-extrabold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:scale-[1.02] active:scale-95"
                              >
                                {accionHacia[next]}
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            )
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

      <Dialog open={cancelarTodos} onOpenChange={(o) => !o && setCancelarTodos(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Cancelar TODOS los recibidos
            </DialogTitle>
            <DialogDescription>
              Acción peligrosa: vas a cancelar los {grouped.recibido.length} pedidos de la columna
              Recibido de una sola vez. Cada uno deja de contar para el cierre de caja y los que
              estén cobrados quedan pendientes de reembolso.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            No se puede deshacer. Si alguno se arrepiente, se toma un pedido nuevo.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCancelarTodos(false)}
              disabled={cancelandoTodos}
              className="flex h-11 items-center rounded-xl border border-border px-5 text-sm font-bold transition hover:border-primary"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={confirmarCancelarTodos}
              disabled={cancelandoTodos}
              className="flex h-11 items-center gap-2 rounded-xl bg-destructive px-5 text-sm font-bold text-destructive-foreground transition hover:brightness-110"
            >
              {cancelandoTodos ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Cancelar los {grouped.recibido.length}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

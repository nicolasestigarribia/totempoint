import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  MessageCircle,
  Sparkles,
  ArrowRight,
  Send,
  HelpCircle,
  Rocket,
  Palette as PaletteIcon,
  Lock,
  QrCode,
  Boxes,
  ChefHat,
  CreditCard,
  Users,
  Package,
  SlidersHorizontal,
  BarChart3,
  PiggyBank,
  Check,
  X,
  Clock,
  TrendingUp,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { BENEFICIOS, WHATSAPP_URL, type AuroraTheme } from "./shared";
import logoImg from "@/assets/totem-logo.png";
import wordmarkImg from "@/assets/totem-wordmark.png";
import burgerImg from "@/assets/rubros/burger.jpg";
import cafeImg from "@/assets/rubros/cafe.jpg";
import pizzaImg from "@/assets/rubros/pizza.jpg";
import beerImg from "@/assets/rubros/beer.jpg";
import foodtruckImg from "@/assets/rubros/foodtruck.jpg";
import eventosImg from "@/assets/rubros/eventos.jpg";
import panaderiasImg from "@/assets/rubros/panaderias.jpg";

// Los colores se aplican por CSS vars fijadas en el div raíz según el tema, así
// los componentes helper (TituloSeccion, ContactoForm, Campo) no necesitan
// recibir el color por prop.
const ACENTO = "var(--acc)";
const SERIF = { fontFamily: '"Playfair Display", serif' } as const;

const RUBROS: { img: string; label: string }[] = [
  { img: burgerImg, label: "Hamburgueserías" },
  { img: cafeImg, label: "Cafeterías" },
  { img: pizzaImg, label: "Pizzerías" },
  { img: beerImg, label: "Cervecerías" },
  { img: foodtruckImg, label: "Food trucks" },
  { img: panaderiasImg, label: "Panaderías" },
  { img: eventosImg, label: "Eventos" },
];

const PORQUE: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Rocket,
    title: "Implementación rápida",
    desc: "En días estás tomando pedidos.",
  },
  {
    icon: PaletteIcon,
    title: "A la medida de tu marca",
    desc: "Portada, colores y menú propios.",
  },
  {
    icon: Lock,
    title: "Datos privados",
    desc: "Tu info nunca se mezcla con otra.",
  },
];

const MODULOS: { icon: LucideIcon; nombre: string; desc: string }[] = [
  {
    icon: Boxes,
    nombre: "Catálogo multi-sucursal",
    desc: "Un menú central; cada sucursal activa lo suyo.",
  },
  {
    icon: ChefHat,
    nombre: "Comandera en vivo",
    desc: "Pedidos que entran y avanzan sin recargar.",
  },
  {
    icon: CreditCard,
    nombre: "Cobros con Mercado Pago",
    desc: "Pago por QR a tu cuenta, o efectivo en el mostrador.",
  },
  {
    icon: Package,
    nombre: "Stock automático",
    desc: "Cada venta baja el inventario; si se agota, se oculta.",
  },
  {
    icon: SlidersHorizontal,
    nombre: "Personalización del pedido",
    desc: "El cliente saca ingredientes y suma extras.",
  },
  {
    icon: PaletteIcon,
    nombre: "Portada a tu marca",
    desc: "Plantilla, color y fotos propios.",
  },
  {
    icon: BarChart3,
    nombre: "Recaudación y caja",
    desc: "Ventas, cobros y cierre de caja por sucursal.",
  },
  {
    icon: Users,
    nombre: "Encargados y permisos",
    desc: "Cada uno ve solo lo que maneja.",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "¿Sirve para mi tipo de negocio?",
    a: "Sí. Cualquier casa de comida con mostrador.",
  },
  {
    q: "¿El cliente necesita instalar algo?",
    a: "No. Toca la pantalla y paga por QR.",
  },
  {
    q: "¿Puedo manejar varias sucursales?",
    a: "Sí. Cada una con su menú, precios y permisos.",
  },
  {
    q: "¿Cómo se cobra?",
    a: "Efectivo o Mercado Pago por QR, a tu cuenta.",
  },
  {
    q: "¿Cuánto tarda la implementación?",
    a: "Pocos días. Cargás menú y portada, y arrancás.",
  },
];

const SIN_TOTEM = [
  "Un cajero dedicado en cada turno",
  "Filas que ahuyentan clientes en hora pico",
  "Pedidos mal tomados que se rehacen",
  "Ventas perdidas por no ofrecer combos ni extras",
];

const CON_TOTEM = [
  "El cliente carga su propio pedido",
  "Varios piden a la vez, sin fila",
  "El pedido llega escrito, sin errores",
  "Combos y extras que suben el ticket solos",
];

const GASTOS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Users,
    title: "Personal de caja",
    desc: "Reasignás un cajero a cocina o salón.",
  },
  {
    icon: Trash2,
    title: "Comida perdida",
    desc: "Menos pedidos mal cargados, menos desperdicio.",
  },
  {
    icon: TrendingUp,
    title: "Ventas perdidas",
    desc: "Combos y extras suben el ticket solos.",
  },
  {
    icon: Clock,
    title: "Tiempo administrativo",
    desc: "Cobros y reportes automáticos.",
  },
];

// Revela su contenido cuando entra en pantalla (scroll). Respeta
// prefers-reduced-motion mostrando todo de una.
function Reveal({
  children,
  dir = "up",
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  dir?: "left" | "right" | "up";
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVis(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVis(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const hidden =
    dir === "left" ? "-translate-x-12" : dir === "right" ? "translate-x-12" : "translate-y-10";
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${vis ? "translate-x-0 translate-y-0 opacity-100" : `opacity-0 ${hidden}`} ${className ?? ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function TituloSeccion({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: ACENTO }}>
        {kicker}
      </p>
      <h2 className="mt-3 text-4xl tracking-tight md:text-5xl" style={SERIF}>
        {title}
      </h2>
      {sub && <p className="mt-3 text-lg text-[oklch(0.5_0.02_260)]">{sub}</p>}
    </div>
  );
}

function ContactoForm() {
  function submit(e: React.FormEvent) {
    e.preventDefault();
    toast.success("¡Gracias! Te vamos a contactar a la brevedad.");
    (e.target as HTMLFormElement).reset();
  }
  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-black/5 bg-white/70 p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)] backdrop-blur sm:p-8"
    >
      <h3 className="text-2xl tracking-tight" style={SERIF}>
        Dejanos tus datos y coordinamos una demo
      </h3>
      <p className="mt-1.5 text-sm text-[oklch(0.5_0.02_260)]">
        Completá el formulario y te contactamos.
      </p>
      <div className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nombre" name="nombre" required />
          <Campo label="Apellido" name="apellido" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Email" name="email" type="email" required />
          <Campo label="Negocio" name="org" />
        </div>
        <Campo label="Número de contacto" name="tel" type="tel" required />
        <div>
          <label className="mb-1 block text-xs font-semibold">Mensaje</label>
          <textarea
            name="msg"
            rows={4}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--acc)]"
            placeholder="Contanos sobre tu negocio…"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 font-semibold text-white shadow-lg transition hover:brightness-110"
          style={{ background: ACENTO }}
        >
          Enviar <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold">
        {label}
        {required && <span style={{ color: ACENTO }}> *</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[var(--acc)]"
      />
    </div>
  );
}

// Visual del hero: muestra las fotos de los rubros en uno de tres formatos.
function HeroVisual({ format }: { format: string }) {
  if (format === "carrusel") return <HeroCarrusel />;
  if (format === "pila") return <HeroPila />;
  return <HeroMosaico />;
}

// Mosaico 2x2 con la segunda columna desfasada hacia abajo y un chip de marca
// flotando en el borde inferior (estilo collage de portada).
function HeroMosaico() {
  return (
    <div className="relative mb-6 w-full max-w-md">
      <div className="grid grid-cols-2 items-start gap-3">
        {RUBROS.slice(0, 4).map((r, i) => (
          <div
            key={i}
            className={`group relative overflow-hidden rounded-2xl border border-black/5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.4)] ${i % 2 === 1 ? "mt-10" : ""}`}
          >
            <img
              src={r.img}
              alt={r.label}
              loading="lazy"
              className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          </div>
        ))}
      </div>

      <div className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-black/5 bg-white px-5 py-2.5 shadow-xl">
        <img src={logoImg} alt="" className="h-7 w-auto" />
        <img src={wordmarkImg} alt="Totempoint" className="h-4 w-auto" />
      </div>
    </div>
  );
}

// Una sola foto que rota sola, con crossfade, label y chip de QR.
function HeroCarrusel() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIdx((v) => (v + 1) % RUBROS.length), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative w-full max-w-sm">
      <div
        className="absolute inset-0 rounded-[2.5rem] opacity-30 blur-3xl"
        style={{ backgroundColor: "var(--blob1)" }}
      />
      <div className="relative aspect-[3/4] overflow-hidden rounded-[2.5rem] border border-black/5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.4)]">
        {RUBROS.map((r, i) => (
          <img
            key={i}
            src={r.img}
            alt={r.label}
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === idx ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span className="absolute bottom-5 left-5 text-xl font-semibold text-white">
          {RUBROS[idx].label}
        </span>
        <div
          className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ background: ACENTO }}
        >
          <QrCode className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// Tres fotos apiladas en abanico, con flote suave.
function HeroPila() {
  const cfg = [
    { rot: -8, x: -34 },
    { rot: 6, x: 34 },
    { rot: -2, x: 0 },
  ];
  return (
    <div className="aur-float relative h-[26rem] w-full max-w-sm">
      {RUBROS.slice(0, 3).map((r, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 h-72 w-56 overflow-hidden rounded-3xl border-4 border-white shadow-2xl"
          style={{
            transform: `translate(-50%, -50%) translateX(${cfg[i].x}px) rotate(${cfg[i].rot}deg)`,
            zIndex: i + 1,
          }}
        >
          <img src={r.img} alt={r.label} loading="lazy" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          <span className="absolute bottom-3 left-3 text-sm font-semibold text-white">
            {r.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// Aurora: fondo claro, aire, tipografía Playfair. Auroras de color a la deriva
// detrás del contenido; el hero entra con fade-up y el resto se revela al
// scrollear. Estructura larga de página de venta.
export function VariantAurora({
  theme,
  subFont,
  heroFormat,
}: {
  theme: AuroraTheme;
  subFont: string;
  heroFormat: string;
}) {
  const [vista, setVista] = useState<"home" | "faq" | "contacto">("home");

  // Cada pantalla arranca desde arriba al cambiar de vista.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [vista]);

  return (
    <div
      className="aur-root relative min-h-dvh overflow-x-hidden text-[oklch(0.22_0.03_260)] antialiased"
      style={
        {
          backgroundColor: "var(--bg)",
          "--acc": theme.accent,
          "--bg": theme.bg,
          "--hero-grad": theme.heroGrad,
          "--sub": subFont,
          "--blob1": theme.blobs[0],
          "--blob2": theme.blobs[1],
          "--blob3": theme.blobs[2],
        } as React.CSSProperties
      }
    >
      <style>{`
        @keyframes aur-drift {
          0%   { transform: translate3d(0,0,0) scale(1); }
          50%  { transform: translate3d(6%,4%,0) scale(1.15); }
          100% { transform: translate3d(0,0,0) scale(1); }
        }
        @keyframes aur-up {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes aur-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes aur-flow { to { background-position: 200% center; } }
        @keyframes aur-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .aur-blob { animation: aur-drift 18s ease-in-out infinite; }
        .aur-up { animation: aur-up 700ms cubic-bezier(0.22,1,0.36,1) both; }
        .aur-marquee { animation: aur-marquee 32s linear infinite; }
        .aur-flow { background-size: 200% auto; animation: aur-flow 4s linear infinite; }
        .aur-float { animation: aur-float 6s ease-in-out infinite; }
        /* Títulos de card (h3/h4) con la fuente elegida. Los títulos grandes de
           sección van con font-family inline (Playfair) y no se ven afectados. */
        .aur-root h3, .aur-root h4 { font-family: var(--sub); }
        @media (prefers-reduced-motion: reduce){ .aur-blob,.aur-up,.aur-marquee,.aur-flow,.aur-float{ animation:none } }
      `}</style>

      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="aur-blob absolute -top-32 -left-24 h-[34rem] w-[34rem] rounded-full opacity-50 blur-[130px]"
          style={{ backgroundColor: "var(--blob1)" }}
        />
        <div
          className="aur-blob absolute top-1/4 right-[-8rem] h-[30rem] w-[30rem] rounded-full opacity-40 blur-[130px]"
          style={{ backgroundColor: "var(--blob2)", animationDelay: "4s" }}
        />
        <div
          className="aur-blob absolute bottom-[-10rem] left-1/3 h-[32rem] w-[32rem] rounded-full opacity-40 blur-[130px]"
          style={{ backgroundColor: "var(--blob3)", animationDelay: "8s" }}
        />
      </div>

      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
          <button
            type="button"
            onClick={() => setVista("home")}
            className="flex items-center gap-2.5"
          >
            <img src={logoImg} alt="" className="h-10 w-auto" />
            <img src={wordmarkImg} alt="Totempoint" className="h-6 w-auto" />
          </button>
          <nav className="hidden items-center gap-7 text-sm text-[oklch(0.45_0.02_260)] md:flex">
            {(
              [
                ["home", "Inicio"],
                ["faq", "Preguntas frecuentes"],
                ["contacto", "Contacto"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setVista(id)}
                className={`transition hover:text-[oklch(0.22_0.03_260)] ${vista === id ? "font-semibold text-[oklch(0.22_0.03_260)]" : ""}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
            style={{ background: ACENTO }}
          >
            <MessageCircle className="h-4 w-4" />
            Solicitar demo
          </a>
        </div>
      </header>

      <main className="relative z-10">
        {vista === "home" && (
          <>
            {/* HERO — ocupa el alto de la ventana menos el header sticky */}
            <section className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-6xl content-center items-center gap-10 px-6 py-16 md:grid-cols-2 md:px-10">
              <div>
                <div
                  className="aur-up inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.55_0.12_30)] backdrop-blur"
                  style={{ animationDelay: "40ms" }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Autoservicio para gastronomía
                </div>
                <h1
                  className="aur-up mt-8 text-5xl leading-[1.02] tracking-tight sm:text-6xl md:text-7xl"
                  style={{ ...SERIF, animationDelay: "120ms" }}
                >
                  Tu negocio,
                  <br />
                  <span
                    className="aur-flow bg-clip-text text-transparent"
                    style={{ backgroundImage: "var(--hero-grad)" }}
                  >
                    en piloto automático
                  </span>
                </h1>
                <p
                  className="aur-up mt-7 max-w-xl text-lg text-[oklch(0.45_0.02_260)] md:text-xl"
                  style={{ animationDelay: "200ms" }}
                >
                  El cliente pide desde la pantalla, paga y la comanda llega sola a la cocina. Menos
                  fila, menos errores y una caja que cuadra al final del día.
                </p>
                <div
                  className="aur-up mt-10 flex flex-wrap gap-3"
                  style={{ animationDelay: "280ms" }}
                >
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-lg font-semibold text-white shadow-xl transition hover:-translate-y-0.5 hover:brightness-110"
                    style={{ background: ACENTO }}
                  >
                    <MessageCircle className="h-5 w-5" />
                    Solicitar una demo
                  </a>
                  <a
                    href="#modulos"
                    className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/70 px-8 py-4 text-lg font-semibold backdrop-blur transition hover:border-black/30"
                  >
                    Ver cómo funciona
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </div>
              </div>

              <div className="aur-up flex justify-center" style={{ animationDelay: "220ms" }}>
                <HeroVisual format={heroFormat} />
              </div>
            </section>

            {/* ALCANCE / RUBROS */}
            <section id="rubros" className="py-16">
              <div className="mx-auto max-w-6xl px-6 md:px-10">
                <Reveal>
                  <TituloSeccion
                    kicker="Alcance"
                    title="Un sistema, muchos rubros"
                    sub="Pensado para cualquier casa de comida con mostrador."
                  />
                </Reveal>
              </div>
              <div className="mt-10 overflow-hidden">
                <div className="aur-marquee flex w-max gap-4">
                  {[...RUBROS, ...RUBROS].map((r, i) => (
                    <div
                      key={i}
                      className="group relative h-56 w-72 shrink-0 overflow-hidden rounded-3xl border border-black/5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]"
                    >
                      <img
                        src={r.img}
                        alt={r.label}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <span className="absolute bottom-4 left-4 text-lg font-semibold tracking-tight text-white">
                        {r.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* BENEFICIOS */}
            <section className="mx-auto max-w-6xl px-6 py-16 md:px-10">
              <Reveal>
                <div className="mx-auto mb-12 max-w-2xl text-center">
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.3em]"
                    style={{ color: ACENTO }}
                  >
                    Por qué conviene
                  </p>
                  <h2 className="mt-3 text-4xl tracking-tight md:text-5xl" style={SERIF}>
                    Menos costos, más ventas, menos complicaciones
                  </h2>
                </div>
              </Reveal>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {BENEFICIOS.map((b, i) => (
                  <Reveal
                    key={b.title}
                    dir={i % 3 === 0 ? "left" : i % 3 === 2 ? "right" : "up"}
                    delay={(i % 3) * 80}
                  >
                    <div className="flex h-full gap-4 rounded-3xl border border-black/5 bg-white/70 p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-black/10 hover:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                        style={{
                          background: "color-mix(in oklab, var(--acc) 12%, white)",
                          color: ACENTO,
                        }}
                      >
                        <b.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold tracking-tight">{b.title}</h3>
                        <p className="mt-1.5 text-sm text-[oklch(0.5_0.02_260)]">{b.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>

            {/* AHORRO / ROI */}
            <section
              id="ahorro"
              className="py-16"
              style={{ backgroundColor: "color-mix(in oklab, var(--acc) 5%, transparent)" }}
            >
              <div className="mx-auto max-w-6xl px-6 md:px-10">
                <Reveal>
                  <TituloSeccion
                    kicker="Cuentas claras"
                    title="¿Por qué implementar un tótem?"
                    sub="Lo que hoy pagás en caja, errores y ventas perdidas empieza a quedarse de tu lado."
                  />
                </Reveal>

                <div className="mt-12 grid gap-6 md:grid-cols-2">
                  <Reveal dir="left">
                    <div className="h-full rounded-3xl border border-black/5 bg-white/70 p-8 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
                      <h3 className="text-lg font-semibold tracking-tight text-[oklch(0.5_0.02_260)]">
                        Sin tótem
                      </h3>
                      <ul className="mt-5 space-y-3">
                        {SIN_TOTEM.map((t) => (
                          <li
                            key={t}
                            className="flex items-start gap-3 text-sm text-[oklch(0.45_0.02_260)]"
                          >
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[oklch(0.6_0.24_27)]/10 text-[oklch(0.55_0.24_27)]">
                              <X className="h-3.5 w-3.5" />
                            </span>
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Reveal>

                  <Reveal dir="right" delay={100}>
                    <div
                      className="h-full rounded-3xl border p-8 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-30px_rgba(0,0,0,0.4)]"
                      style={{
                        borderColor: "color-mix(in oklab, var(--acc) 25%, transparent)",
                        backgroundColor: "color-mix(in oklab, var(--acc) 8%, white)",
                      }}
                    >
                      <h3
                        className="text-lg font-semibold tracking-tight"
                        style={{ color: ACENTO }}
                      >
                        Con tótem
                      </h3>
                      <ul className="mt-5 space-y-3">
                        {CON_TOTEM.map((t) => (
                          <li key={t} className="flex items-start gap-3 text-sm">
                            <span
                              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                              style={{ background: ACENTO }}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Reveal>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {GASTOS.map((g, i) => (
                    <Reveal key={g.title} delay={i * 80}>
                      <div className="group h-full rounded-3xl border border-black/5 bg-white/70 p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-black/10 hover:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110"
                          style={{ background: ACENTO }}
                        >
                          <g.icon className="h-5 w-5" />
                        </div>
                        <h4 className="mt-4 font-semibold tracking-tight">{g.title}</h4>
                        <p className="mt-1.5 text-sm text-[oklch(0.5_0.02_260)]">{g.desc}</p>
                      </div>
                    </Reveal>
                  ))}
                </div>

                <Reveal delay={120}>
                  <div className="mx-auto mt-10 flex max-w-3xl items-center gap-4 rounded-3xl border border-black/5 bg-white/80 p-6 text-left shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-30px_rgba(0,0,0,0.4)] sm:p-8">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
                      style={{ background: ACENTO }}
                    >
                      <PiggyBank className="h-7 w-7" />
                    </div>
                    <p className="text-base text-[oklch(0.4_0.02_260)] sm:text-lg">
                      El ahorro de un solo turno de caja suele cubrir el costo del tótem.{" "}
                      <span className="font-semibold text-[oklch(0.22_0.03_260)]">
                        Lo demás es margen.
                      </span>
                    </p>
                  </div>
                </Reveal>
              </div>
            </section>

            {/* POR QUÉ ELEGIRNOS */}
            <section
              id="porque"
              className="py-16"
              style={{ backgroundColor: "color-mix(in oklab, var(--acc) 5%, transparent)" }}
            >
              <div className="mx-auto max-w-6xl px-6 md:px-10">
                <Reveal>
                  <TituloSeccion
                    kicker="¿Por qué elegirnos?"
                    title="Rápido, a tu medida y seguro"
                    sub="Implementación ágil, tótem con tu marca y datos privados por empresa."
                  />
                </Reveal>
                <div className="mt-12 grid gap-4 md:grid-cols-3">
                  {PORQUE.map((b, i) => (
                    <Reveal
                      key={b.title}
                      dir={i === 0 ? "left" : i === 2 ? "right" : "up"}
                      delay={i * 100}
                    >
                      <div className="h-full rounded-3xl border border-black/5 bg-white/80 p-8 text-center shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)] backdrop-blur">
                        <div
                          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
                          style={{ background: ACENTO }}
                        >
                          <b.icon className="h-7 w-7" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold tracking-tight">{b.title}</h3>
                        <p className="mt-2 text-sm text-[oklch(0.5_0.02_260)]">{b.desc}</p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </section>

            {/* MÓDULOS (zig-zag) */}
            <section id="modulos" className="mx-auto max-w-5xl px-6 py-16 md:px-10">
              <Reveal>
                <TituloSeccion kicker="Qué incluye" title="Funcionalidades" />
              </Reveal>
              <div className="mt-12 space-y-6">
                {MODULOS.map((m, i) => (
                  <Reveal key={m.nombre} dir={i % 2 === 0 ? "left" : "right"}>
                    <div
                      className={`flex items-center gap-6 rounded-3xl border border-black/5 bg-white/70 p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)] backdrop-blur sm:p-8 ${i % 2 ? "sm:flex-row-reverse sm:text-right" : ""}`}
                    >
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
                        style={{ background: ACENTO }}
                      >
                        <m.icon className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight">{m.nombre}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-[oklch(0.5_0.02_260)]">
                          {m.desc}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className="mx-auto max-w-5xl px-6 py-16 md:px-10">
              <Reveal>
                <div
                  className="relative overflow-hidden rounded-[2.5rem] border p-10 text-center sm:p-14"
                  style={{
                    borderColor: "color-mix(in oklab, var(--acc) 25%, transparent)",
                    backgroundColor: "color-mix(in oklab, var(--acc) 8%, transparent)",
                  }}
                >
                  <div
                    className="absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full opacity-30 blur-[100px]"
                    style={{ backgroundColor: "var(--blob1)" }}
                  />
                  <h2 className="relative text-4xl tracking-tight md:text-5xl" style={SERIF}>
                    Poné tu mostrador en piloto automático
                  </h2>
                  <p className="relative mx-auto mt-4 max-w-lg text-lg text-[oklch(0.5_0.02_260)]">
                    Escribinos por WhatsApp y coordinamos una demo con el menú de tu negocio.
                  </p>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="relative mt-9 inline-flex items-center gap-2 rounded-full px-9 py-4 text-lg font-semibold text-white shadow-xl transition hover:-translate-y-0.5 hover:brightness-110"
                    style={{ background: ACENTO }}
                  >
                    <MessageCircle className="h-5 w-5" />
                    Solicitar una demo
                  </a>
                </div>
              </Reveal>
            </section>
          </>
        )}

        {/* PANTALLA FAQ */}
        {vista === "faq" && (
          <section className="mx-auto max-w-5xl px-6 py-20 md:px-10 md:py-24">
            <Reveal>
              <TituloSeccion kicker="Ayuda" title="Preguntas frecuentes" />
            </Reveal>
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {FAQS.map((f, i) => (
                <Reveal key={f.q} dir={i % 2 === 0 ? "left" : "right"} delay={(i % 2) * 80}>
                  <div className="h-full rounded-3xl border border-black/5 bg-white/70 p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: "color-mix(in oklab, var(--acc) 12%, white)",
                          color: ACENTO,
                        }}
                      >
                        <HelpCircle className="h-5 w-5" />
                      </span>
                      <h3 className="pt-1 font-semibold tracking-tight">{f.q}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-[oklch(0.5_0.02_260)]">{f.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="mt-12 text-center">
              <button
                type="button"
                onClick={() => setVista("contacto")}
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:brightness-110"
                style={{ background: ACENTO }}
              >
                ¿Otra duda? Escribinos
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {/* PANTALLA CONTACTO */}
        {vista === "contacto" && (
          <section className="mx-auto max-w-3xl px-6 py-20 md:px-10 md:py-24">
            <Reveal>
              <div className="mb-10 text-center">
                <p
                  className="text-xs font-semibold uppercase tracking-[0.3em]"
                  style={{ color: ACENTO }}
                >
                  Contacto
                </p>
                <h1 className="mt-3 text-4xl tracking-tight md:text-5xl" style={SERIF}>
                  ¿Listo para empezar?
                </h1>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <ContactoForm />
            </Reveal>
          </section>
        )}
      </main>

      <footer className="border-t border-black/5 px-6 py-8 text-center text-sm text-[oklch(0.55_0.02_260)] md:px-10">
        Totempoint — autoservicio para casas de comida
      </footer>

      {/* WhatsApp flotante */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        title="Contacto por WhatsApp"
        aria-label="Contacto por WhatsApp"
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:brightness-110"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
}

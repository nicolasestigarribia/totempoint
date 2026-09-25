import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Monitor,
  LogIn,
  Store,
  Users,
  Receipt,
  Loader2,
  MessageCircle,
  QrCode,
  ChefHat,
  CreditCard,
  Boxes,
  Palette,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { esAppNativa } from "@/lib/print/native";
import { getTotemUrl } from "@/lib/native/provisioning";
import { TotemSetupScreen } from "@/components/totem/TotemSetupScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Totempoint — El autoservicio que atiende por vos" },
      {
        name: "description",
        content:
          "Tótems de autoservicio para bares, sanguicherías y casas de comida: el cliente pide desde la pantalla, la comanda llega a la cocina y vos administrás todo desde el panel.",
      },
    ],
  }),
  component: Home,
});

// TODO: reemplazar por el número real de WhatsApp (formato internacional sin +,
// espacios ni guiones, ej. 5491112345678). Placeholder hasta que lo dé Nicolas.
const WHATSAPP_NUMERO = "5490000000000";
const WHATSAPP_MENSAJE = encodeURIComponent("Hola, quiero conocer Totempoint para mi negocio.");
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}?text=${WHATSAPP_MENSAJE}`;

const PASOS = [
  {
    n: "01",
    icon: Monitor,
    title: "El cliente pide solo",
    desc: "Ponés una tablet en el mostrador. El cliente arma su pedido, saca lo que no quiere y paga, sin depender de que haya alguien en la caja.",
  },
  {
    n: "02",
    icon: Receipt,
    title: "La comanda llega a la cocina",
    desc: "Cada pedido entra con su número del día y su detalle en la comandera, listo para preparar y cantar cuando está.",
  },
  {
    n: "03",
    icon: Store,
    title: "Vos administrás todo",
    desc: "Menú, precios, disponibilidad, stock y recaudación de cada sucursal desde un panel, con permisos para cada encargado.",
  },
];

const FEATURES = [
  {
    icon: Boxes,
    title: "Un catálogo, muchas sucursales",
    desc: "Armás el menú de la empresa una vez y cada sucursal activa lo que vende y con qué precio.",
  },
  {
    icon: ChefHat,
    title: "Comandera en vivo",
    desc: "Los pedidos entran solos, avanzan de estado y la cocina ve qué falta sin recargar la pantalla.",
  },
  {
    icon: CreditCard,
    title: "Cobro con Mercado Pago",
    desc: "El cliente paga escaneando un QR desde su teléfono, y la plata entra a la cuenta de tu empresa.",
  },
  {
    icon: Boxes,
    title: "Stock que se descuenta solo",
    desc: "Cada venta baja el inventario según la receta; si algo se agota, deja de ofrecerse en el tótem.",
  },
  {
    icon: Users,
    title: "Encargados con permisos",
    desc: "Das de alta a tu gente y cada uno ve solamente las sucursales y las secciones que maneja.",
  },
  {
    icon: Palette,
    title: "Portada a tu marca",
    desc: "Elegís plantilla, color, foto y textos de la pantalla de bienvenida. El tótem se ve como tu negocio.",
  },
];

function Home() {
  // En la app nativa la raíz no es la landing: si la tablet ya está pegada a un
  // tótem, va directo ahí; si no, muestra el wizard de setup. En el navegador
  // (web) es siempre la landing de la plataforma.
  const [modo, setModo] = useState<"web" | "cargando" | "setup">("web");

  useEffect(() => {
    if (!esAppNativa()) return;
    setModo("cargando");
    void (async () => {
      const url = await getTotemUrl();
      if (url) window.location.replace(url);
      else setModo("setup");
    })();
  }, []);

  if (modo === "cargando") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (modo === "setup") return <TotemSetupScreen />;

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background text-foreground">
      {/* Atmósfera del fondo: brasa arriba, un resplandor dorado abajo y una
          malla de puntos apenas visible que le da textura sin robar foco. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute bottom-0 right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-gold/15 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, color-mix(in oklab, var(--primary) 22%, transparent) 1px, transparent 1px)",
            backgroundSize: "38px 38px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent)",
          }}
        />
      </div>

      {/* Motas de brasa que suben flotando (reusa .flota de styles.css). */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {MOTAS.map((m, i) => (
          <span
            key={i}
            className="flota absolute bottom-0 block h-1.5 w-1.5 rounded-full bg-gold/70"
            style={
              {
                left: m.left,
                "--dura": m.dura,
                "--demora": m.demora,
                "--deriva": m.deriva,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 md:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
              <Monitor className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl tracking-wide">Totempoint</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-2 rounded-xl bg-gradient-gold px-4 py-2.5 text-sm font-bold text-gold-foreground shadow-glow transition hover:opacity-90 sm:inline-flex"
            >
              <MessageCircle className="h-4 w-4" />
              Pedir demo
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:border-primary hover:text-foreground"
            >
              <LogIn className="h-4 w-4" />
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* HERO */}
        <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-20 pt-16 text-center md:px-10 md:pt-24">
          <div
            className="aparece inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-gold"
            style={{ animationDelay: "40ms" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Autoservicio para casas de comida
          </div>

          <h1
            className="aparece mt-8 max-w-4xl font-display text-6xl leading-[0.9] sm:text-7xl md:text-8xl"
            style={{ animationDelay: "120ms" }}
          >
            El mostrador que
            <br />
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              atiende por vos
            </span>
          </h1>

          <p
            className="aparece mt-7 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl"
            style={{ animationDelay: "200ms" }}
          >
            El cliente pide desde la pantalla, paga y la comanda llega sola a la cocina. Menos cola,
            menos errores y una caja que cuadra al final del día.
          </p>

          <div
            className="aparece mt-10 flex flex-col items-center gap-3 sm:flex-row"
            style={{ animationDelay: "280ms" }}
          >
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="late inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-glow transition hover:opacity-90"
              style={
                {
                  "--halo": "color-mix(in oklab, var(--primary) 45%, transparent)",
                } as React.CSSProperties
              }
            >
              <MessageCircle className="h-5 w-5" />
              Pedir una demo
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-border px-8 py-4 text-lg font-semibold transition hover:border-primary"
            >
              Entrar al panel
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          <p
            className="aparece mt-6 text-sm text-muted-foreground"
            style={{ animationDelay: "340ms" }}
          >
            ¿Sos cliente de un local? El tótem se abre con el enlace que te da la sucursal.
          </p>
        </section>

        {/* CÓMO FUNCIONA */}
        <section className="mx-auto max-w-6xl px-6 py-20 md:px-10">
          <div className="mb-14 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
              Cómo funciona
            </p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">Tres pasos, cero fricción</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {PASOS.map((p) => (
              <div
                key={p.n}
                className="group relative overflow-hidden rounded-3xl border border-border bg-card/50 p-8 backdrop-blur transition hover:border-primary/60 hover:shadow-card"
              >
                <span className="font-display text-7xl text-primary/15 transition group-hover:text-primary/25">
                  {p.n}
                </span>
                <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
                  <p.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="mt-5 font-display text-2xl">{p.title}</h3>
                <p className="mt-2 text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* QUÉ INCLUYE */}
        <section className="mx-auto max-w-6xl px-6 py-20 md:px-10">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Todo adentro</p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">
              No es solo una pantalla linda
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Es la trastienda completa: catálogo multi-sucursal, cocina, cobros, stock y permisos,
              trabajando juntos.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur transition hover:-translate-y-1 hover:border-primary/50"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PERSONALIZACIÓN / MARCA */}
        <section className="mx-auto max-w-6xl px-6 py-20 md:px-10">
          <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card/50 p-10 backdrop-blur md:p-16">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-gold opacity-20 blur-3xl" />
            <div className="relative grid items-center gap-10 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Tu marca</p>
                <h2 className="mt-3 font-display text-4xl md:text-5xl">
                  El tótem se ve como tu negocio
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Plantilla, color, foto de portada y textos: la pantalla de bienvenida sale con la
                  identidad de tu local, no con la nuestra. Todo se edita desde el panel y se
                  previsualiza antes de publicar.
                </p>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-gold px-6 py-3 font-bold text-gold-foreground shadow-glow transition hover:opacity-90"
                >
                  <MessageCircle className="h-5 w-5" />
                  Quiero verlo con mi marca
                </a>
              </div>
              <div className="flex items-center justify-center">
                <div className="flex aspect-[4/3] w-full max-w-sm flex-col items-center justify-center gap-4 rounded-3xl border border-border bg-gradient-hero p-8 text-center shadow-card">
                  <QrCode className="h-14 w-14 text-primary" />
                  <p className="font-display text-3xl">Escaneá y pagá</p>
                  <p className="text-sm text-muted-foreground">
                    El cobro se resuelve en el teléfono del cliente, sin pasar por la caja.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="mx-auto max-w-4xl px-6 py-24 text-center md:px-10">
          <h2 className="font-display text-5xl md:text-6xl">
            Ponelo a atender <span className="text-primary">esta semana</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Escribinos por WhatsApp y coordinamos una demo con el menú de tu negocio. Al dueño lo
            damos de alta nosotros; vos solo cargás lo tuyo.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="late mt-10 inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-10 py-5 text-xl font-bold text-primary-foreground shadow-glow transition hover:opacity-90"
            style={
              {
                "--halo": "color-mix(in oklab, var(--primary) 45%, transparent)",
              } as React.CSSProperties
            }
          >
            <MessageCircle className="h-6 w-6" />
            Pedir una demo
          </a>
        </section>
      </main>

      <footer className="border-t border-border/40 px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-primary">
              <Monitor className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg tracking-wide text-foreground">Totempoint</span>
          </div>
          <span>Autoservicio para casas de comida</span>
          <Link to="/login" className="transition hover:text-foreground">
            Iniciar sesión
          </Link>
        </div>
      </footer>
    </div>
  );
}

// Posiciones fijas de las motas de brasa: sin random para que SSR y cliente
// pinten lo mismo y no haya parpadeo de hidratación.
const MOTAS = [
  { left: "8%", dura: "16s", demora: "0s", deriva: "20px" },
  { left: "22%", dura: "13s", demora: "3s", deriva: "-16px" },
  { left: "37%", dura: "18s", demora: "1.5s", deriva: "24px" },
  { left: "54%", dura: "15s", demora: "5s", deriva: "-22px" },
  { left: "68%", dura: "12s", demora: "2s", deriva: "18px" },
  { left: "81%", dura: "17s", demora: "4s", deriva: "-14px" },
  { left: "93%", dura: "14s", demora: "6s", deriva: "26px" },
];

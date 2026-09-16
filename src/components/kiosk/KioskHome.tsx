import { Link } from "@tanstack/react-router";
import { Sparkles, ChevronRight, Store } from "lucide-react";
import type { KioskHome as KioskHomeData } from "@/lib/api/kiosk.functions";

const FALLBACK_ACCENT = "var(--gold, #f5b800)";

function Badges({ data, className = "" }: { data: KioskHomeData; className?: string }) {
  const badges = [data.badge1, data.badge2].filter(Boolean) as string[];
  if (badges.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {badges.map((b) => (
        <div
          key={b}
          className="flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-2 backdrop-blur"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {b}
          </span>
        </div>
      ))}
    </div>
  );
}

function Logo({ data }: { data: KioskHomeData }) {
  const accent = data.accentColor || data.primaryColor || undefined;
  return (
    <div className="flex items-center gap-4">
      <div
        className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl shadow-glow"
        style={{ background: accent ?? undefined }}
      >
        {data.logoUrl ? (
          <img src={data.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Store className="h-8 w-8 text-white" />
        )}
      </div>
      <div>
        {data.eyebrow && (
          <div
            className="text-xs font-semibold uppercase tracking-[0.3em]"
            style={{ color: accent }}
          >
            {data.eyebrow}
          </div>
        )}
        <div className="font-display text-2xl tracking-wide md:text-3xl">{data.name}</div>
      </div>
    </div>
  );
}

function StartButton({ data, size = "lg" }: { data: KioskHomeData; size?: "lg" | "xl" }) {
  const accent = data.accentColor || data.primaryColor || undefined;
  return (
    <Link
      to="/k/$slug/categorias"
      params={{ slug: data.slug }}
      className={`group flex w-full items-center justify-between gap-4 rounded-3xl shadow-glow transition hover:scale-[1.02] active:scale-[0.98] ${
        size === "xl" ? "px-12 py-10" : "px-10 py-8"
      }`}
      style={{ background: accent ?? "var(--primary)" }}
    >
      <span
        className={`font-display uppercase tracking-wide text-white ${
          size === "xl" ? "text-4xl md:text-5xl" : "text-3xl md:text-4xl"
        }`}
      >
        {data.ctaLabel}
      </span>
      <ChevronRight
        className={`text-white transition group-hover:translate-x-1 ${size === "xl" ? "h-10 w-10" : "h-8 w-8"}`}
      />
    </Link>
  );
}

function Title({ data, className = "" }: { data: KioskHomeData; className?: string }) {
  const accent = data.accentColor || data.primaryColor || FALLBACK_ACCENT;
  return (
    <h1 className={`font-display leading-[0.85] ${className}`}>
      <span className="block">{data.title}</span>
      {data.titleAccent && (
        <span className="block" style={{ color: accent }}>
          {data.titleAccent}
        </span>
      )}
    </h1>
  );
}

// Hero lateral: imagen de fondo difuminada, texto a la izquierda, botón a la derecha.
function Clasico({ data }: { data: KioskHomeData }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {data.heroImageUrl && (
        <img
          src={data.heroImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />

      <div className="relative z-10 flex flex-1 flex-col px-6 py-8 md:px-14 md:py-10">
        <div className="grid flex-1 grid-cols-1 items-center gap-10 py-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            {data.eyebrow && (
              <div className="flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/70 px-5 py-2 backdrop-blur">
                <Sparkles className="h-4 w-4" style={{ color: data.accentColor || undefined }} />
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
                  {data.eyebrow}
                </span>
              </div>
            )}
            <Logo data={data} />
            <Title data={data} className="text-7xl sm:text-8xl md:text-9xl" />
            {data.subtitle && (
              <p className="max-w-md text-balance text-lg text-muted-foreground md:text-xl">
                {data.subtitle}
              </p>
            )}
            <Badges data={data} />
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <div className="w-full max-w-md">
              <StartButton data={data} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Pantalla completa: imagen a sangre, todo centrado. Ideal para discotecas/eventos.
function Completo({ data }: { data: KioskHomeData }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background text-center">
      {data.heroImageUrl && (
        <img
          src={data.heroImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-8 px-6 py-12">
        <Logo data={data} />
        <Title data={data} className="text-6xl sm:text-7xl md:text-8xl" />
        {data.subtitle && (
          <p className="text-balance text-xl text-muted-foreground">{data.subtitle}</p>
        )}
        <Badges data={data} className="justify-center" />
        <div className="w-full max-w-xl">
          <StartButton data={data} size="xl" />
        </div>
      </div>
    </div>
  );
}

// Split: mitad imagen, mitad panel sólido. Look de carta/menú sobrio.
function Split({ data }: { data: KioskHomeData }) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <div className="relative min-h-[35vh] flex-1 overflow-hidden lg:min-h-screen">
        {data.heroImageUrl ? (
          <img src={data.heroImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent lg:bg-gradient-to-r" />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-7 px-8 py-10 md:px-14">
        <Logo data={data} />
        <Title data={data} className="text-6xl md:text-7xl" />
        {data.subtitle && (
          <p className="max-w-lg text-balance text-lg text-muted-foreground">{data.subtitle}</p>
        )}
        <Badges data={data} />
        <div className="max-w-lg">
          <StartButton data={data} />
        </div>
      </div>
    </div>
  );
}

export function KioskHome({ data }: { data: KioskHomeData }) {
  if (data.template === "completo") return <Completo data={data} />;
  if (data.template === "split") return <Split data={data} />;
  return <Clasico data={data} />;
}

import { Link } from "@tanstack/react-router";
import { Sparkles, ChevronRight, Store } from "lucide-react";
import type { TotemHome as TotemHomeData } from "@/lib/api/totem.functions";
import { themeVars } from "@/components/totem/useTotemTheme";
import { TotemMotas } from "@/components/totem/TotemMotas";

const FALLBACK_ACCENT = "var(--gold, #f5b800)";

function Badges({ data, className = "" }: { data: TotemHomeData; className?: string }) {
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

/**
 * El logo con el nombre del negocio, y encima el eyebrow.
 *
 * `conEyebrow` existe porque la plantilla Clásica ya lo muestra como cartelito
 * aparte: repetirlo acá hacía que "Sanguchería de miga" apareciera dos veces
 * en la misma pantalla, a dos centímetros de distancia.
 */
function Logo({ data, conEyebrow = true }: { data: TotemHomeData; conEyebrow?: boolean }) {
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
        {conEyebrow && data.eyebrow && (
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

function StartButton({ data, size = "lg" }: { data: TotemHomeData; size?: "lg" | "xl" }) {
  const accent = data.accentColor || data.primaryColor || undefined;
  return (
    <Link
      to="/t/$slug/categorias"
      params={{ slug: data.slug }}
      className={`late group flex w-full items-center justify-between gap-4 rounded-3xl transition hover:scale-[1.02] active:scale-[0.98] ${
        size === "xl" ? "px-12 py-10" : "px-10 py-8"
      }`}
      style={
        {
          background: accent ?? "var(--primary)",
          // El halo late en el color de la marca, no en blanco.
          "--halo": `color-mix(in oklab, ${accent ?? "var(--primary)"} 55%, transparent)`,
        } as React.CSSProperties
      }
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

function Title({ data, className = "" }: { data: TotemHomeData; className?: string }) {
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
function Clasico({ data }: { data: TotemHomeData }) {
  // Sin overflow-hidden en el contenedor: si el contenido es más alto que la
  // pantalla (celular apaisado, tablet chica) hay que poder deslizar, no recortar.
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      {data.heroImageUrl && (
        /* El recorte va en un envoltorio y no en el contenedor de la
           pantalla: al ampliarse, la foto se sale de la caja y aparece una
           barra de scroll horizontal, pero el contenedor tiene que seguir
           dejando deslizar hacia abajo si el contenido no entra. */
        <div className="absolute inset-0 overflow-hidden">
          <img src={data.heroImageUrl} alt="" className="respira h-full w-full object-cover" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />
      <TotemMotas accent={data.accentColor || data.primaryColor || undefined} />

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
            <Logo data={data} conEyebrow={false} />
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
function Completo({ data }: { data: TotemHomeData }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background text-center">
      {data.heroImageUrl && (
        /* El recorte va en un envoltorio y no en el contenedor de la
           pantalla: al ampliarse, la foto se sale de la caja y aparece una
           barra de scroll horizontal, pero el contenedor tiene que seguir
           dejando deslizar hacia abajo si el contenido no entra. */
        <div className="absolute inset-0 overflow-hidden">
          <img src={data.heroImageUrl} alt="" className="respira h-full w-full object-cover" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <TotemMotas accent={data.accentColor || data.primaryColor || undefined} />

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
function Split({ data }: { data: TotemHomeData }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <div className="relative min-h-[35dvh] flex-1 overflow-hidden lg:min-h-dvh">
        {data.heroImageUrl ? (
          <img src={data.heroImageUrl} alt="" className="respira h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent lg:bg-gradient-to-r" />
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-8 py-10 md:px-14">
        <TotemMotas accent={data.accentColor || data.primaryColor || undefined} />
        {/* El contenido va elevado para que las motas queden detrás del texto. */}
        <div className="relative z-10 flex flex-col gap-7">
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
    </div>
  );
}

export function TotemHome({ data }: { data: TotemHomeData }) {
  const plantilla =
    data.template === "completo" ? (
      <Completo data={data} />
    ) : data.template === "split" ? (
      <Split data={data} />
    ) : (
      <Clasico data={data} />
    );

  // Los tokens van inline además de en el documento: así la vista previa del
  // panel, que vive en un iframe aparte, muestra la base de color elegida.
  return (
    <div
      // La clase va acá además del documento: la vista previa del panel vive en
      // un iframe y monta esto sin pasar por el hook que la agrega arriba.
      className="totem-tipografia"
      style={
        themeVars(data.accentColor, data.theme, data.fontTheme, data.corners) as React.CSSProperties
      }
    >
      {plantilla}
    </div>
  );
}

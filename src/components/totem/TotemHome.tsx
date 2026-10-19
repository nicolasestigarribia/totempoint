import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import type { TotemHome as TotemHomeData } from "@/lib/api/totem.functions";
import type { TotemNav } from "@/lib/totem-nav";
import { themeVars } from "@/components/totem/useTotemTheme";
import { TotemMotas } from "@/components/totem/TotemMotas";
import { CargaMarca } from "@/components/CargaMarca";
import {
  Badges,
  ContenidoBoton,
  Logo,
  Title,
  claseBoton,
  estiloBoton,
  type TamanioBoton,
} from "@/components/totem/portada-partes";
import { useFaviconMarca } from "@/lib/marca";

function StartButton({
  data,
  nav,
  size = "lg",
}: {
  data: TotemHomeData;
  nav: TotemNav | null;
  size?: TamanioBoton;
}) {
  // El catálogo se pide al tocar; el primer arranque va a la base y tarda. La
  // marca tapa la pantalla mientras tanto para que nadie lo toque tres veces.
  const [cargando, setCargando] = useState(false);
  const className = claseBoton(size, cargando);
  const style = estiloBoton(data);
  const contenido = <ContenidoBoton data={data} size={size} cargando={cargando} />;

  // Sin `nav` esto es la vista previa del panel: se ve igual pero no navega.
  // El iframe comparte el router con el panel, así que un clic acá sacaba al
  // dueño de su propia pantalla mientras editaba la portada.
  if (!nav) {
    return (
      <div className={className} style={style} aria-hidden>
        {contenido}
      </div>
    );
  }

  return (
    <>
      <Link
        to="/t/$empresa/$local/$totem/categorias"
        params={nav}
        className={className}
        style={style}
        aria-busy={cargando}
        onClick={() => setCargando(true)}
      >
        {contenido}
      </Link>
      {cargando && (
        <CargaMarca
          logoUrl={data.logoUrl}
          nombre={data.name}
          texto="Preparando el menú…"
          accent={data.accentColor || data.primaryColor}
        />
      )}
    </>
  );
}

// Hero lateral: imagen de fondo difuminada, texto a la izquierda, botón a la derecha.
function Clasico({ data, nav }: { data: TotemHomeData; nav: TotemNav | null }) {
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
              <StartButton data={data} nav={nav} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Pantalla completa: imagen a sangre, todo centrado. Ideal para discotecas/eventos.
function Completo({ data, nav }: { data: TotemHomeData; nav: TotemNav | null }) {
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
          <StartButton data={data} nav={nav} size="xl" />
        </div>
      </div>
    </div>
  );
}

// Split: mitad imagen, mitad panel sólido. Look de carta/menú sobrio.
function Split({ data, nav }: { data: TotemHomeData; nav: TotemNav | null }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      {/* La foto va absoluta: en el flujo, una vertical medía su alto natural,
          estiraba la fila más allá de la pantalla y el panel de al lado
          centraba el texto en esa altura, con el botón cortado abajo. */}
      <div className="relative min-h-[35dvh] flex-1 overflow-hidden lg:min-h-dvh">
        {data.heroImageUrl ? (
          <img
            src={data.heroImageUrl}
            alt=""
            className="respira absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-muted" />
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
            <StartButton data={data} nav={nav} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * `nav` es null en la vista previa del panel: la portada se dibuja igual pero
 * sin llevar a ningún lado, porque ahí todavía no hay un tótem al que ir.
 */
export function TotemHome({ data, nav }: { data: TotemHomeData; nav: TotemNav | null }) {
  useFaviconMarca(data.logoUrl);
  const plantilla =
    data.template === "completo" ? (
      <Completo data={data} nav={nav} />
    ) : data.template === "split" ? (
      <Split data={data} nav={nav} />
    ) : (
      <Clasico data={data} nav={nav} />
    );

  // Los tokens van inline además de en el documento: así la vista previa del
  // panel, que vive en un iframe aparte, muestra la base de color elegida.
  return (
    <div
      // La clase va acá además del documento: la vista previa del panel vive en
      // un iframe y monta esto sin pasar por el hook que la agrega arriba.
      className="totem-tipografia text-foreground"
      style={
        themeVars(data.accentColor, data.theme, data.fontTheme, data.corners) as React.CSSProperties
      }
    >
      {plantilla}
    </div>
  );
}

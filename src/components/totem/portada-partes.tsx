import { ChevronRight, Loader2, Store } from "lucide-react";
import type { PortadaDatos } from "@/lib/api/totem.functions";

/**
 * Las piezas de la pantalla de inicio: las usan la portada del tótem
 * (`TotemHome`) y la del celular (`PortadaCelular`), para que la marca se vea
 * igual en la tablet del mostrador y en el teléfono del cliente.
 */

const FALLBACK_ACCENT = "var(--gold, #f5b800)";

export const acentoDe = (data: PortadaDatos) => data.accentColor || data.primaryColor || undefined;

export function Badges({
  data,
  extra = [],
  className = "",
}: {
  data: PortadaDatos;
  /** Chips que no carga el dueño, como "Envío y retiro" en el pedido online. */
  extra?: string[];
  className?: string;
}) {
  const badges = [data.badge1, data.badge2, ...extra].filter(Boolean) as string[];
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
 * El logo con el nombre de la sucursal, y encima el eyebrow.
 *
 * `conEyebrow` existe porque la plantilla Clásica ya lo muestra como cartelito
 * aparte: repetirlo acá hacía que "Sanguchería de miga" apareciera dos veces
 * en la misma pantalla, a dos centímetros de distancia.
 */
export function Logo({
  data,
  conEyebrow = true,
  conNombre = true,
}: {
  data: PortadaDatos;
  conEyebrow?: boolean;
  /** Sin título propio, el título grande ya es el nombre: no se repite al lado. */
  conNombre?: boolean;
}) {
  const accent = acentoDe(data);
  return (
    <div className="flex items-center gap-4">
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl shadow-glow"
        style={{ background: accent ?? undefined }}
      >
        {data.logoUrl ? (
          <img src={data.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Store className="h-8 w-8 text-white" />
        )}
      </div>
      <div className="min-w-0">
        {conEyebrow && data.eyebrow && (
          <div
            className="text-xs font-semibold uppercase tracking-[0.3em]"
            style={{ color: accent }}
          >
            {data.eyebrow}
          </div>
        )}
        {conNombre && (
          <div className="font-display text-2xl tracking-wide md:text-3xl">{data.name}</div>
        )}
      </div>
    </div>
  );
}

export function Title({ data, className = "" }: { data: PortadaDatos; className?: string }) {
  const accent = acentoDe(data) ?? FALLBACK_ACCENT;
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

export type TamanioBoton = "lg" | "xl";

/** El botón grande que late: en el tótem es un link, en el celular un botón. */
export function claseBoton(size: TamanioBoton, cargando: boolean) {
  return `late group flex w-full items-center justify-between gap-4 rounded-3xl transition hover:scale-[1.02] active:scale-[0.98] ${
    size === "xl" ? "px-12 py-10" : "px-10 py-8"
  } ${cargando ? "pointer-events-none opacity-90" : ""}`;
}

export function estiloBoton(data: PortadaDatos) {
  const accent = acentoDe(data);
  return {
    background: accent ?? "var(--primary)",
    // El halo late en el color de la marca, no en blanco.
    "--halo": `color-mix(in oklab, ${accent ?? "var(--primary)"} 55%, transparent)`,
  } as React.CSSProperties;
}

export function ContenidoBoton({
  data,
  size,
  cargando,
}: {
  data: PortadaDatos;
  size: TamanioBoton;
  cargando: boolean;
}) {
  return (
    <>
      <span
        className={`font-display uppercase tracking-wide text-white ${
          size === "xl" ? "text-4xl md:text-5xl" : "text-3xl md:text-4xl"
        }`}
      >
        {data.ctaLabel}
      </span>
      {cargando ? (
        <Loader2 className={`animate-spin text-white ${size === "xl" ? "h-10 w-10" : "h-8 w-8"}`} />
      ) : (
        <ChevronRight
          className={`text-white transition group-hover:translate-x-1 ${size === "xl" ? "h-10 w-10" : "h-8 w-8"}`}
        />
      )}
    </>
  );
}

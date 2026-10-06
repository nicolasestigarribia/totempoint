import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/**
 * La barra de arriba del pedido online: la marca del comercio y, fuera del
 * menú, el camino de vuelta. Es angosta a propósito: en un celular cada línea
 * que se lleva arriba es un producto menos a la vista.
 */
export function OnlineHeader({
  empresa,
  local,
  name,
  sucursal,
  logoUrl,
  volver,
  minimoLabel,
}: {
  empresa: string;
  local: string;
  name: string;
  sucursal: string;
  logoUrl: string | null;
  /** Con texto, muestra la flecha para volver al menú. */
  volver?: string;
  /** "Mínimo $10.000": se muestra a la derecha de la marca. */
  minimoLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex h-16 w-full max-w-2xl items-center gap-3 px-4">
        {volver && (
          <Link
            to="/p/$empresa/$local"
            params={{ empresa, local }}
            aria-label={volver}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        {logoUrl && (
          <img src={logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-xl leading-tight">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{sucursal}</p>
        </div>
        {minimoLabel && (
          <span className="ml-auto shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {minimoLabel}
          </span>
        )}
      </div>
    </header>
  );
}

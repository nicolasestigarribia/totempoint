import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/**
 * La barra de arriba del pedido en mesa: la marca del comercio y, bien a la
 * vista, la mesa. Es lo que el cliente necesita confirmar antes de pedir: que
 * el QR que escaneó es el de su mesa, y no el de la de al lado.
 */
export function MesaHeader({
  token,
  name,
  sucursal,
  logoUrl,
  mesa,
  accent,
  volver,
}: {
  token: string;
  name: string;
  sucursal: string;
  logoUrl: string | null;
  mesa: number;
  accent: string;
  /** Con texto, muestra la flecha para volver al menú. */
  volver?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex h-16 w-full max-w-2xl items-center gap-3 px-4">
        {volver && (
          <Link
            to="/m/$token"
            params={{ token }}
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
        <span
          className="ml-auto shrink-0 rounded-full px-4 py-1.5 text-sm font-extrabold text-white"
          style={{ background: accent }}
        >
          Mesa {mesa}
        </span>
      </div>
    </header>
  );
}

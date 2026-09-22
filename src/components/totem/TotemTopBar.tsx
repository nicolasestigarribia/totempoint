import { Link } from "@tanstack/react-router";
import { ArrowLeft, Store } from "lucide-react";
import { TotemPasos, type PasoTotem } from "@/components/totem/TotemPasos";
import type { TotemNav } from "@/lib/totem-nav";

/**
 * Barra de arriba del tótem: marca y vuelta atrás, nada más.
 *
 * El carrito se fue a `TotemCartBar`, abajo y con el total a la vista. Tener
 * dos accesos al pedido competía: arriba decía "Ver pedido" sin el monto, que
 * es justo el dato que el cliente quiere.
 *
 * Sólo navega dentro del pedido: nunca sale al panel ni al login.
 */
export function TotemTopBar({
  nav,
  name,
  logoUrl,
  accent,
  back = "home",
  paso,
}: {
  nav: TotemNav;
  name: string;
  logoUrl: string | null;
  accent?: string;
  back?: "home" | "categorias";
  /** En qué paso del pedido está. Sin esto no se muestran los pasos. */
  paso?: PasoTotem;
}) {
  return (
    <header
      // Pegada arriba: en un celular la lista de productos es larga y el carrito
      // tiene que estar siempre a mano, no diez pantallazos más arriba.
      className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/95 px-6 py-4 backdrop-blur md:px-12"
    >
      {back === "categorias" ? (
        <Link
          to="/t/$empresa/$local/$totem/categorias"
          params={nav}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border transition hover:border-primary"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      ) : (
        <Link
          to="/t/$empresa/$local/$totem"
          params={nav}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border transition hover:border-primary"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      )}

      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{ background: accent ?? "var(--primary)" }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Store className="h-5 w-5 text-white" />
          )}
        </div>
        <span className="font-display text-xl tracking-wide">{name}</span>
      </div>

      {paso && (
        <div className="ml-auto">
          <TotemPasos actual={paso} accent={accent} />
        </div>
      )}
    </header>
  );
}

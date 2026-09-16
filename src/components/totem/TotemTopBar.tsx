import { Link } from "@tanstack/react-router";
import { ArrowLeft, Store, ShoppingCart } from "lucide-react";
import { useCartForSlug, cartCount } from "@/lib/totem-cart";

// Barra del tótem. Sólo navega dentro del pedido: nunca sale al panel ni al login.
export function TotemTopBar({
  slug,
  name,
  logoUrl,
  accent,
  back = "home",
  showCart = true,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  accent?: string;
  back?: "home" | "categorias";
  showCart?: boolean;
}) {
  const items = useCartForSlug(slug);
  const count = cartCount(items);

  return (
    <header className="flex items-center gap-4 border-b border-border px-6 py-4 md:px-12">
      {back === "categorias" ? (
        <Link
          to="/t/$slug/categorias"
          params={{ slug }}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border transition hover:border-primary"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      ) : (
        <Link
          to="/t/$slug"
          params={{ slug }}
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

      {showCart && count > 0 && (
        <Link
          to="/t/$slug/carrito"
          params={{ slug }}
          className="ml-auto flex items-center gap-3 rounded-2xl px-5 py-3 font-display text-lg uppercase tracking-wide text-white transition hover:scale-[1.03]"
          style={{ background: accent ?? "var(--primary)" }}
        >
          <ShoppingCart className="h-5 w-5" />
          Ver pedido
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-black/25 px-2 text-sm">
            {count}
          </span>
        </Link>
      )}
    </header>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, ArrowLeft, Flame } from "lucide-react";
import { useStore, cartCount } from "@/lib/store";

export function KioskHeader({ back, title }: { back?: string; title?: string }) {
  const cart = useStore((s) => s.cart);
  const count = cartCount(cart);
  const path = useRouterState({ select: (r) => r.location.pathname });
  const showCart = path !== "/" && path !== "/cart" && !path.startsWith("/confirmation") && !path.startsWith("/kitchen");

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/85 px-6 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {back ? (
          <Link
            to={back}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground transition hover:bg-muted"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        ) : null}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-2xl tracking-wide">Burger Point</div>
            {title ? <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</div> : null}
          </div>
        </Link>
      </div>
      {showCart ? (
        <Link
          to="/cart"
          className="relative flex h-14 items-center gap-3 rounded-full bg-gradient-gold px-6 font-semibold text-gold-foreground shadow-glow transition hover:scale-[1.03]"
        >
          <ShoppingBag className="h-5 w-5" />
          <span className="hidden sm:inline">Mi pedido</span>
          {count > 0 && (
            <span className="ml-1 flex h-7 min-w-7 items-center justify-center rounded-full bg-background px-2 text-sm font-bold text-foreground">
              {count}
            </span>
          )}
        </Link>
      ) : null}
    </header>
  );
}

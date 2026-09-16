import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, ArrowLeft, Flame } from "lucide-react";
import { useStore, cartCount } from "@/lib/store";

export function TotemHeader({ back, title }: { back?: string; title?: string }) {
  const cart = useStore((s) => s.cart);
  const count = cartCount(cart);
  const router = useRouter();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const showCart =
    path !== "/" &&
    path !== "/cart" &&
    !path.startsWith("/confirmation") &&
    !path.startsWith("/kitchen");

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-6 py-4 backdrop-blur-xl md:px-10 md:py-5">
      <div className="flex items-center gap-4">
        {back ? (
          <button
            onClick={() => router.navigate({ to: back as string })}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition hover:border-primary hover:bg-secondary active:scale-95"
            aria-label="Volver"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        ) : null}
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Flame className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-2xl tracking-wide md:text-3xl">Burger Point</div>
            {title ? (
              <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground md:text-xs">
                {title}
              </div>
            ) : null}
          </div>
        </Link>
      </div>
      {showCart ? (
        <Link
          to="/cart"
          className="group relative flex h-14 items-center gap-3 rounded-full bg-gradient-gold px-5 font-bold text-gold-foreground shadow-glow transition hover:scale-[1.03] active:scale-95 md:h-16 md:px-7"
        >
          <ShoppingBag className="h-5 w-5 md:h-6 md:w-6" />
          <span className="hidden text-sm uppercase tracking-wider sm:inline md:text-base">Mi pedido</span>
          {count > 0 && (
            <span className="ml-1 flex h-8 min-w-8 items-center justify-center rounded-full bg-background px-2 text-sm font-extrabold text-foreground md:h-9 md:min-w-9">
              {count}
            </span>
          )}
        </Link>
      ) : null}
    </header>
  );
}

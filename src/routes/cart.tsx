import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KioskHeader } from "@/components/KioskHeader";
import { useStore, cartTotal } from "@/lib/store";
import { formatPrice } from "@/lib/menu";
import { Minus, Plus, Trash2, ShoppingBag, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Mi pedido — Burger Point" }] }),
  component: Cart,
});

function Cart() {
  const cart = useStore((s) => s.cart);
  const addToCart = useStore((s) => s.addToCart);
  const removeOne = useStore((s) => s.removeOne);
  const removeAll = useStore((s) => s.removeAll);
  const navigate = useNavigate();
  const total = cartTotal(cart);

  return (
    <div className="min-h-screen pb-40">
      <KioskHeader title="Tu pedido" back="/categories" />
      <main className="mx-auto max-w-4xl px-6 py-10 md:px-10 md:py-14">
        <div className="mb-10">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Resumen</div>
          <h1 className="mt-2 font-display text-5xl md:text-6xl">Mi pedido</h1>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-dashed border-border bg-card/40 p-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-display text-3xl">Tu carrito está vacío</h2>
              <p className="mt-2 text-muted-foreground">Sumá algo rico desde el menú.</p>
            </div>
            <Link
              to="/categories"
              className="rounded-full bg-gradient-primary px-8 py-4 font-bold uppercase tracking-wider text-primary-foreground shadow-glow"
            >
              Ver el menú
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((i) => (
              <div
                key={i.product.id}
                className="flex items-center gap-4 rounded-3xl border border-border/60 bg-card p-4 shadow-card md:gap-5 md:p-5"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl md:h-24 md:w-24">
                  <img
                    src={i.product.image}
                    alt={i.product.name}
                    width={1024}
                    height={768}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-xl leading-tight md:text-2xl">{i.product.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formatPrice(i.product.price)} c/u
                  </div>
                  <div className="mt-1 font-display text-lg text-gold sm:hidden">
                    {formatPrice(i.product.price * i.quantity)}
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-secondary p-1.5">
                  <button
                    onClick={() => removeOne(i.product.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-background text-foreground transition active:scale-90"
                    aria-label="Quitar uno"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center text-lg font-extrabold">{i.quantity}</span>
                  <button
                    onClick={() => addToCart(i.product)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow transition active:scale-90"
                    aria-label="Agregar uno"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="hidden w-28 text-right font-display text-xl text-gold sm:block">
                  {formatPrice(i.product.price * i.quantity)}
                </div>
                <button
                  onClick={() => removeAll(i.product.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <div className="mt-10 rounded-3xl border border-border/60 bg-card p-6 shadow-card md:p-8">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Total
                </span>
                <span className="font-display text-5xl text-gold">{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur md:px-10">
          <div className="mx-auto flex max-w-4xl items-center gap-4">
            <Link
              to="/categories"
              className="hidden h-14 items-center rounded-2xl border border-border bg-card px-6 text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground sm:flex"
            >
              Seguir pidiendo
            </Link>
            <button
              onClick={() => navigate({ to: "/checkout" })}
              className="ml-auto flex h-16 flex-1 items-center justify-center gap-3 rounded-2xl bg-gradient-primary text-lg font-extrabold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:scale-[1.01] active:scale-[0.98] sm:flex-none sm:px-12"
            >
              Confirmar pedido
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

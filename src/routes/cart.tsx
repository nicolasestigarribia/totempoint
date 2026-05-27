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
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-8 font-display text-5xl">Mi pedido</h1>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-dashed border-border bg-card/50 p-16 text-center">
            <ShoppingBag className="h-16 w-16 text-muted-foreground" />
            <div>
              <h2 className="font-display text-3xl">Tu carrito está vacío</h2>
              <p className="mt-2 text-muted-foreground">Sumá algo rico desde el menú.</p>
            </div>
            <Link
              to="/categories"
              className="rounded-full bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow"
            >
              Ver el menú
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((i) => (
              <div
                key={i.product.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-secondary text-3xl">
                  {i.product.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-xl leading-tight">{i.product.name}</div>
                  <div className="text-sm text-muted-foreground">{formatPrice(i.product.price)} c/u</div>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-secondary p-1">
                  <button
                    onClick={() => removeOne(i.product.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground transition active:scale-90"
                    aria-label="Quitar uno"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center font-bold">{i.quantity}</span>
                  <button
                    onClick={() => addToCart(i.product)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground transition active:scale-90"
                    aria-label="Agregar uno"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="hidden w-24 text-right font-display text-lg text-gold sm:block">
                  {formatPrice(i.product.price * i.quantity)}
                </div>
                <button
                  onClick={() => removeAll(i.product.id)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <div className="mt-8 rounded-3xl border border-border bg-card p-6">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
                <span className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Total</span>
                <span className="font-display text-4xl text-gold">{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            <Link to="/categories" className="rounded-full border border-border px-5 py-3 text-sm font-medium">
              Seguir pidiendo
            </Link>
            <button
              onClick={() => navigate({ to: "/checkout" })}
              className="ml-auto flex h-16 flex-1 items-center justify-center gap-3 rounded-2xl bg-gradient-primary text-lg font-bold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:scale-[1.02] active:scale-[0.98] sm:flex-none sm:px-10"
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

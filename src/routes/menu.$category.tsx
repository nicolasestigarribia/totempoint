import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { TotemHeader } from "@/components/TotemHeader";
import { categories, products, formatPrice, type CategoryId } from "@/lib/menu";
import { useStore, cartCount, cartTotal } from "@/lib/store";
import { Plus, Check, ShoppingBag, ChevronRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/menu/$category")({
  head: () => ({ meta: [{ title: "Menú — Burger Point" }] }),
  component: Menu,
});

function Menu() {
  const { category } = Route.useParams();
  const cat = categories.find((c) => c.id === (category as CategoryId));
  if (!cat) throw notFound();
  const items = products.filter((p) => p.category === cat.id);
  const addToCart = useStore((s) => s.addToCart);
  const cart = useStore((s) => s.cart);
  const count = cartCount(cart);
  const total = cartTotal(cart);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const handleAdd = (id: string) => {
    const p = items.find((x) => x.id === id)!;
    addToCart(p);
    setJustAdded(id);
    setTimeout(() => setJustAdded((cur) => (cur === id ? null : cur)), 900);
  };

  return (
    <div className="min-h-screen pb-36">
      <TotemHeader title={cat.name} back="/categories" />

      <div className="relative h-48 overflow-hidden border-b border-border md:h-64">
        <img
          src={cat.image}
          alt=""
          width={1024}
          height={768}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="relative z-10 mx-auto flex h-full max-w-[1400px] items-end px-6 pb-6 md:px-12 md:pb-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-gold">{cat.tagline}</div>
            <h1 className="mt-2 font-display text-5xl md:text-7xl">{cat.name}</h1>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] px-6 py-10 md:px-12 md:py-12">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <article
              key={p.id}
              className="group flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card transition hover:-translate-y-1 hover:border-primary/60"
            >
              <div className="relative h-44 overflow-hidden">
                <img
                  src={p.image}
                  alt={p.name}
                  width={1024}
                  height={768}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                />
                <div className="absolute right-3 top-3 rounded-full bg-background/85 px-3 py-1 font-display text-lg text-gold backdrop-blur">
                  {formatPrice(p.price)}
                </div>
              </div>
              <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                <div>
                  <h3 className="font-display text-2xl leading-tight">{p.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                </div>
                <button
                  onClick={() => handleAdd(p.id)}
                  className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold uppercase tracking-wider transition active:scale-95 ${
                    justAdded === p.id
                      ? "bg-gold text-gold-foreground"
                      : "bg-gradient-primary text-primary-foreground hover:scale-[1.02]"
                  }`}
                >
                  {justAdded === p.id ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  {justAdded === p.id ? "Agregado" : "Agregar"}
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <Link
            to="/categories"
            className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground"
          >
            ← Ver otras categorías
          </Link>
        </div>
      </main>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur md:px-12">
          <div className="mx-auto flex max-w-[1400px] items-center gap-4">
            <div className="hidden flex-1 items-center gap-3 sm:flex">
              <ShoppingBag className="h-5 w-5 text-gold" />
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {count} {count === 1 ? "producto" : "productos"} · {formatPrice(total)}
              </span>
            </div>
            <Link
              to="/cart"
              className="ml-auto flex h-16 flex-1 items-center justify-center gap-3 rounded-2xl bg-gradient-primary text-lg font-extrabold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:scale-[1.02] sm:flex-none sm:px-10"
            >
              Ver mi pedido
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

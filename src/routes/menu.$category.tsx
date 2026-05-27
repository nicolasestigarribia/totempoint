import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { KioskHeader } from "@/components/KioskHeader";
import { categories, products, formatPrice, type CategoryId } from "@/lib/menu";
import { useStore } from "@/lib/store";
import { Plus, Check } from "lucide-react";
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
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const handleAdd = (id: string) => {
    const p = items.find((x) => x.id === id)!;
    addToCart(p);
    setJustAdded(id);
    setTimeout(() => setJustAdded((cur) => (cur === id ? null : cur)), 900);
  };

  return (
    <div className="min-h-screen pb-32">
      <KioskHeader title={cat.name} back="/categories" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">{cat.tagline}</div>
            <h1 className="mt-1 font-display text-5xl md:text-6xl">{cat.name}</h1>
          </div>
          <div className="text-6xl">{cat.emoji}</div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {items.map((p) => (
            <article
              key={p.id}
              className="flex gap-4 overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-card transition hover:border-primary/60"
            >
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-background text-6xl">
                {p.emoji}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                  <h3 className="font-display text-2xl leading-tight">{p.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="font-display text-2xl text-gold">{formatPrice(p.price)}</div>
                  <button
                    onClick={() => handleAdd(p.id)}
                    className={`flex h-12 items-center gap-2 rounded-full px-5 font-semibold transition active:scale-95 ${
                      justAdded === p.id
                        ? "bg-gold text-gold-foreground"
                        : "bg-gradient-primary text-primary-foreground hover:scale-105"
                    }`}
                  >
                    {justAdded === p.id ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                    {justAdded === p.id ? "Agregado" : "Agregar"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            to="/categories"
            className="rounded-full border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Ver otras categorías
          </Link>
        </div>
      </main>
    </div>
  );
}

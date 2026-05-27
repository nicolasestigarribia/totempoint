import { createFileRoute, Link } from "@tanstack/react-router";
import { KioskHeader } from "@/components/KioskHeader";
import { categories } from "@/lib/menu";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categorías — Burger Point" }] }),
  component: Categories,
});

function Categories() {
  return (
    <div className="min-h-screen">
      <KioskHeader title="¿Qué se te antoja?" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10 text-center">
          <h1 className="font-display text-5xl md:text-6xl">Elegí una categoría</h1>
          <p className="mt-3 text-muted-foreground">Tocá una tarjeta para ver los productos</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c, idx) => (
            <Link
              key={c.id}
              to="/menu/$category"
              params={{ category: c.id }}
              className="group relative flex h-56 flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-card transition hover:-translate-y-1 hover:border-primary"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="absolute -right-6 -top-6 text-[180px] leading-none opacity-20 transition group-hover:scale-110 group-hover:opacity-40">
                {c.emoji}
              </div>
              <div className="relative">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">{c.tagline}</div>
                <h2 className="mt-2 font-display text-4xl">{c.name}</h2>
              </div>
              <div className="relative flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ver productos</span>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground transition group-hover:translate-x-1">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

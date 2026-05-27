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
      <main className="mx-auto max-w-[1400px] px-6 py-10 md:px-12 md:py-14">
        <div className="mb-12 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Menú</div>
          <h1 className="mt-3 font-display text-5xl md:text-7xl">Elegí una categoría</h1>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            Tocá una tarjeta para ver los productos
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              to="/menu/$category"
              params={{ category: c.id }}
              className="group relative flex h-72 flex-col justify-end overflow-hidden rounded-3xl border border-border/60 shadow-card transition hover:-translate-y-1 hover:border-primary md:h-80"
            >
              <img
                src={c.image}
                alt={c.name}
                width={1024}
                height={768}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />

              <div className="relative z-10 flex items-end justify-between gap-4 p-6 md:p-7">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-gold">
                    {c.tagline}
                  </div>
                  <h2 className="mt-2 font-display text-4xl text-white md:text-5xl">{c.name}</h2>
                </div>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow transition group-hover:translate-x-1">
                  <ChevronRight className="h-6 w-6" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

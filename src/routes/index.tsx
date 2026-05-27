import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, ChevronRight } from "lucide-react";
import heroImg from "@/assets/hero-burger.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Burger Point — Autoservicio" },
      { name: "description", content: "Hacé tu pedido en segundos desde la pantalla." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-hero">
      <img
        src={heroImg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-screen"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-between px-8 py-12 text-center">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card/60 px-5 py-2 backdrop-blur">
          <Flame className="h-4 w-4 text-gold" />
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Autoservicio
          </span>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-primary shadow-glow">
            <Flame className="h-12 w-12 text-primary-foreground" />
          </div>
          <h1 className="font-display text-7xl leading-none text-balance sm:text-8xl md:text-9xl">
            BURGER <span className="text-gold">POINT</span>
          </h1>
          <p className="max-w-xl text-balance text-lg text-muted-foreground sm:text-xl">
            Hamburguesas premium hechas al momento. Tocá la pantalla y armá tu pedido en segundos.
          </p>
        </div>

        <div className="flex w-full max-w-md flex-col gap-4">
          <Link
            to="/categories"
            className="group flex h-20 items-center justify-center gap-3 rounded-2xl bg-gradient-primary text-2xl font-bold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Empezar pedido
            <ChevronRight className="h-7 w-7 transition group-hover:translate-x-1" />
          </Link>
          <Link
            to="/kitchen"
            className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground"
          >
            Panel de cocina →
          </Link>
        </div>
      </div>
    </div>
  );
}

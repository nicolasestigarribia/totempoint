import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, ChevronRight, Clock, Sparkles } from "lucide-react";
import heroImg from "@/assets/cat-burgers.jpg";

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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <img
        src={heroImg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-50"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-between gap-10 px-6 py-10 text-center md:items-start md:px-12 md:py-16 md:text-left lg:flex-row lg:items-center">
        <div className="flex flex-col items-center gap-8 md:items-start">
          <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/70 px-5 py-2 backdrop-blur">
            <Sparkles className="h-4 w-4 text-gold" />
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Autoservicio Premium
            </span>
          </div>

          <div className="flex flex-col items-center gap-6 md:items-start">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-primary shadow-glow">
                <Flame className="h-10 w-10 text-primary-foreground" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Premium Burgers</div>
                <div className="font-display text-2xl tracking-wide md:text-3xl">Burger Point</div>
              </div>
            </div>

            <h1 className="font-display text-balance text-7xl leading-[0.9] sm:text-8xl md:text-[8rem] lg:text-[10rem]">
              BURGER
              <br />
              <span className="text-gold">POINT</span>
            </h1>
            <p className="max-w-xl text-balance text-lg text-muted-foreground md:text-xl">
              Hamburguesas premium hechas al momento. Tocá la pantalla y armá tu pedido en segundos.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                <Clock className="h-3.5 w-3.5 text-gold" /> Listo en 5 min
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                <Flame className="h-3.5 w-3.5 text-gold" /> Carne 100% premium
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full max-w-xl flex-col gap-4 lg:max-w-md">
          <Link
            to="/categories"
            className="group flex h-28 items-center justify-center gap-4 rounded-3xl bg-gradient-primary text-3xl font-extrabold uppercase tracking-wider text-primary-foreground shadow-glow transition hover:scale-[1.02] active:scale-[0.98] md:h-32 md:text-4xl"
          >
            Empezar pedido
            <ChevronRight className="h-9 w-9 transition group-hover:translate-x-1 md:h-10 md:w-10" />
          </Link>
          <Link
            to="/kitchen"
            className="flex h-14 items-center justify-center rounded-2xl border border-border/70 bg-card/60 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground backdrop-blur transition hover:border-primary hover:text-foreground"
          >
            Panel de cocina →
          </Link>
        </div>
      </div>
    </div>
  );
}

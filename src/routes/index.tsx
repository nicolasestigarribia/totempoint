import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Sparkles, Clock, ChevronRight, LogIn } from "lucide-react";
import heroBurger from "@/assets/hero-burger.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Burger Point — Autoservicio Premium" },
      { name: "description", content: "Hamburguesas premium hechas al momento. Armá tu pedido en segundos." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <img
        src={heroBurger}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />

      <div className="relative z-10 flex flex-1 flex-col px-6 py-8 md:px-14 md:py-10">
        <div className="grid flex-1 grid-cols-1 items-center gap-10 py-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <div className="flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/70 px-5 py-2 backdrop-blur">
              <Sparkles className="h-4 w-4 text-gold" />
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
                Autoservicio Premium
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-primary shadow-glow">
                <Flame className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Premium Burgers</div>
                <div className="font-display text-2xl tracking-wide md:text-3xl">
                  Burger <span className="text-sky-400">Point</span>
                </div>
              </div>
            </div>

            <h1 className="font-display text-7xl leading-[0.85] sm:text-8xl md:text-9xl">
              <span className="block">BURGER</span>
              <span className="block text-gold">POINT</span>
            </h1>

            <p className="max-w-md text-balance text-lg text-muted-foreground md:text-xl">
              Hamburguesas premium hechas al momento.
              <br />
              Tocá la pantalla y armá tu pedido en segundos.
            </p>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-2 backdrop-blur">
                <Clock className="h-4 w-4 text-gold" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Listo en 5 min</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-2 backdrop-blur">
                <Flame className="h-4 w-4 text-gold" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Carne 100% Premium</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <Link
              to="/categories"
              className="group flex w-full max-w-md items-center justify-between gap-4 rounded-3xl bg-gradient-primary px-10 py-8 shadow-glow transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="font-display text-3xl uppercase tracking-wide text-primary-foreground md:text-4xl">
                Empezar Pedido
              </span>
              <ChevronRight className="h-8 w-8 text-primary-foreground transition group-hover:translate-x-1" />
            </Link>

            <Link
              to="/login"
              className="group flex w-full max-w-md items-center justify-between gap-4 rounded-3xl border border-border/70 bg-card/70 px-10 py-6 backdrop-blur transition hover:scale-[1.02] hover:border-primary active:scale-[0.98]"
            >
              <span className="flex items-center gap-3 font-display text-2xl uppercase tracking-wide text-foreground md:text-3xl">
                <LogIn className="h-6 w-6 text-gold" />
                Iniciar Sesión
              </span>
              <ChevronRight className="h-7 w-7 text-muted-foreground transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

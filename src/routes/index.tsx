import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Sparkles, ConciergeBell, ChefHat, ShieldCheck, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Burger Point — Acceso" },
      { name: "description", content: "Seleccioná tu acceso: tótem, cocina o administración." },
    ],
  }),
  component: Home,
});

interface AccessCard {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const cards: AccessCard[] = [
  {
    to: "/totem",
    label: "Totem",
    description: "Tomá el pedido del cliente",
    icon: ConciergeBell,
  },
  {
    to: "/kitchen",
    label: "Cocina",
    description: "Panel de pedidos en preparación",
    icon: ChefHat,
  },
  {
    to: "/login",
    label: "Administración",
    description: "Ingresá con usuario y contraseña",
    icon: ShieldCheck,
  },
];

function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-12">
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card/70 px-5 py-2 backdrop-blur">
            <Sparkles className="h-4 w-4 text-gold" />
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Autoservicio Premium
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-primary shadow-glow">
              <Flame className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Premium Burgers</div>
              <div className="font-display text-3xl tracking-wide md:text-4xl">Burger Point</div>
            </div>
          </div>

          <h1 className="font-display text-balance text-5xl leading-[0.95] sm:text-6xl md:text-7xl">
            ¿Cómo querés <span className="text-gold">ingresar</span>?
          </h1>
          <p className="max-w-xl text-balance text-lg text-muted-foreground">
            Seleccioná tu acceso para continuar.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map(({ to, label, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-8 text-center shadow-card backdrop-blur transition hover:scale-[1.03] hover:border-primary hover:shadow-glow active:scale-[0.98] md:p-10"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-primary shadow-glow transition group-hover:scale-110">
                <Icon className="h-12 w-12 text-primary-foreground" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="font-display text-3xl tracking-wide md:text-4xl">{label}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gold opacity-0 transition group-hover:opacity-100">
                Ingresar
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

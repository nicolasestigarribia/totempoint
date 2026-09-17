import { createFileRoute, Link } from "@tanstack/react-router";
import { Monitor, LogIn, Store, Users, Receipt } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Totempoint — Autoservicio para tu negocio" },
      {
        name: "description",
        content:
          "Tótems de autoservicio para bares, sanguicherías y casas de comida: el cliente pide desde la pantalla y la comanda le llega al negocio.",
      },
    ],
  }),
  component: Home,
});

// La raíz es la puerta de entrada de la plataforma, no la de un negocio.
// Cada tótem se abre por su propia URL: /t/<slug>.
const FEATURES = [
  {
    icon: Monitor,
    title: "El cliente pide solo",
    desc: "Elige desde la pantalla del tótem, sin depender de que haya alguien en la caja.",
  },
  {
    icon: Receipt,
    title: "La comanda llega al negocio",
    desc: "Cada pedido entra con su número y su detalle, listo para preparar y entregar.",
  },
  {
    icon: Store,
    title: "Un menú por negocio",
    desc: "Cada negocio activa lo que vende y con qué precio, sobre el catálogo de la empresa.",
  },
  {
    icon: Users,
    title: "Encargados por negocio",
    desc: "El dueño da de alta a su gente y cada uno ve solamente los negocios que maneja.",
  },
];

function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-6 py-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Monitor className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-display text-xl tracking-wide">Totempoint</span>
        </div>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:border-primary hover:text-foreground"
        >
          <LogIn className="h-4 w-4" />
          Iniciar sesión
        </Link>
      </header>

      <main className="flex flex-1 flex-col justify-center px-6 py-10 md:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-12">
          <div className="space-y-6">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Autoservicio
            </p>
            <h1 className="font-display text-5xl leading-[0.95] sm:text-6xl md:text-7xl">
              Tu negocio toma
              <br />
              <span className="text-primary">los pedidos solo</span>
            </h1>
            <p className="max-w-xl text-balance text-lg text-muted-foreground">
              Ponés una tablet en el mostrador, el cliente arma su pedido y la comanda te llega al
              instante. Vos administrás tu empresa, sus negocios y el menú desde el panel.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 font-bold text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                <LogIn className="h-5 w-5" />
                Entrar al panel
              </Link>
              <p className="text-sm text-muted-foreground">
                ¿Sos cliente? El tótem se abre con el enlace que te da el negocio.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur"
              >
                <f.icon className="h-5 w-5 text-primary" />
                <h2 className="mt-3 font-bold">{f.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="px-6 py-8 text-center text-xs text-muted-foreground md:px-12">
        Totempoint — autoservicio para casas de comida
      </footer>
    </div>
  );
}

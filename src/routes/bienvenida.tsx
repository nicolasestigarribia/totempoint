import { createFileRoute } from "@tanstack/react-router";
import { LandingShowcase } from "@/components/landing/LandingShowcase";

export const Route = createFileRoute("/bienvenida")({
  head: () => ({
    meta: [
      { title: "Totempoint — El autoservicio que atiende por vos" },
      {
        name: "description",
        content:
          "Tótems de autoservicio para bares, sanguicherías y casas de comida: el cliente pide desde la pantalla, la comanda llega a la cocina y vos administrás todo desde el panel.",
      },
    ],
  }),
  component: LandingShowcase,
});

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { esAppNativa } from "@/lib/print/native";
import { getTotemUrl } from "@/lib/native/provisioning";
import { TotemSetupScreen } from "@/components/totem/TotemSetupScreen";
import { LandingShowcase } from "@/components/landing/LandingShowcase";

export const Route = createFileRoute("/")({
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
  component: Home,
});

function Home() {
  // En la app nativa la raíz no es la landing: si la tablet ya está pegada a un
  // tótem, va directo ahí; si no, muestra el wizard de setup. En el navegador
  // (web) es siempre la landing de la plataforma.
  const [modo, setModo] = useState<"web" | "cargando" | "setup">("web");

  useEffect(() => {
    if (!esAppNativa()) return;
    setModo("cargando");
    void (async () => {
      const url = await getTotemUrl();
      if (url) window.location.replace(url);
      else setModo("setup");
    })();
  }, []);

  if (modo === "cargando") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (modo === "setup") return <TotemSetupScreen />;

  return <LandingShowcase />;
}

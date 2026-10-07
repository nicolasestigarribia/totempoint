import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { esAppNativa } from "@/lib/print/native";
import { getTotemUrl } from "@/lib/native/provisioning";
import { TotemSetupScreen } from "@/components/totem/TotemSetupScreen";
import { PantallaCarga } from "@/components/PantallaCarga";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  // En la app nativa la raíz va directo al tótem guardado o al wizard de setup.
  // En el navegador (web) la raíz redirige a /bienvenida, la landing pública.
  const [modo, setModo] = useState<"cargando" | "setup">("cargando");
  const navigate = useNavigate();

  useEffect(() => {
    if (!esAppNativa()) {
      void navigate({ to: "/bienvenida", replace: true });
      return;
    }
    void (async () => {
      const url = await getTotemUrl();
      if (url) window.location.replace(url);
      else setModo("setup");
    })();
  }, [navigate]);

  if (modo === "setup") return <TotemSetupScreen />;

  return <PantallaCarga />;
}

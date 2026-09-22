import { createFileRoute } from "@tanstack/react-router";
import { getTotemHome } from "@/lib/api/totem.functions";
import { useTotemTheme, FONDOS_HEX } from "@/components/totem/useTotemTheme";
import { useTotemDevice } from "@/lib/use-totem-device";
import { useTotemFullscreen } from "@/lib/use-totem-fullscreen";
import { TotemHome } from "@/components/totem/TotemHome";
import { TotemError } from "@/components/totem/TotemError";

export const Route = createFileRoute("/t/$empresa/$local/$totem/")({
  loader: ({ params }) =>
    getTotemHome({
      data: { empresa: params.empresa, local: params.local, totem: Number(params.totem) },
    }),
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Autoservicio" }] };

    // El manifiesto y los íconos cuelgan de la URL de ESTE tótem, no de la
    // empresa: cada tablet instala el suyo, con su local y su número, así el
    // ícono de la pantalla principal abre siempre el mismo puesto.
    const base = `/t/${params.empresa}/${params.local}/${params.totem}`;
    const fondo = FONDOS_HEX[loaderData.theme] ?? FONDOS_HEX.oscuro;

    return {
      meta: [
        { title: `${loaderData.name} — Autoservicio` },
        // Lo que hace que la tablet pueda instalar el tótem como aplicación y
        // abrirlo sin la barra de direcciones. El manifiesto es por tótem:
        // nombre, colores y alcance son los del negocio.
        { name: "theme-color", content: fondo },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-title", content: loaderData.name },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      ],
      links: [
        { rel: "manifest", href: `${base}/manifest.webmanifest` },
        { rel: "apple-touch-icon", href: `${base}/icon-192.png` },
      ],
    };
  },
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  component: TotemHomePage,
});

function TotemHomePage() {
  const data = Route.useLoaderData();
  const nav = Route.useParams();
  useTotemTheme(data.accentColor, data.theme, data.fontTheme, data.corners);
  useTotemDevice();
  useTotemFullscreen();
  return <TotemHome data={data} nav={nav} />;
}

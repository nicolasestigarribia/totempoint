import { createFileRoute } from "@tanstack/react-router";
import { getTotemHome } from "@/lib/api/totem.functions";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { useTotemDevice } from "@/lib/use-totem-device";
import { TotemHome } from "@/components/totem/TotemHome";
import { TotemError } from "@/components/totem/TotemError";

export const Route = createFileRoute("/t/$empresa/$local/$totem/")({
  loader: ({ params }) =>
    getTotemHome({
      data: { empresa: params.empresa, local: params.local, totem: Number(params.totem) },
    }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.name} — Autoservicio` : "Autoservicio" }],
  }),
  errorComponent: ({ error }) => <TotemError message={error.message} />,
  component: TotemHomePage,
});

function TotemHomePage() {
  const data = Route.useLoaderData();
  const nav = Route.useParams();
  useTotemTheme(data.accentColor, data.theme, data.fontTheme, data.corners);
  useTotemDevice();
  return <TotemHome data={data} nav={nav} />;
}

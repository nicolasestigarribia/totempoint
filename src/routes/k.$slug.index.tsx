import { createFileRoute } from "@tanstack/react-router";
import { getKioskHome } from "@/lib/api/kiosk.functions";
import { KioskHome } from "@/components/kiosk/KioskHome";
import { KioskError } from "@/components/kiosk/KioskError";

export const Route = createFileRoute("/k/$slug/")({
  loader: ({ params }) => getKioskHome({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.name} — Autoservicio` : "Autoservicio" }],
  }),
  errorComponent: ({ error }) => <KioskError message={error.message} />,
  component: KioskHomePage,
});

function KioskHomePage() {
  return <KioskHome data={Route.useLoaderData()} />;
}

import { createFileRoute } from "@tanstack/react-router";
import { getOnlineMenuCached } from "@/lib/online-menu-cache";
import { OnlineError } from "@/components/online/OnlineError";
import { MenuOnline } from "@/components/online/MenuOnline";
import { ogMeta } from "@/lib/og";

/**
 * `?ver=1`: el menú para mirar, sin pedir. Es el que abre el QR pegado en el
 * local (vía "Ver el menú" en la página de la empresa): fotos, precios y
 * descripciones, sin agregar ni carrito.
 */
export const Route = createFileRoute("/p/$empresa/$local/")({
  validateSearch: (search: Record<string, unknown>): { ver?: boolean } =>
    search.ver === true || search.ver === 1 || search.ver === "1" || search.ver === "true"
      ? { ver: true }
      : {},
  loader: ({ params }) => getOnlineMenuCached(params.empresa, params.local),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Pedí online — ${loaderData.name}` : "Pedido online" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // El link que el comercio comparte por WhatsApp: que la vista previa
      // diga su nombre y no "Totempoint".
      ...(loaderData
        ? ogMeta({
            title: loaderData.name,
            description: `Hacé tu pedido online a ${loaderData.name}`,
          })
        : []),
    ],
  }),
  errorComponent: ({ error }) => <OnlineError message={error.message} />,
  component: OnlineMenuPage,
});

/** El menú del pedido online. La pantalla es `MenuOnline`, compartida con el pedido en mesa. */
function OnlineMenuPage() {
  const menu = Route.useLoaderData();
  const { empresa, local } = Route.useParams();
  const soloVer = Route.useSearch().ver === true;
  // Otra sucursal es otro menú: al cambiarla desde la hoja, arranca de cero.
  return <MenuOnline key={local} menu={menu} canal={{ tipo: "online", empresa, local, soloVer }} />;
}

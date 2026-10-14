import { createFileRoute } from "@tanstack/react-router";
import { getMesaMenuCached } from "@/lib/online-menu-cache";
import { OnlineError } from "@/components/online/OnlineError";
import { MenuOnline } from "@/components/online/MenuOnline";

/**
 * Lo que abre el QR de una mesa: el menú en el celular del cliente. Es la
 * misma pantalla que el pedido online (`MenuOnline`), con la mesa arriba y sin
 * envío, mínimo ni horario.
 */
export const Route = createFileRoute("/m/$token/")({
  loader: ({ params }) => getMesaMenuCached(params.token),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData ? `Mesa ${loaderData.mesa} — ${loaderData.name}` : "Pedí desde tu mesa",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  errorComponent: ({ error }) => <OnlineError message={error.message} />,
  component: MesaMenuPage,
});

function MesaMenuPage() {
  const menu = Route.useLoaderData();
  const { token } = Route.useParams();
  return <MenuOnline menu={menu} canal={{ tipo: "mesa", token, numero: menu.mesa }} />;
}

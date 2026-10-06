import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveOnlineAlias } from "@/lib/api/totem.functions";
import { OnlineError } from "@/components/online/OnlineError";

/**
 * El link corto del pedido online: /primorosas lleva al menú de esa sucursal.
 *
 * Es lo que el comercio pega en WhatsApp, en su perfil o en un QR, y tiene que
 * poder dictarse. Redirige al link completo en vez de mostrar el menú acá: así
 * todo lo demás (carrito, seguimiento, Mercado Pago) sigue con sus rutas de
 * siempre. Las rutas fijas (/admin, /login…) ganan sobre esta, y esos nombres
 * están reservados para que ningún alias los tape.
 */
export const Route = createFileRoute("/$alias")({
  loader: async ({ params }) => {
    const { empresa, local } = await resolveOnlineAlias({ data: { alias: params.alias } });
    throw redirect({ to: "/p/$empresa/$local", params: { empresa, local }, statusCode: 302 });
  },
  errorComponent: ({ error }) => <OnlineError message={error.message} />,
  component: () => null,
});

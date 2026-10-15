import { useLayoutEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getMesaMenuCached } from "@/lib/online-menu-cache";
import { OnlineError } from "@/components/online/OnlineError";
import { MenuOnline } from "@/components/online/MenuOnline";
import { PortadaCelular } from "@/components/online/PortadaCelular";
import { useTotemTheme } from "@/components/totem/useTotemTheme";
import { acentoDe } from "@/components/totem/portada-partes";

/**
 * Lo que abre el QR de una mesa: primero la portada del tótem en el teléfono,
 * con la mesa a la vista, y al tocar Pedir el menú. El menú es la misma
 * pantalla que el pedido online (`MenuOnline`), con la mesa arriba y sin
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

/**
 * Las mesas cuya portada ya pasó el cliente. La portada se ve una vez: al
 * volver del carrito el menú se monta de nuevo y no tiene que aparecer otra
 * vez. En memoria para la navegación dentro de la app (sin parpadeo), y en
 * sessionStorage para cuando recarga la página.
 */
const vistas = new Set<string>();
const claveVista = (token: string) => `mesa-portada:${token}`;

function MesaMenuPage() {
  const { token } = Route.useParams();
  // Otra mesa es otra portada: el estado arranca de cero.
  return <MesaPage key={token} token={token} />;
}

function MesaPage({ token }: { token: string }) {
  const menu = Route.useLoaderData();
  useTotemTheme(menu.accentColor, menu.theme, menu.fontTheme, menu.corners);
  const [enPortada, setEnPortada] = useState(() => !vistas.has(token));

  // El servidor no ve sessionStorage ni el hash: se mira al montar, antes de
  // pintar, para que quien recarga no vea la portada un instante. Con una
  // categoría en el hash el cliente ya estaba en el menú (volvió con "atrás").
  useLayoutEffect(() => {
    let vista = window.location.hash.startsWith("#categoria-");
    try {
      vista ||= sessionStorage.getItem(claveVista(token)) === "1";
    } catch {
      // Sin almacenamiento (modo privado): la portada se ve de nuevo al recargar.
    }
    if (vista) {
      vistas.add(token);
      setEnPortada(false);
    }
  }, [token]);

  const entrar = () => {
    vistas.add(token);
    try {
      sessionStorage.setItem(claveVista(token), "1");
    } catch {
      // Ver arriba.
    }
    setEnPortada(false);
    window.scrollTo({ top: 0 });
  };

  if (enPortada) {
    const pago =
      menu.mercadoPago && menu.cash
        ? " Pagás con Mercado Pago o en efectivo en el mostrador."
        : menu.mercadoPago
          ? " Pagás con Mercado Pago."
          : "";
    return (
      <PortadaCelular
        datos={menu.portada}
        onPedir={entrar}
        aviso={
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-2xl text-white"
              style={{ background: acentoDe(menu.portada) ?? "var(--primary)" }}
            >
              {menu.mesa}
            </div>
            <div className="min-w-0">
              <p className="font-display text-xl leading-tight">Estás en la mesa {menu.mesa}</p>
              <p className="text-sm text-muted-foreground">
                Pedí desde acá y te lo llevamos.{pago}
              </p>
            </div>
          </div>
        }
      />
    );
  }

  return (
    <MenuOnline
      menu={menu}
      canal={{
        tipo: "mesa",
        token,
        numero: menu.mesa,
        onInicio: () => {
          setEnPortada(true);
          window.scrollTo({ top: 0 });
        },
      }}
    />
  );
}

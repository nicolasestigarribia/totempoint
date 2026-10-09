import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import ogIconUrl from "@/assets/og-icon.png";

/**
 * La vista previa que arma WhatsApp (y Telegram, Facebook…) al pegar un link.
 *
 * Sin `og:image` WhatsApp agarraba el `apple-touch-icon`, el logo de 337×486,
 * y como pasa de 300 px de ancho lo mostraba gigante arriba del mensaje. Con
 * una imagen cuadrada de menos de 300 px muestra la miniatura chica al costado
 * del título, que es lo que se busca para un link que se comparte todo el día.
 *
 * La URL tiene que ser absoluta: los crawlers no resuelven rutas relativas. En
 * el servidor sale del request (Railway pasa el dominio en `x-forwarded-host`),
 * así que sirve igual con el dominio de Railway o uno propio.
 */
const origen = createIsomorphicFn()
  .server(() => getRequestUrl({ xForwardedHost: true }).origin)
  .client(() => window.location.origin);

export function ogMeta({ title, description }: { title: string; description: string }) {
  return [
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:image", content: `${origen()}${ogIconUrl}` },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:width", content: "256" },
    { property: "og:image:height", content: "256" },
    { name: "twitter:card", content: "summary" },
  ];
}

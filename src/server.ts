import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Las imágenes de los negocios viven en la base y se sirven acá, antes de
      // que el request entre al router.
      const { pathname } = new URL(request.url);
      if (pathname.startsWith("/img/")) {
        const id = Number(pathname.slice("/img/".length));
        if (Number.isInteger(id) && id > 0) {
          const { serveImage } = await import("./lib/images");
          return await serveImage(id);
        }
        return new Response("Not found", { status: 404 });
      }

      // El manifiesto y los íconos del tótem: archivos que pide el navegador
      // para instalarlo como aplicación en la tablet, no pantallas de la app.
      // Cuelgan de la URL del tótem —empresa, local y número— porque cada
      // tablet instala el suyo y tiene que volver siempre al mismo puesto.
      const totem = pathname.match(
        /^\/t\/([a-z0-9-]{1,60})\/([a-z0-9-]{1,60})\/(\d{1,6})\/(?:manifest\.webmanifest|icon-(maskable-)?(192|512)\.png)$/i,
      );
      if (totem) {
        const [, empresa, local, numero, maskable, tamanio] = totem;
        const ubicacion = { empresa, local, totem: Number(numero) };
        const { serveTotemManifest, serveTotemIcon } = await import("./lib/totem-manifest");
        return tamanio
          ? await serveTotemIcon(ubicacion, Number(tamanio), Boolean(maskable))
          : await serveTotemManifest(ubicacion);
      }

      // Aviso de pago de Mercado Pago. Como las imágenes, se atiende acá antes
      // del router: no es una ruta de la app, es un endpoint que llama un
      // servidor de afuera.
      if (pathname === "/api/mp/webhook") {
        const { handleMercadoPagoWebhook } = await import("./lib/payments/webhook");
        return await handleMercadoPagoWebhook(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

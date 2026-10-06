import { createServerFn } from "@tanstack/react-start";

/**
 * Configuración pública que el cliente necesita al arrancar: la API key de
 * Google Maps que usan el buscador de direcciones y el mapa.
 *
 * La key vive en el servidor (`GOOGLE_MAPS_KEY`) y se entrega en runtime, así
 * que no queda horneada en el bundle y cambiarla es editar el env + reiniciar,
 * sin re-buildear. Es la key de navegador: restringíla por referrer en Google
 * Cloud. El Distance Matrix server-side usa otra key que nunca sale de acá
 * (`GOOGLE_MAPS_SERVER_KEY`), así que ese secreto no se expone.
 *
 * Sin auth a propósito: lo consume el pedido online, que corre sin sesión.
 */
export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    googleMapsKey: process.env.GOOGLE_MAPS_KEY ?? null,
  };
});

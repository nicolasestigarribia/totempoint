/**
 * Carga del SDK de Google Maps en el navegador, una sola vez.
 *
 * La key no está en el bundle: se pide al servidor (`getPublicConfig`) en
 * runtime y recién ahí se arranca el loader. Todo lo que toca `window.google`
 * —el buscador de direcciones y el mapa— espera a `cargarGoogleMaps()`.
 *
 * Se piden las librerías `places` (autocompletado + detalles), `maps` (el mapa)
 * y `geocoding` (dirección ↔ punto, para el GPS y al mover el pin). El Distance
 * Matrix NO se usa acá: va server-side con su propia key (ver distance-server.ts).
 */
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { getPublicConfig } from "@/lib/api/config.functions";

let promesa: Promise<void> | null = null;

export function cargarGoogleMaps(): Promise<void> {
  if (promesa) return promesa;
  promesa = (async () => {
    const { googleMapsKey } = await getPublicConfig();
    if (!googleMapsKey) {
      throw new Error("GOOGLE_MAPS_KEY no está configurada en el servidor");
    }
    // v3.64 fija: el proyecto comparte un solo loader entre el buscador y el
    // mapa, y las versiones weekly rompen APIs sin aviso. Places/Maps/Geocoding
    // son estables en 3.64.
    setOptions({ key: googleMapsKey, v: "3.64" });
    await Promise.all([importLibrary("places"), importLibrary("maps"), importLibrary("geocoding")]);
  })();
  // Si falla, permitir reintentar en la próxima llamada en vez de quedar pegado.
  promesa.catch(() => {
    promesa = null;
  });
  return promesa;
}

/**
 * Buscar direcciones y saber qué dirección es un punto del mapa, con Google
 * Maps (Places + Geocoding). Reemplazó a Photon/OpenStreetMap: Google tiene las
 * alturas que OSM no tenía (Cariló, countrys), así que ya no hace falta la
 * gimnasia de "calle sola + altura aproximada".
 *
 * Todo corre en el navegador sobre el SDK que carga `maps/google.ts`; la key es
 * la de navegador (restringida por referrer). El autocompletado devuelve solo
 * predicciones (texto + placeId) y las coordenadas se piden recién al elegir
 * una (`detalleDePlace`): así no se paga un Place Details por cada sugerencia.
 *
 * Que no encuentre una dirección no frena a nadie: el cliente siempre puede
 * marcar el punto a mano en el mapa. El punto es lo que vale para el repartidor
 * y para el costo.
 */
import { cargarGoogleMaps } from "@/lib/maps/google";
import type { Punto } from "@/lib/delivery";

/** Un punto con dirección: lo que queda como destino del pedido. */
export interface Lugar extends Punto {
  label: string;
  /**
   * Quedó del buscador anterior (OSM, que no tenía alturas). Con Google siempre
   * es falso —trae la puerta—, pero se mantiene el campo para no tocar la pantalla
   * de dirección, que lo usa para decidir si el repartidor va por el texto.
   */
  aproximada?: boolean;
}

/** Una sugerencia del autocompletado, sin coordenadas todavía. */
export interface Prediccion {
  placeId: string;
  /** Línea principal (calle y altura). */
  label: string;
  /** Línea secundaria (localidad, provincia). */
  secundaria?: string;
}

/**
 * El token de sesión agrupa las pulsaciones de una misma búsqueda con el Place
 * Details que la cierra, para que Google las cobre como una sola sesión. Lo crea
 * y descarta el buscador (una sesión por dirección elegida).
 */
export type SesionBusqueda = google.maps.places.AutocompleteSessionToken;

export async function nuevaSesion(): Promise<SesionBusqueda> {
  await cargarGoogleMaps();
  return new google.maps.places.AutocompleteSessionToken();
}

/**
 * Sugerencias para lo que el cliente va escribiendo, sesgadas hacia la sucursal
 * para que "Avellano" dé la de Cariló y no otra provincia. Solo Argentina.
 */
export async function buscarDirecciones(
  texto: string,
  cerca: Punto | null,
  sesion?: SesionBusqueda,
  signal?: AbortSignal,
): Promise<Prediccion[]> {
  const q = texto.trim();
  if (q.length < 3) return [];
  await cargarGoogleMaps();
  if (signal?.aborted) return [];

  const service = new google.maps.places.AutocompleteService();
  const request: google.maps.places.AutocompletionRequest = {
    input: q,
    componentRestrictions: { country: "ar" },
    sessionToken: sesion,
  };
  if (cerca) {
    request.location = new google.maps.LatLng(cerca.lat, cerca.lng);
    request.radius = 40_000; // 40 km: el envío llega a pocos km, no a otra ciudad.
  }

  const predicciones = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => {
    service.getPlacePredictions(request, (res, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !res) resolve([]);
      else resolve(res);
    });
  });
  if (signal?.aborted) return [];

  return predicciones.map((p) => ({
    placeId: p.place_id,
    label: p.structured_formatting?.main_text ?? p.description,
    secundaria: p.structured_formatting?.secondary_text,
  }));
}

/** Las coordenadas y la dirección final de una predicción elegida. */
export async function detalleDePlace(
  placeId: string,
  sesion?: SesionBusqueda,
): Promise<Lugar | null> {
  await cargarGoogleMaps();
  const service = new google.maps.places.PlacesService(document.createElement("div"));
  return new Promise<Lugar | null>((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: ["formatted_address", "geometry.location", "name"],
        sessionToken: sesion,
      },
      (place, status) => {
        const loc = place?.geometry?.location;
        if (status !== google.maps.places.PlacesServiceStatus.OK || !loc) {
          resolve(null);
          return;
        }
        resolve({
          lat: loc.lat(),
          lng: loc.lng(),
          label: place.formatted_address ?? place.name ?? "",
        });
      },
    );
  });
}

/** Qué dirección hay en un punto: para el GPS y para cuando el cliente mueve el pin. */
export async function direccionDe(punto: Punto, signal?: AbortSignal): Promise<string | null> {
  await cargarGoogleMaps();
  if (signal?.aborted) return null;
  const geocoder = new google.maps.Geocoder();
  try {
    const { results } = await geocoder.geocode({
      location: { lat: punto.lat, lng: punto.lng },
    });
    if (signal?.aborted) return null;
    return results[0]?.formatted_address ?? null;
  } catch {
    return null;
  }
}

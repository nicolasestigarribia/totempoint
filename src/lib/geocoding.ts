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
 * Hasta dónde se buscan direcciones alrededor de la sucursal. El envío llega a
 * pocos kilómetros; esto solo tiene que cubrir la ciudad y las vecinas.
 */
const RADIO_BUSQUEDA_KM = 30;

/** Un cuadrado de `km` de lado a cada lado del punto, para Google. */
function zonaAlrededor(p: Punto, km: number): google.maps.LatLngBoundsLiteral {
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.cos((p.lat * Math.PI) / 180));
  return { north: p.lat + dLat, south: p.lat - dLat, east: p.lng + dLng, west: p.lng - dLng };
}

/**
 * Sugerencias para lo que el cliente va escribiendo, solo en la zona de la
 * sucursal. Con `location` + `radius` Google apenas las ordenaba: "cerezo 140"
 * sugería también Jujuy, Santa Cruz y Córdoba, y un cliente apurado podía tocar
 * una de esas. `locationRestriction` las deja afuera. Sin sucursal (el dueño
 * marcando el origen por primera vez) se busca en toda Argentina.
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
  if (cerca) request.locationRestriction = zonaAlrededor(cerca, RADIO_BUSQUEDA_KM);

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

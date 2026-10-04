/**
 * Buscar direcciones y saber qué dirección es un punto del mapa.
 *
 * Usa Photon (photon.komoot.io), un buscador gratuito y sin clave sobre los
 * datos de OpenStreetMap — Google Places pide tarjeta, y eso está descartado.
 * Se llama desde el navegador del cliente, no desde nuestro servidor: así cada
 * cliente consume su propia cuota del servicio y no la de todos juntos.
 *
 * Que no encuentre una dirección no frena a nadie: el cliente siempre puede
 * marcar el punto a mano en el mapa y escribir la dirección como quiera. El
 * punto del mapa es lo que vale para el repartidor y para el costo.
 */
import type { Punto } from "@/lib/delivery";

const PHOTON = "https://photon.komoot.io";

export interface Lugar extends Punto {
  /** Lo que se le muestra al cliente y queda como dirección del pedido. */
  label: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    locality?: string;
    district?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  };
}

function armarLabel(p: PhotonFeature["properties"]): string {
  const calle = p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : null;
  // Si es un lugar con nombre propio (un hotel, un parador) va el nombre
  // primero, y la calle después si la tiene.
  const principal = p.name && p.name !== p.street ? p.name : calle;
  const secundaria = principal === calle ? null : calle;
  const ciudad = p.city ?? p.locality ?? p.district ?? p.county;
  return [principal, secundaria, ciudad].filter(Boolean).join(", ");
}

function aLugar(f: PhotonFeature): Lugar {
  const [lng, lat] = f.geometry.coordinates;
  return { lat, lng, label: armarLabel(f.properties) };
}

/**
 * Sugerencias para lo que el cliente va escribiendo, priorizando lo que está
 * cerca de la sucursal: "Avellano" tiene que dar la de Cariló, no la de otra
 * provincia.
 */
export async function buscarDirecciones(
  texto: string,
  cerca: Punto | null,
  signal?: AbortSignal,
): Promise<Lugar[]> {
  const q = texto.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, limit: "6", lang: "default" });
  if (cerca) {
    params.set("lat", String(cerca.lat));
    params.set("lon", String(cerca.lng));
  }
  const res = await fetch(`${PHOTON}/api/?${params}`, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { features?: PhotonFeature[] };
  const vistos = new Set<string>();
  return (json.features ?? [])
    .filter((f) => !f.properties.countrycode || f.properties.countrycode === "AR")
    .map(aLugar)
    .filter((l) => l.label && !vistos.has(l.label) && vistos.add(l.label));
}

/** Qué dirección hay en un punto: para el GPS y para cuando el cliente mueve el pin. */
export async function direccionDe(punto: Punto, signal?: AbortSignal): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: String(punto.lat),
      lon: String(punto.lng),
      lang: "default",
    });
    const res = await fetch(`${PHOTON}/reverse?${params}`, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: PhotonFeature[] };
    const f = json.features?.[0];
    return f ? armarLabel(f.properties) || null : null;
  } catch {
    return null;
  }
}

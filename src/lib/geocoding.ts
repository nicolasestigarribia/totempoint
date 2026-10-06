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
import { distanciaKm, type Punto } from "@/lib/delivery";

const PHOTON = "https://photon.komoot.io";

export interface Lugar extends Punto {
  /** Lo que se le muestra al cliente y queda como dirección del pedido. */
  label: string;
  /**
   * Se encontró la calle pero no la altura: el punto es algún lugar de esa
   * calle y el cliente tiene que llevar el pin hasta su puerta.
   */
  aproximada?: boolean;
}

/**
 * Más allá de esto, una sugerencia no puede ser la dirección del cliente: el
 * envío llega a unos pocos kilómetros. Sin este corte, "cerezo 542" en Cariló
 * sugería "Flor de Cerezo 542" en Catamarca, porque ahí sí está cargada la
 * altura y Photon prefiere lo exacto a lo cercano.
 */
const RADIO_KM = 40;

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    type?: string;
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

async function consultar(
  q: string,
  cerca: Punto | null,
  signal?: AbortSignal,
): Promise<PhotonFeature[]> {
  const params = new URLSearchParams({ q, limit: "10", lang: "default" });
  if (cerca) {
    params.set("lat", String(cerca.lat));
    params.set("lon", String(cerca.lng));
  }
  const res = await fetch(`${PHOTON}/api/?${params}`, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { features?: PhotonFeature[] };
  return (json.features ?? []).filter((f) => {
    if (f.properties.countrycode && f.properties.countrycode !== "AR") return false;
    if (!cerca) return true;
    const [lng, lat] = f.geometry.coordinates;
    return distanciaKm(cerca, { lat, lng }) <= RADIO_KM;
  });
}

const sinRepetir = (lugares: Lugar[]) => {
  const vistos = new Set<string>();
  return lugares.filter((l) => l.label && !vistos.has(l.label) && vistos.add(l.label));
};

/**
 * "Avellano y Cerezo": OpenStreetMap no tiene las esquinas como lugar, así que
 * se buscan las dos calles cerca de la sucursal y se toma el par de tramos más
 * cercano entre sí. Photon da el centro de cada tramo y no su trazado, así que
 * el punto es aproximado: cae cerca de la esquina y el cliente lo ajusta.
 */
async function buscarEsquina(
  a: string,
  b: string,
  cerca: Punto | null,
  signal?: AbortSignal,
): Promise<Lugar | null> {
  const [tramosA, tramosB] = await Promise.all(
    [a, b].map(async (calle) =>
      (await consultar(calle.trim(), cerca, signal)).filter((f) => f.properties.type === "street"),
    ),
  );
  let mejor: { fa: PhotonFeature; fb: PhotonFeature; km: number } | null = null;
  for (const fa of tramosA) {
    for (const fb of tramosB) {
      const [lngA, latA] = fa.geometry.coordinates;
      const [lngB, latB] = fb.geometry.coordinates;
      const km = distanciaKm({ lat: latA, lng: lngA }, { lat: latB, lng: lngB });
      if (!mejor || km < mejor.km) mejor = { fa, fb, km };
    }
  }
  // Tramos a más de un kilómetro no se cruzan: serían calles homónimas.
  if (!mejor || mejor.km > 1) return null;
  const [lngA, latA] = mejor.fa.geometry.coordinates;
  const [lngB, latB] = mejor.fb.geometry.coordinates;
  const p = mejor.fa.properties;
  const ciudad = p.city ?? p.locality ?? p.district ?? p.county;
  return {
    lat: (latA + latB) / 2,
    lng: (lngA + lngB) / 2,
    label: [`${p.name} y ${mejor.fb.properties.name}`, ciudad].filter(Boolean).join(", "),
    aproximada: true,
  };
}

/**
 * Sugerencias para lo que el cliente va escribiendo, solo cerca de la
 * sucursal: "Avellano" tiene que dar la de Cariló, no la de otra provincia.
 *
 * En muchos lugares OpenStreetMap tiene las calles pero no las alturas —Cariló
 * es uno—, así que "Cerezo 542" no aparece. En ese caso se busca la calle sola
 * y se ofrece con la altura que escribió el cliente, marcada como aproximada:
 * el pin cae en la calle y él lo lleva hasta la puerta. Antes no aparecía nada
 * y parecía que la dirección no existía.
 */
export async function buscarDirecciones(
  texto: string,
  cerca: Punto | null,
  signal?: AbortSignal,
): Promise<Lugar[]> {
  const q = texto.trim();
  if (q.length < 3) return [];

  const encontradas = await consultar(q, cerca, signal);
  const exactas = sinRepetir(encontradas.map(aLugar));

  const cruce = q.match(/^(.+?)\s+(?:y|e|esq\.?|esquina)\s+([^,]+)/i);
  if (cruce && exactas.length === 0) {
    const esquina = await buscarEsquina(cruce[1], cruce[2], cerca, signal);
    return esquina ? [esquina] : [];
  }

  // "Cerezo 542", "Cerezo 542, Cariló": la altura es el número suelto.
  const altura = q.match(/(?:^|\s)(\d{1,5})(?=\s*(?:,|$))/)?.[1];
  if (!altura || encontradas.some((f) => f.properties.housenumber === altura)) {
    return exactas.slice(0, 6);
  }

  const calle = q.replace(altura, " ").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
  if (calle.length < 3) return exactas.slice(0, 6);
  const calles = (await consultar(calle, cerca, signal))
    .filter((f) => f.properties.type === "street")
    .map((f): Lugar => {
      const [lng, lat] = f.geometry.coordinates;
      const p = f.properties;
      const ciudad = p.city ?? p.locality ?? p.district ?? p.county;
      return {
        lat,
        lng,
        label: [`${p.name ?? p.street} ${altura}`, ciudad].filter(Boolean).join(", "),
        aproximada: true,
      };
    });
  return sinRepetir([...calles, ...exactas]).slice(0, 6);
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

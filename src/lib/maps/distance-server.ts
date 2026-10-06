/**
 * Distancia por ruta real entre dos puntos, con la Routes API de Google
 * (`computeRoutes`). Es server-side a propósito: el costo del envío se recalcula
 * al tomar el pedido (nunca se confía en lo que manda el celular), y esta API no
 * se llama desde el navegador en ese momento.
 *
 * Se usa Routes API y no la Distance Matrix legacy porque Google ya no habilita
 * la legacy en proyectos nuevos (devuelve "legacy API not enabled"). Hay que
 * habilitar **Routes API** en el proyecto de Google Cloud.
 *
 * Usa `GOOGLE_MAPS_SERVER_KEY` si está (key sin restricción de referrer, para
 * llamar desde el servidor); si no, cae a `GOOGLE_MAPS_KEY`. Devuelve los km de
 * manejo, o null si Google no responde: el que llama cae a la línea recta
 * (haversine) para no perder la venta, la misma regla que sigue Mercado Pago.
 *
 * Es un módulo plano —no un `*.functions.ts`— para no arrastrar la key ni el
 * fetch del servidor al bundle del cliente.
 */
import type { Punto } from "@/lib/delivery";

interface ComputeRoutesResponse {
  routes?: { distanceMeters?: number }[];
}

export async function distanciaPorRutaKm(origen: Punto, destino: Punto): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.GOOGLE_MAPS_KEY;
  if (!key) return null;

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origen.lat, longitude: origen.lng } } },
        destination: { location: { latLng: { latitude: destino.lat, longitude: destino.lng } } },
        travelMode: "DRIVE",
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ComputeRoutesResponse;
    const metros = json.routes?.[0]?.distanceMeters;
    if (typeof metros !== "number") return null;
    return metros / 1000;
  } catch {
    return null;
  }
}

/**
 * Cuánto sale un envío, a partir de dónde está el cliente.
 *
 * Funciona como PedidosYa o Rappi: el cliente marca su dirección en el mapa y
 * el sistema decide si llega y cuánto cuesta. El dueño carga tramos ("hasta
 * 2 km, $1.500") y el último tramo es el alcance máximo: más lejos, no se
 * hace el envío. El cliente nunca elige una zona — una zona no le dice nada al
 * repartidor.
 *
 * Es un módulo puro a propósito: lo usa el celular para mostrar el costo
 * mientras el cliente mueve el pin, y el servidor para recalcularlo al tomar
 * el pedido, que es el que vale.
 */

export interface TramoEnvio {
  /** Hasta cuántos km llega este tramo. */
  upToKm: number;
  price: number;
}

export interface Punto {
  lat: number;
  lng: number;
}

const RADIO_TIERRA_KM = 6371;

/**
 * Distancia en línea recta entre dos puntos (haversine). Es la que usan la
 * mayoría de los locales chicos para cobrar el envío: no depende de ningún
 * servicio de rutas y el cliente la entiende mirando el mapa.
 */
export function distanciaKm(a: Punto, b: Punto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(h));
}

export type Cotizacion =
  | { llega: true; km: number; precio: number }
  | { llega: false; km: number; maxKm: number };

/** El costo del envío a esa distancia, o que no llega si pasa el último tramo. */
export function cotizarEnvio(tramos: TramoEnvio[], km: number): Cotizacion {
  const ordenados = [...tramos].sort((a, b) => a.upToKm - b.upToKm);
  const tramo = ordenados.find((t) => km <= t.upToKm);
  if (!tramo) return { llega: false, km, maxKm: ordenados.at(-1)?.upToKm ?? 0 };
  return { llega: true, km, precio: tramo.price };
}

/** "1,3 km" / "800 m": como se lo decimos al cliente y al repartidor. */
export function formatearDistancia(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 100) * 100)} m`;
  return `${km.toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`;
}

/** Link que abre la navegación de Google Maps hasta el punto. No necesita clave. */
export function linkNavegacion(lat: number | string, lng: number | string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/**
 * Navegación hasta una dirección escrita, para cuando el punto del mapa es
 * solo la calle. Google Maps la busca con sus propios datos, que sí tienen la
 * numeración que le falta a OpenStreetMap, y el link no necesita clave de API.
 */
export function linkNavegacionADireccion(direccion: string): string {
  const destino = /argentina/i.test(direccion) ? direccion : `${direccion}, Argentina`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
}

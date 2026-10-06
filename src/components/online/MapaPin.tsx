import { useEffect, useRef, useState } from "react";
import { cargarGoogleMaps } from "@/lib/maps/google";
import type { Punto } from "@/lib/delivery";

/**
 * Un mapa con un pin que se arrastra, para marcar el punto exacto: la puerta
 * del cliente. Es Google Maps JS, cargado recién en el navegador (toca `window`
 * apenas se importa); en el servidor queda una caja vacía del mismo tamaño.
 *
 * El pin se mueve arrastrándolo o tocando el mapa: en un celular, arrastrar un
 * pin chico con el dedo es difícil, tocar donde va es más fácil. `gestureHandling:
 * "cooperative"` deja que un dedo scrollee la página y el mapa se mueva con dos
 * dedos (o Ctrl + rueda), así el mapa no se queda con el gesto en medio de una
 * página larga.
 */
export function MapaPin({
  pin,
  onMover,
  origen,
  alcanceKm,
  color = "#e11d48",
  className = "h-64",
}: {
  pin: Punto;
  onMover: (p: Punto) => void;
  /** La sucursal, para que el cliente vea desde dónde sale el envío. */
  origen?: Punto | null;
  /** Hasta dónde llegan los envíos, dibujado como un círculo alrededor de la sucursal. */
  alcanceKm?: number | null;
  color?: string;
  className?: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<google.maps.Map | null>(null);
  const marcador = useRef<google.maps.Marker | null>(null);
  const circulo = useRef<google.maps.Circle | null>(null);
  // El callback cambia en cada render del padre; el mapa se arma una sola vez.
  const onMoverRef = useRef(onMover);
  onMoverRef.current = onMover;
  // El SDK carga async: recién cuando el mapa existe corren los efectos que
  // mueven el pin y dibujan el círculo (si no, se los perdían por llegar antes).
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let vivo = true;
    void cargarGoogleMaps().then(() => {
      if (!vivo || !contenedor.current || mapa.current) return;
      const m = new google.maps.Map(contenedor.current, {
        center: { lat: pin.lat, lng: pin.lng },
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "cooperative",
      });

      const mk = new google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map: m,
        draggable: true,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
          scale: 1.8,
          anchor: new google.maps.Point(12, 22),
        },
      });
      mk.addListener("dragend", () => {
        const p = mk.getPosition();
        if (p) onMoverRef.current({ lat: p.lat(), lng: p.lng() });
      });
      m.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        mk.setPosition(e.latLng);
        onMoverRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });

      mapa.current = m;
      marcador.current = mk;
      setListo(true);
    });
    return () => {
      vivo = false;
      circulo.current?.setMap(null);
      marcador.current?.setMap(null);
      mapa.current = null;
      marcador.current = null;
      circulo.current = null;
    };
    // Se arma una sola vez; los cambios de pin y de alcance se aplican abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el pin cambia desde afuera (eligió una sugerencia, usó el GPS), el mapa
  // va hasta ahí.
  useEffect(() => {
    const mk = marcador.current;
    const m = mapa.current;
    if (!mk || !m) return;
    const actual = mk.getPosition();
    if (actual && actual.lat() === pin.lat && actual.lng() === pin.lng) return;
    mk.setPosition({ lat: pin.lat, lng: pin.lng });
    m.panTo({ lat: pin.lat, lng: pin.lng });
    if (m.getZoom()! < 16) m.setZoom(16);
  }, [pin.lat, pin.lng, listo]);

  // El alcance de los envíos, como un círculo alrededor de la sucursal.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    circulo.current?.setMap(null);
    circulo.current = null;
    if (origen && alcanceKm) {
      circulo.current = new google.maps.Circle({
        center: { lat: origen.lat, lng: origen.lng },
        radius: alcanceKm * 1000,
        map: m,
        strokeColor: color,
        strokeWeight: 1,
        fillColor: color,
        fillOpacity: 0.06,
        clickable: false,
      });
    }
  }, [origen, alcanceKm, color, listo]);

  return (
    <div
      ref={contenedor}
      className={`w-full overflow-hidden rounded-2xl border border-border bg-muted ${className}`}
    />
  );
}

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker, Circle } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Punto } from "@/lib/delivery";

/**
 * Un mapa con un pin que se arrastra, para marcar el punto exacto: la puerta
 * del cliente o el local de la sucursal.
 *
 * Es Leaflet con el mapa de OpenStreetMap, gratis y sin clave. Leaflet toca
 * `window` apenas se importa, así que se carga recién en el navegador; en el
 * servidor esto es una caja vacía del mismo tamaño.
 *
 * El pin se mueve arrastrándolo o tocando el mapa: en un celular, arrastrar un
 * pin chico con el dedo es difícil, tocar donde va es más fácil. El mapa no
 * se queda con el scroll de la página: ver las opciones de `L.map` abajo.
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
  const mapa = useRef<LeafletMap | null>(null);
  const marcador = useRef<Marker | null>(null);
  const circulo = useRef<Circle | null>(null);
  // El callback cambia en cada render del padre; el mapa se arma una sola vez.
  const onMoverRef = useRef(onMover);
  onMoverRef.current = onMover;

  useEffect(() => {
    let vivo = true;
    let observador: ResizeObserver | null = null;
    void import("leaflet").then((L) => {
      if (!vivo || !contenedor.current || mapa.current) return;
      const m = L.map(contenedor.current, {
        zoomControl: true,
        attributionControl: true,
        // El mapa está en medio de una página que se scrollea. Si la rueda
        // hace zoom y un dedo arrastra el mapa, pasar por encima del mapa deja
        // al cliente sin poder volver arriba: el mapa se queda con el gesto.
        // Así que la rueda scrollea la página (el zoom va con + y −), y en
        // pantallas táctiles un dedo también: el mapa se mueve con dos dedos,
        // y el pin, tocando donde va o arrastrando el pin mismo.
        scrollWheelZoom: false,
        dragging: !L.Browser.mobile,
      }).setView([pin.lat, pin.lng], 16);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(m);

      // Pin dibujado con un div y no con la imagen de Leaflet, que el bundler
      // no encuentra y sale como un cuadrado roto.
      const icono = L.divIcon({
        className: "",
        html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg"><path d="M17 43C17 43 33 27.5 33 17A16 16 0 0 0 1 17C1 27.5 17 43 17 43Z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="17" cy="17" r="6" fill="white"/></svg>`,
        iconSize: [34, 44],
        iconAnchor: [17, 43],
      });
      const mk = L.marker([pin.lat, pin.lng], { draggable: true, icon: icono }).addTo(m);
      mk.on("dragend", () => {
        const p = mk.getLatLng();
        onMoverRef.current({ lat: p.lat, lng: p.lng });
      });
      m.on("click", (e) => {
        mk.setLatLng(e.latlng);
        onMoverRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapa.current = m;
      marcador.current = mk;

      // Leaflet mide la caja una sola vez, al crearse. Si en ese momento la
      // página todavía se estaba acomodando, el centro y el pin quedan corridos
      // (el pin aparecía afuera del mapa). Cada vez que la caja cambia de
      // tamaño se vuelve a medir y se recentra en el pin.
      observador = new ResizeObserver(() => {
        m.invalidateSize();
        m.setView(mk.getLatLng(), m.getZoom(), { animate: false });
      });
      observador.observe(contenedor.current);
    });
    return () => {
      vivo = false;
      observador?.disconnect();
      mapa.current?.remove();
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
    const actual = mk.getLatLng();
    if (actual.lat === pin.lat && actual.lng === pin.lng) return;
    mk.setLatLng([pin.lat, pin.lng]);
    m.setView([pin.lat, pin.lng], Math.max(m.getZoom(), 16));
  }, [pin.lat, pin.lng]);

  // El alcance de los envíos, como un círculo alrededor de la sucursal.
  useEffect(() => {
    let vivo = true;
    void import("leaflet").then((L) => {
      const m = mapa.current;
      if (!vivo || !m) return;
      circulo.current?.remove();
      circulo.current = null;
      if (origen && alcanceKm) {
        circulo.current = L.circle([origen.lat, origen.lng], {
          radius: alcanceKm * 1000,
          color,
          weight: 1,
          fillOpacity: 0.06,
          interactive: false,
        }).addTo(m);
      }
    });
    return () => {
      vivo = false;
    };
  }, [origen, alcanceKm, color]);

  return (
    <div
      ref={contenedor}
      // isolate: Leaflet usa z-index altos y sin esto el mapa tapa la barra
      // de abajo y los diálogos.
      className={`isolate w-full overflow-hidden rounded-2xl border border-border bg-muted ${className}`}
    />
  );
}

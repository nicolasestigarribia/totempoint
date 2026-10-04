import { useEffect, useRef, useState } from "react";
import { History, MapPin } from "lucide-react";
import { BuscadorDireccion } from "@/components/online/BuscadorDireccion";
import { MapaPin } from "@/components/online/MapaPin";
import {
  cotizarEnvio,
  distanciaKm,
  formatearDistancia,
  type Cotizacion,
  type Punto,
  type TramoEnvio,
} from "@/lib/delivery";
import { direccionDe } from "@/lib/geocoding";
import { formatPrice } from "@/lib/totem-cart";

/** A dónde va el pedido: lo que se le manda al servidor y se guarda para la próxima. */
export interface Destino extends Punto {
  /** La dirección escrita ("Avellano y Cerezo, Cariló"), editable por el cliente. */
  address: string;
  /** Piso, depto, entre calles, "sombrilla roja". */
  details: string;
}

/**
 * La dirección de entrega, como en PedidosYa: el cliente busca la dirección (o
 * usa el GPS), confirma el punto en el mapa moviendo el pin, y agrega lo que el
 * mapa no dice. El punto es lo que usa el repartidor; el costo sale solo de la
 * distancia a la sucursal, y si queda fuera del alcance se le dice acá, antes
 * de que mande nada.
 */
export function DireccionEntrega({
  origen,
  tramos,
  destino,
  anterior,
  onCambiar,
  accent,
}: {
  origen: Punto;
  tramos: TramoEnvio[];
  destino: Destino | null;
  /** La dirección del pedido anterior, guardada en el celular. */
  anterior: Destino | null;
  onCambiar: (d: Destino | null) => void;
  accent: string;
}) {
  // Si mueve el pin se busca qué dirección es, pero sin pisar lo que el
  // cliente ya escribió a mano: su texto vale más que el del mapa.
  const [escritaAMano, setEscritaAMano] = useState(false);
  const consulta = useRef<AbortController | null>(null);
  const destinoRef = useRef(destino);
  destinoRef.current = destino;

  useEffect(() => () => consulta.current?.abort(), []);

  const moverPin = (p: Punto) => {
    const actual = destinoRef.current;
    onCambiar({ address: actual?.address ?? "", details: actual?.details ?? "", ...p });
    if (escritaAMano) return;
    consulta.current?.abort();
    const control = new AbortController();
    consulta.current = control;
    void direccionDe(p, control.signal).then((label) => {
      const ahora = destinoRef.current;
      if (!label || control.signal.aborted || !ahora) return;
      onCambiar({ ...ahora, address: label });
    });
  };

  const cotizacion: Cotizacion | null = destino
    ? cotizarEnvio(tramos, distanciaKm(origen, destino))
    : null;
  const alcance = Math.max(...tramos.map((t) => t.upToKm));

  return (
    <div className="space-y-3">
      {anterior && !destino && (
        <button
          type="button"
          onClick={() => {
            setEscritaAMano(true);
            onCambiar(anterior);
          }}
          className="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left"
        >
          <History className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block font-bold">Usar la de la última vez</span>
            <span className="block truncate text-sm text-muted-foreground">
              {anterior.address}
              {anterior.details && ` · ${anterior.details}`}
            </span>
          </span>
        </button>
      )}

      <BuscadorDireccion
        cerca={origen}
        placeholder={destino ? "Buscar otra dirección" : "Calle y altura, o esquina"}
        onElegir={(l) => {
          setEscritaAMano(false);
          onCambiar({ lat: l.lat, lng: l.lng, address: l.label, details: destino?.details ?? "" });
        }}
      />

      {destino && (
        <>
          <MapaPin
            pin={destino}
            onMover={moverPin}
            origen={origen}
            alcanceKm={alcance}
            color={accent.startsWith("#") ? accent : "#e11d48"}
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Mové el pin, o tocá el mapa, hasta la puerta exacta.
          </p>

          {cotizacion &&
            (cotizacion.llega ? (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm">
                Estás a {formatearDistancia(cotizacion.km)} · Envío{" "}
                <span className="font-bold">
                  {cotizacion.precio > 0 ? formatPrice(cotizacion.precio) : "gratis"}
                </span>
              </p>
            ) : (
              <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                No llegamos hasta ahí: estás a {formatearDistancia(cotizacion.km)} y hacemos envíos
                hasta {formatearDistancia(cotizacion.maxKm)}. Podés elegir retirarlo.
              </p>
            ))}

          <div className="space-y-2">
            <label htmlFor="direccion" className="block text-sm font-bold">
              Dirección
            </label>
            <input
              id="direccion"
              value={destino.address}
              onChange={(e) => {
                setEscritaAMano(true);
                onCambiar({ ...destino, address: e.target.value });
              }}
              required
              minLength={3}
              maxLength={255}
              placeholder="Calle y altura, o esquina"
              className="h-12 w-full rounded-xl border border-border bg-card/40 px-4 outline-none focus:border-primary"
            />
            <input
              value={destino.details}
              onChange={(e) => onCambiar({ ...destino, details: e.target.value })}
              maxLength={255}
              placeholder="Piso, depto, entre calles, o en la playa: parador y sombrilla"
              aria-label="Indicaciones para el repartidor"
              className="h-12 w-full rounded-xl border border-border bg-card/40 px-4 outline-none focus:border-primary"
            />
          </div>
        </>
      )}
    </div>
  );
}

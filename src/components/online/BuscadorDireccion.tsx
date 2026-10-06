import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import type { Punto } from "@/lib/delivery";
import {
  buscarDirecciones,
  detalleDePlace,
  direccionDe,
  nuevaSesion,
  type Lugar,
  type Prediccion,
  type SesionBusqueda,
} from "@/lib/geocoding";

/**
 * Buscar una dirección escribiéndola, o tomar la ubicación del celular. Las
 * sugerencias aparecen mientras se escribe, como en PedidosYa, y priorizan lo
 * que está cerca de la sucursal.
 *
 * El autocompletado solo trae texto; las coordenadas se piden al elegir una
 * sugerencia (Place Details). Un token de sesión agrupa el tipeo con ese detalle
 * para que Google lo cobre como una sola búsqueda.
 */
export function BuscadorDireccion({
  cerca,
  onElegir,
  placeholder = "Calle y altura, o esquina",
  inputClassName = "h-12 rounded-xl",
}: {
  cerca: Punto | null;
  onElegir: (lugar: Lugar) => void;
  placeholder?: string;
  inputClassName?: string;
}) {
  const [texto, setTexto] = useState("");
  const [sugerencias, setSugerencias] = useState<Prediccion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [gps, setGps] = useState<"nada" | "buscando" | "error">("nada");
  const [errorDetalle, setErrorDetalle] = useState(false);
  const elegido = useRef(false);
  const sesion = useRef<SesionBusqueda | null>(null);

  // Se espera a que deje de escribir: una consulta por tecla sería abusar de
  // un servicio que se paga por request.
  useEffect(() => {
    if (elegido.current) {
      elegido.current = false;
      return;
    }
    setSugerencias([]);
    if (texto.trim().length < 3) return;
    const control = new AbortController();
    const id = setTimeout(async () => {
      setBuscando(true);
      try {
        if (!sesion.current) sesion.current = await nuevaSesion();
        const r = await buscarDirecciones(texto, cerca, sesion.current, control.signal);
        if (control.signal.aborted) return;
        setSugerencias(r);
        setAbierto(true);
      } catch {
        // Cancelada porque siguió escribiendo, o sin conexión: no es un error
        // que haya que mostrar, siempre puede marcar el punto a mano.
      } finally {
        if (!control.signal.aborted) setBuscando(false);
      }
    }, 400);
    return () => {
      clearTimeout(id);
      control.abort();
      setBuscando(false);
    };
  }, [texto, cerca]);

  const elegir = async (p: Prediccion) => {
    elegido.current = true;
    setTexto(p.label);
    setSugerencias([]);
    setAbierto(false);
    setErrorDetalle(false);
    setBuscando(true);
    try {
      const lugar = await detalleDePlace(p.placeId, sesion.current ?? undefined);
      // La sesión se cierra con el detalle: la próxima búsqueda abre otra.
      sesion.current = null;
      if (!lugar) {
        setErrorDetalle(true);
        return;
      }
      onElegir(lugar);
    } finally {
      setBuscando(false);
    }
  };

  const usarGps = () => {
    if (!("geolocation" in navigator)) {
      setGps("error");
      return;
    }
    setGps("buscando");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const punto = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const label = (await direccionDe(punto)) ?? "Mi ubicación";
        setGps("nada");
        elegido.current = true;
        setTexto(label);
        setSugerencias([]);
        setAbierto(false);
        onElegir({ ...punto, label });
      },
      () => setGps("error"),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => sugerencias.length > 0 && setAbierto(true)}
          placeholder={placeholder}
          autoComplete="off"
          aria-label="Buscar dirección"
          className={`w-full border border-border bg-card/40 pl-9 pr-9 outline-none focus:border-primary ${inputClassName}`}
        />
        {buscando && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {abierto && sugerencias.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-[1000] mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-background shadow-lg">
            {sugerencias.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onClick={() => void elegir(s)}
                  className="flex w-full items-start gap-2 px-3 py-3 text-left text-sm hover:bg-muted"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    {s.label}
                    {s.secundaria && (
                      <span className="block text-xs text-muted-foreground">{s.secundaria}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {errorDetalle && (
        <p className="text-sm text-amber-400">
          No pudimos ubicar esa dirección. Elegí otra o tocá el mapa donde estás.
        </p>
      )}

      <button
        type="button"
        onClick={usarGps}
        disabled={gps === "buscando"}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold"
      >
        {gps === "buscando" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LocateFixed className="h-4 w-4" />
        )}
        Usar mi ubicación actual
      </button>
      {gps === "error" && (
        <p className="text-sm text-amber-400">
          No pudimos tomar tu ubicación. Buscá la dirección o tocá el mapa donde estás.
        </p>
      )}
    </div>
  );
}

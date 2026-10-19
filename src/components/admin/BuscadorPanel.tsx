import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { buscarEnPanel, DESTINOS, type DestinoBusqueda } from "@/lib/buscador-panel";

/** El evento con que cualquier barra del panel abre el buscador. */
const ABRIR = "abrir-buscador-panel";
export const abrirBuscadorPanel = () => window.dispatchEvent(new Event(ABRIR));

/** Lo que más se busca, para tocar sin escribir. */
const SUGERIDOS = [
  "Horario de atención",
  "Envío a domicilio",
  "WhatsApp y teléfono de la sucursal",
  "Mercado Pago",
  "Productos",
  "Colores, letras y portada",
  "Link y QR para vender",
  "Equipo y permisos",
];

/**
 * Una barra con forma de buscador: se ve como un campo para escribir, que es
 * lo que todos reconocen, y al tocarla abre el buscador del panel. Va arriba
 * del menú y en el Inicio, donde nadie la puede pasar por alto.
 */
export function BarraBuscar({ grande = false }: { grande?: boolean }) {
  return (
    <button
      type="button"
      onClick={abrirBuscadorPanel}
      className={`flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 text-left text-muted-foreground transition hover:border-primary hover:bg-primary/10 hover:text-foreground ${
        grande ? "h-14 px-5 text-base" : "h-11 px-3 text-sm"
      }`}
    >
      <Search className={`shrink-0 text-primary ${grande ? "h-5 w-5" : "h-4 w-4"}`} />
      <span className="min-w-0 flex-1 truncate">
        {grande ? "¿Qué querés cambiar? Buscá: horario, envío, WhatsApp…" : "Buscar en el panel…"}
      </span>
      <kbd className="hidden shrink-0 rounded border border-border px-1.5 text-[10px] lg:inline">
        Ctrl K
      </kbd>
    </button>
  );
}

/**
 * "¿Dónde se cambia el horario?": un buscador para encontrar cualquier
 * configuración sin conocer cómo está ordenado el panel. Se abre con el botón
 * del encabezado, con cualquier `BarraBuscar` o con Ctrl+K (⌘K en Mac). Va una
 * sola vez en la página: es el que tiene el diálogo.
 */
export function BuscadorPanel({
  visible,
  onIr,
}: {
  /** Si el usuario puede abrir ese destino (sección contratada y permitida). */
  visible: (ir: string) => boolean;
  onIr: (ir: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [marcado, setMarcado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // La función cambia en cada dibujo del panel; la última se guarda acá para
  // no recalcular la búsqueda por eso.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto(true);
      }
    };
    const alPedir = () => setAbierto(true);
    window.addEventListener("keydown", alTeclear);
    window.addEventListener(ABRIR, alPedir);
    return () => {
      window.removeEventListener("keydown", alTeclear);
      window.removeEventListener(ABRIR, alPedir);
    };
  }, []);

  const resultados = useMemo(
    () => buscarEnPanel(texto, (ir) => visibleRef.current(ir)).slice(0, 8),
    [texto],
  );
  const sugeridos = useMemo(
    () =>
      abierto
        ? SUGERIDOS.map((t) => DESTINOS.find((d) => d.titulo === t)).filter(
            (d): d is DestinoBusqueda => !!d && visibleRef.current(d.ir),
          )
        : [],
    [abierto],
  );
  const lista = texto.trim() === "" ? sugeridos : resultados;

  const elegir = (d: DestinoBusqueda) => {
    setAbierto(false);
    setTexto("");
    onIr(d.ir);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-primary/50 bg-primary/10 px-3 text-sm font-bold text-foreground transition hover:border-primary"
        aria-label="Buscar en el panel"
      >
        <Search className="h-4 w-4 text-primary" />
        Buscar
      </button>

      <Dialog
        open={abierto}
        onOpenChange={(o) => {
          setAbierto(o);
          if (!o) setTexto("");
          setMarcado(0);
        }}
      >
        <DialogContent
          className="top-[12%] max-w-lg translate-y-0 gap-0 p-0"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Buscar en el panel</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-5 w-5 shrink-0 text-primary" />
            <input
              ref={inputRef}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setMarcado(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMarcado((m) => Math.min(m + 1, lista.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMarcado((m) => Math.max(m - 1, 0));
                } else if (e.key === "Enter" && lista[marcado]) {
                  e.preventDefault();
                  elegir(lista[marcado]);
                }
              }}
              placeholder="¿Qué querés cambiar? Ej: horario, envío, WhatsApp"
              className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {texto.trim() === "" && (
              <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Lo que más se busca
              </p>
            )}
            {texto.trim() !== "" && lista.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No encontramos “{texto}”. Probá con otra palabra.
              </p>
            ) : (
              lista.map((d, i) => (
                <button
                  key={`${d.ir}-${d.titulo}`}
                  type="button"
                  onClick={() => elegir(d)}
                  onMouseEnter={() => setMarcado(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    i === marcado ? "bg-primary/15" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{d.titulo}</span>
                    <span className="block truncate text-xs text-muted-foreground">{d.donde}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { buscarEnPanel, type DestinoBusqueda } from "@/lib/buscador-panel";

/**
 * "¿Dónde se cambia el horario?": un buscador para encontrar cualquier
 * configuración sin conocer cómo está ordenado el panel. Se abre con el botón
 * del encabezado o con Ctrl+K (⌘K en Mac).
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

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto(true);
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  const resultados = useMemo(() => buscarEnPanel(texto, visible).slice(0, 8), [texto, visible]);

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
        className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
        aria-label="Buscar en el panel"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Buscar…</span>
        <kbd className="hidden rounded border border-border px-1.5 text-[10px] lg:inline">
          Ctrl K
        </kbd>
      </button>

      <Dialog
        open={abierto}
        onOpenChange={(o) => {
          setAbierto(o);
          if (!o) setTexto("");
        }}
      >
        <DialogContent
          className="top-[15%] max-w-lg translate-y-0 gap-0 p-0"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Buscar en el panel</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
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
                  setMarcado((m) => Math.min(m + 1, resultados.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMarcado((m) => Math.max(m - 1, 0));
                } else if (e.key === "Enter" && resultados[marcado]) {
                  e.preventDefault();
                  elegir(resultados[marcado]);
                }
              }}
              placeholder="¿Qué querés cambiar? Ej: horario, envío, WhatsApp"
              className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {texto.trim() === "" ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Escribí lo que buscás con tus palabras: “delivery”, “contraseña”, “mitad y mitad”…
              </p>
            ) : resultados.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No encontramos “{texto}”. Probá con otra palabra.
              </p>
            ) : (
              resultados.map((d, i) => (
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

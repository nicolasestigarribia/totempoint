import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Loader2, Receipt, Hand } from "lucide-react";
import { toast } from "sonner";
import { llamarMozo } from "@/lib/api/totem.functions";
import { mensajeDeError } from "@/lib/error-message";

/**
 * "Llamar al mozo" y "Pedir la cuenta", desde la barra de la mesa. El aviso
 * aparece en la comandera con el número de mesa; el cliente no tiene que
 * levantar la mano ni ir hasta la caja.
 */
export function LlamarMozo({ token, accent }: { token: string; accent: string }) {
  const llamar = useServerFn(llamarMozo);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState<"mozo" | "cuenta" | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  // Se cierra tocando afuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    window.addEventListener("pointerdown", fuera);
    return () => window.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  const pedir = async (tipo: "mozo" | "cuenta") => {
    setEnviando(tipo);
    try {
      await llamar({ data: { token, tipo } });
      toast.success(tipo === "cuenta" ? "Listo, ya pedimos tu cuenta" : "Listo, el mozo ya viene");
      setAbierto(false);
    } catch (err) {
      toast.error(mensajeDeError(err, "No pudimos avisar al mozo. Probá de nuevo"));
    } finally {
      setEnviando(null);
    }
  };

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label="Llamar al mozo"
        className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-bold"
      >
        <Bell className="h-4 w-4" style={{ color: accent }} />
        <span className="hidden min-[380px]:inline">Mozo</span>
      </button>
      {abierto && (
        <div className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          {(
            [
              { tipo: "mozo", texto: "Llamar al mozo", icono: Hand },
              { tipo: "cuenta", texto: "Pedir la cuenta", icono: Receipt },
            ] as const
          ).map(({ tipo, texto, icono: Icono }) => (
            <button
              key={tipo}
              type="button"
              disabled={enviando !== null}
              onClick={() => void pedir(tipo)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-bold transition hover:bg-muted/50 disabled:opacity-60"
            >
              {enviando === tipo ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Icono className="h-5 w-5" style={{ color: accent }} />
              )}
              {texto}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

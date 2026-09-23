import { useState } from "react";
import { Monitor, QrCode, Printer, Loader2, Check, ArrowRight } from "lucide-react";
import { escanearQr } from "@/lib/native/scan";
import { parseTotemUrl, setTotemUrl, type TotemRef } from "@/lib/native/provisioning";
import { listarEmparejados, type DispositivoBt } from "@/lib/print/native";
import { savePaired } from "@/lib/print/printer-store";

/**
 * Wizard de setup de una tablet, en la app nativa. Dos pasos, sin login:
 *   1) escanear (o pegar) el QR del tótem → queda pegada a esa sucursal/tótem.
 *   2) elegir la impresora de los dispositivos emparejados en el sistema.
 * Al terminar, guarda la URL del tótem y abre el tótem para siempre.
 */
export function TotemSetupScreen() {
  const [ref, setRef] = useState<TotemRef | null>(null);
  const [pegar, setPegar] = useState("");
  const [dispositivos, setDispositivos] = useState<DispositivoBt[]>([]);
  const [macElegida, setMacElegida] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fijarTotem = async (crudo: string) => {
    const parsed = parseTotemUrl(crudo);
    if (!parsed) {
      setError("Ese QR/enlace no es de un tótem de Totempoint.");
      return;
    }
    setError(null);
    setRef(parsed);
    // Carga las impresoras emparejadas del sistema para el paso 2.
    try {
      setDispositivos(await listarEmparejados());
    } catch {
      setDispositivos([]);
    }
  };

  const escanear = async () => {
    setBusy(true);
    setError(null);
    try {
      const texto = await escanearQr();
      if (texto) await fijarTotem(texto);
    } catch {
      setError("No se pudo abrir la cámara. Pegá el enlace del tótem a mano.");
    } finally {
      setBusy(false);
    }
  };

  const elegirImpresora = (d: DispositivoBt) => {
    if (!ref) return;
    savePaired(ref.empresa, ref.local, ref.totem, {
      deviceId: d.address,
      name: d.name || d.address,
    });
    setMacElegida(d.address);
  };

  const abrirTotem = async () => {
    if (!ref) return;
    setBusy(true);
    await setTotemUrl(ref.url);
    window.location.replace(ref.url);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Monitor className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl">Configurar tablet</h1>
            <p className="text-sm text-muted-foreground">Una vez por dispositivo.</p>
          </div>
        </div>

        {/* Paso 1: tótem */}
        <section className="space-y-3 rounded-2xl border border-border bg-card/40 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              1
            </span>
            <h2 className="font-semibold">Tótem</h2>
            {ref && <Check className="ml-auto h-4 w-4 text-green-400" />}
          </div>

          {ref ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Asignado a: </span>
              <span className="font-semibold">
                {ref.empresa} · {ref.local} · #{ref.totem}
              </span>
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void escanear()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-3 font-bold text-primary-foreground shadow-glow disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <QrCode className="h-5 w-5" />
                )}
                Escanear QR del tótem
              </button>
              <div className="flex items-center gap-2">
                <input
                  value={pegar}
                  onChange={(e) => setPegar(e.target.value)}
                  placeholder="o pegá el enlace…"
                  className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void fijarTotem(pegar)}
                  className="flex h-10 items-center rounded-lg border border-border px-3 text-sm"
                >
                  Usar
                </button>
              </div>
            </>
          )}
        </section>

        {/* Paso 2: impresora */}
        <section className="space-y-3 rounded-2xl border border-border bg-card/40 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              2
            </span>
            <Printer className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Impresora</h2>
            <span className="ml-auto text-xs text-muted-foreground">opcional</span>
          </div>

          {!ref ? (
            <p className="text-sm text-muted-foreground">Primero elegí el tótem.</p>
          ) : dispositivos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay impresoras emparejadas. Emparejala en Ajustes → Bluetooth y volvé, o dejalo
              para después desde el panel.
            </p>
          ) : (
            <div className="space-y-1">
              {dispositivos.map((d) => (
                <button
                  key={d.address}
                  type="button"
                  onClick={() => elegirImpresora(d)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                    macElegida === d.address
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-muted/40"
                  }`}
                >
                  <span className="font-medium">{d.name || d.address}</span>
                  <span className="text-xs text-muted-foreground">{d.address}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={() => void abrirTotem()}
          disabled={!ref || busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-4 font-display text-lg text-primary-foreground shadow-glow disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
          Abrir tótem
        </button>
      </div>
    </div>
  );
}

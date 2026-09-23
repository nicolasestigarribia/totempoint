import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Printer, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setTotemPrinter } from "@/lib/api/totems.functions";
import { buildTicket, type TicketData } from "@/lib/print/ticket";
import {
  soportaWebBluetooth,
  elegirYConectar,
  reconectarGuardada,
  imprimir,
  type Impresora,
} from "@/lib/print/bluetooth";
import {
  esAppNativa,
  listarEmparejados,
  imprimirNativo,
  type DispositivoBt,
} from "@/lib/print/native";
import { getPaired, savePaired, clearPaired } from "@/lib/print/printer-store";

function ticketDemo(empresa: string): TicketData {
  return {
    companyName: empresa,
    orderNumber: 123,
    customerName: "Prueba",
    createdAt: new Date(),
    deliveryMethod: "mostrador",
    paymentMethod: "efectivo",
    items: [
      { name: "Hamburguesa clasica", quantity: 2, unitPrice: 4500 },
      { name: "Papas grandes", quantity: 1, unitPrice: 2800 },
      { name: "Gaseosa 500ml", quantity: 2, unitPrice: 1500 },
    ],
    total: 15300,
    comments: "Ticket de prueba",
  };
}

export function TotemPrinterCard({
  totemId,
  empresa,
  local,
  totem,
  companyName,
  dbPrinterName,
  panelClass,
}: {
  totemId: number;
  empresa: string;
  local: string;
  totem: number;
  companyName: string;
  dbPrinterName: string | null;
  panelClass: string;
}) {
  const guardarEnDb = useServerFn(setTotemPrinter);
  const [paired, setPaired] = useState(() => getPaired(empresa, local, totem));
  const [conn, setConn] = useState<Impresora | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [dispositivos, setDispositivos] = useState<DispositivoBt[]>([]);

  const nativo = esAppNativa();
  const soportado = soportaWebBluetooth();

  const anotar = (m: string) =>
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${m}`]);
  const detalleError = (err: unknown) => {
    if (err instanceof Error) return `ERROR ${err.name}: ${err.message}`;
    return `ERROR: ${String(err)}`;
  };

  // Deja la impresora grabada en la base (respaldo, editable desde el panel).
  const persistirEnDb = async (mac: string | null, name: string | null) => {
    try {
      await guardarEnDb({ data: { id: totemId, mac, name } });
    } catch (err) {
      anotar(detalleError(err));
    }
  };

  // En la app nativa (APK) se elige de los dispositivos ya emparejados en el
  // sistema; el emparejado Bluetooth se hace en Ajustes de Android.
  const cargarDispositivos = async () => {
    setBusy(true);
    setLog([]);
    try {
      anotar("Buscando dispositivos emparejados...");
      const ds = await listarEmparejados();
      setDispositivos(ds);
      anotar(`${ds.length} dispositivo(s) emparejado(s) en el sistema.`);
    } catch (err) {
      anotar(detalleError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (nativo) void cargarDispositivos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativo]);

  const elegirNativo = async (d: DispositivoBt) => {
    const p = { deviceId: d.address, name: d.name || d.address };
    savePaired(empresa, local, totem, p);
    setPaired(p);
    anotar(`Impresora del tótem: ${p.name}`);
    // La MAC nativa sí sirve de respaldo: se guarda en la base.
    await persistirEnDb(d.address, p.name);
  };

  const probarNativo = async () => {
    if (!paired) return;
    setBusy(true);
    setLog([]);
    try {
      anotar(`Imprimiendo prueba en ${paired.name}...`);
      await imprimirNativo(paired.deviceId, buildTicket(ticketDemo(companyName)));
      anotar("Ticket enviado. Revisá la impresora.");
    } catch (err) {
      anotar(detalleError(err));
    } finally {
      setBusy(false);
    }
  };

  const emparejar = async () => {
    setBusy(true);
    setLog([]);
    try {
      anotar("Abriendo selector Bluetooth...");
      const c = await elegirYConectar();
      anotar(`Dispositivo: ${c.device.name ?? "(sin nombre)"}`);
      for (const d of c.diagnostico) anotar(d);
      anotar(`Usando característica: ${c.charUuid}`);
      const p = { deviceId: c.device.id, name: c.device.name ?? "Impresora" };
      savePaired(empresa, local, totem, p);
      setPaired(p);
      setConn(c);
      anotar(`Emparejada: ${p.name}`);
    } catch (err) {
      anotar(detalleError(err));
    } finally {
      setBusy(false);
    }
  };

  const probar = async () => {
    setBusy(true);
    setLog([]);
    try {
      let c = conn;
      if (!c && paired) {
        anotar("Reconectando a la impresora guardada...");
        c = await reconectarGuardada(paired.deviceId);
      }
      if (!c) {
        anotar("No se pudo reconectar. Volvé a emparejar desde esta tablet.");
        return;
      }
      setConn(c);
      anotar(`Característica: ${c.charUuid}`);
      const bytes = buildTicket(ticketDemo(companyName));
      anotar(`Enviando ${bytes.length} bytes en tandas de 20...`);
      await imprimir(c, bytes);
      anotar("Ticket enviado. Revisá la impresora.");
    } catch (err) {
      anotar(detalleError(err));
    } finally {
      setBusy(false);
    }
  };

  const quitar = async () => {
    clearPaired(empresa, local, totem);
    setPaired(null);
    setConn(null);
    setLog([]);
    // Quitar la impresora del tótem también la borra de la base.
    await persistirEnDb(null, null);
  };

  return (
    <div className={`space-y-3 p-4 ${panelClass}`}>
      <div className="flex items-center gap-2">
        <Printer className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Impresora del tótem</span>
        {(paired || dbPrinterName) && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
            <Check className="h-3.5 w-3.5" />
            {paired?.name ?? dbPrinterName}
          </span>
        )}
      </div>

      {nativo ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-2" onClick={cargarDispositivos} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Buscar impresoras
            </Button>
            {paired && (
              <>
                <Button size="sm" variant="outline" onClick={probarNativo} disabled={busy}>
                  Imprimir prueba
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={() => void quitar()}
                  disabled={busy}
                >
                  <X className="h-4 w-4" />
                  Quitar
                </Button>
              </>
            )}
          </div>
          {dispositivos.length > 0 && (
            <div className="space-y-1">
              {dispositivos.map((d) => (
                <button
                  key={d.address}
                  type="button"
                  onClick={() => void elegirNativo(d)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                    paired?.deviceId === d.address
                      ? "border-primary bg-primary/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="font-medium">{d.name || d.address}</span>
                  <span className="text-xs text-muted-foreground">{d.address}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Emparejá la impresora en Ajustes → Bluetooth de la tablet; acá aparece para elegirla.
            Queda guardada en este tótem.
          </p>
        </>
      ) : !soportado ? (
        <p className="text-xs text-muted-foreground">
          Este navegador no puede emparejar Bluetooth. Abrí esta pantalla en la tablet del tótem con
          Chrome (Android) para emparejar la impresora.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-2" onClick={emparejar} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              {paired ? "Cambiar impresora" : "Emparejar impresora"}
            </Button>
            {paired && (
              <>
                <Button size="sm" variant="outline" onClick={probar} disabled={busy}>
                  Imprimir prueba
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={() => void quitar()}
                  disabled={busy}
                >
                  <X className="h-4 w-4" />
                  Quitar
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            El emparejado se hace en la tablet del tótem y queda guardado en ese dispositivo.
          </p>
        </>
      )}

      {log.length > 0 && (
        <div className="space-y-0.5 rounded-md border border-white/10 bg-black/40 p-2 font-mono text-[11px] leading-tight text-muted-foreground">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

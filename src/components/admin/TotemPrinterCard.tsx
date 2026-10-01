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
  imprimirCompartida,
  conexionEnMemoria,
} from "@/lib/print/bluetooth";
import {
  esAppNativa,
  listarEmparejados,
  imprimirNativo,
  type DispositivoBt,
} from "@/lib/print/native";
import {
  getPairedList,
  addPaired,
  removePaired,
  type PairedPrinter,
  type PrinterRole,
} from "@/lib/print/printer-store";

const LABEL_ROL: Record<PrinterRole, string> = {
  totem: "Impresora del tótem",
  caja: "Impresora de caja (compartida)",
};

function ticketDemo(empresa: string): TicketData {
  const hoy = new Date();
  return {
    companyName: empresa,
    orderNumber: 123,
    businessDate: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`,
    customerName: "Prueba",
    createdAt: hoy,
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
  const [printers, setPrinters] = useState<PairedPrinter[]>(() =>
    getPairedList(empresa, local, totem),
  );
  const [busy, setBusy] = useState<PrinterRole | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [dispositivos, setDispositivos] = useState<DispositivoBt[]>([]);

  const nativo = esAppNativa();
  const soportado = soportaWebBluetooth();

  const refrescar = () => setPrinters(getPairedList(empresa, local, totem));
  const porRol = (role: PrinterRole) => printers.find((p) => p.role === role) ?? null;

  const anotar = (m: string) =>
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${m}`]);
  const detalleError = (err: unknown) => {
    if (err instanceof Error) return `ERROR ${err.name}: ${err.message}`;
    return `ERROR: ${String(err)}`;
  };

  // Deja la impresora grabada en la base (respaldo del camino nativo/APK).
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
    setBusy("totem");
    setLog([]);
    try {
      anotar("Buscando dispositivos emparejados...");
      const ds = await listarEmparejados();
      setDispositivos(ds);
      anotar(`${ds.length} dispositivo(s) emparejado(s) en el sistema.`);
    } catch (err) {
      anotar(detalleError(err));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (nativo) void cargarDispositivos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativo]);

  // --- Camino nativo (APK): una sola impresora dedicada, rol "totem". ---
  const elegirNativo = async (d: DispositivoBt) => {
    const p: PairedPrinter = { deviceId: d.address, name: d.name || d.address, role: "totem" };
    addPaired(empresa, local, totem, p);
    refrescar();
    anotar(`Impresora del tótem: ${p.name}`);
    await persistirEnDb(d.address, p.name);
  };

  const probarNativo = async () => {
    const p = porRol("totem");
    if (!p) return;
    setBusy("totem");
    setLog([]);
    try {
      anotar(`Imprimiendo prueba en ${p.name}...`);
      await imprimirNativo(p.deviceId, buildTicket(ticketDemo(companyName)));
      anotar("Ticket enviado. Revisá la impresora.");
    } catch (err) {
      anotar(detalleError(err));
    } finally {
      setBusy(null);
    }
  };

  // --- Camino web (Chrome): dos ranuras, rol "totem" y rol "caja". ---
  const emparejar = async (role: PrinterRole) => {
    setBusy(role);
    setLog([]);
    try {
      anotar("Abriendo selector Bluetooth...");
      const c = await elegirYConectar();
      anotar(`Dispositivo: ${c.device.name ?? "(sin nombre)"}`);
      for (const d of c.diagnostico) anotar(d);
      anotar(`Usando característica: ${c.charUuid}`);
      addPaired(empresa, local, totem, {
        deviceId: c.device.id,
        name: c.device.name ?? "Impresora",
        role,
      });
      refrescar();
      // La de caja es compartida: liberar la conexión para no bloquear a otras
      // tablets. La del tótem queda viva (keep-alive) para imprimir al toque.
      if (role === "caja") c.device.gatt?.disconnect();
      anotar(`Emparejada: ${c.device.name ?? "Impresora"} (${LABEL_ROL[role]})`);
    } catch (err) {
      anotar(detalleError(err));
    } finally {
      setBusy(null);
    }
  };

  const probar = async (role: PrinterRole) => {
    const p = porRol(role);
    if (!p) return;
    setBusy(role);
    setLog([]);
    try {
      const bytes = buildTicket(ticketDemo(companyName));
      if (role === "caja") {
        anotar("Reconectando impresora de caja (compartida)...");
        await imprimirCompartida(p.deviceId, bytes);
        anotar("Ticket enviado a caja. Revisá la impresora.");
        return;
      }
      const conn = conexionEnMemoria(p.deviceId) ?? (await reconectarGuardada(p.deviceId));
      if (!conn) {
        anotar("No se pudo reconectar. Volvé a emparejar desde esta tablet.");
        return;
      }
      anotar(`Enviando ${bytes.length} bytes en tandas de 20...`);
      await imprimir(conn, bytes);
      anotar("Ticket enviado. Revisá la impresora.");
    } catch (err) {
      anotar(detalleError(err));
    } finally {
      setBusy(null);
    }
  };

  const quitar = async (role: PrinterRole) => {
    removePaired(empresa, local, totem, role);
    refrescar();
    setLog([]);
    // Solo el camino nativo graba la MAC en la base; limpiarla al quitar el tótem.
    if (role === "totem") await persistirEnDb(null, null);
  };

  const totemPrinter = porRol("totem");
  const cajaPrinter = porRol("caja");

  return (
    <div className={`space-y-4 p-4 ${panelClass}`}>
      <div className="flex items-center gap-2">
        <Printer className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Impresoras</span>
      </div>

      {nativo ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-2"
              onClick={cargarDispositivos}
              disabled={busy !== null}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Buscar impresoras
            </Button>
            {totemPrinter && (
              <>
                <Button size="sm" variant="outline" onClick={probarNativo} disabled={busy !== null}>
                  Imprimir prueba
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={() => void quitar("totem")}
                  disabled={busy !== null}
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
                    totemPrinter?.deviceId === d.address
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
          Chrome (Android) para emparejar las impresoras.
        </p>
      ) : (
        <>
          <RanuraWeb
            role="totem"
            printer={totemPrinter}
            fallbackName={dbPrinterName}
            busy={busy === "totem"}
            disabled={busy !== null}
            onEmparejar={() => void emparejar("totem")}
            onProbar={() => void probar("totem")}
            onQuitar={() => void quitar("totem")}
          />
          <RanuraWeb
            role="caja"
            printer={cajaPrinter}
            fallbackName={null}
            busy={busy === "caja"}
            disabled={busy !== null}
            onEmparejar={() => void emparejar("caja")}
            onProbar={() => void probar("caja")}
            onQuitar={() => void quitar("caja")}
          />
          <p className="text-xs text-muted-foreground">
            El emparejado se hace en la tablet del tótem y queda guardado en ese dispositivo. La
            impresora de caja es compartida: emparejala en cada tablet que la use.
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

function RanuraWeb({
  role,
  printer,
  fallbackName,
  busy,
  disabled,
  onEmparejar,
  onProbar,
  onQuitar,
}: {
  role: PrinterRole;
  printer: PairedPrinter | null;
  fallbackName: string | null;
  busy: boolean;
  disabled: boolean;
  onEmparejar: () => void;
  onProbar: () => void;
  onQuitar: () => void;
}) {
  const nombre = printer?.name ?? fallbackName;
  return (
    <div className="space-y-2 rounded-md border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{LABEL_ROL[role]}</span>
        {nombre && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
            <Check className="h-3.5 w-3.5" />
            {nombre}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-2" onClick={onEmparejar} disabled={disabled}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          {printer ? "Cambiar" : "Emparejar"}
        </Button>
        {printer && (
          <>
            <Button size="sm" variant="outline" onClick={onProbar} disabled={disabled}>
              Imprimir prueba
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-destructive hover:text-destructive"
              onClick={onQuitar}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
              Quitar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

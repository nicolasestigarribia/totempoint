import { useState } from "react";
import { Printer, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildTicket, type TicketData } from "@/lib/print/ticket";
import {
  soportaWebBluetooth,
  elegirYConectar,
  reconectarGuardada,
  imprimir,
  type Impresora,
} from "@/lib/print/bluetooth";
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
  empresa,
  local,
  totem,
  companyName,
  panelClass,
}: {
  empresa: string;
  local: string;
  totem: number;
  companyName: string;
  panelClass: string;
}) {
  const [paired, setPaired] = useState(() => getPaired(empresa, local, totem));
  const [conn, setConn] = useState<Impresora | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const soportado = soportaWebBluetooth();

  const emparejar = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const c = await elegirYConectar();
      const p = { deviceId: c.device.id, name: c.device.name ?? "Impresora" };
      savePaired(empresa, local, totem, p);
      setPaired(p);
      setConn(c);
      setMsg(`Emparejada: ${p.name}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const probar = async () => {
    setBusy(true);
    setMsg(null);
    try {
      let c = conn;
      if (!c && paired) c = await reconectarGuardada(paired.deviceId);
      if (!c) {
        setMsg("No se pudo reconectar. Volvé a emparejar desde esta tablet.");
        return;
      }
      setConn(c);
      await imprimir(c, buildTicket(ticketDemo(companyName)));
      setMsg("Ticket enviado. Revisá la impresora.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const quitar = () => {
    clearPaired(empresa, local, totem);
    setPaired(null);
    setConn(null);
    setMsg(null);
  };

  return (
    <div className={`space-y-3 p-4 ${panelClass}`}>
      <div className="flex items-center gap-2">
        <Printer className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Impresora del tótem</span>
        {paired && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
            <Check className="h-3.5 w-3.5" />
            {paired.name}
          </span>
        )}
      </div>

      {!soportado ? (
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
                  onClick={quitar}
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

      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

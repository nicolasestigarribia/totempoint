import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, Loader2, Smartphone, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  cancelOnlineOrder,
  changeOnlineOrderPayment,
  type OnlineOrderStatus,
} from "@/lib/api/totem.functions";
import { formatPrice } from "@/lib/totem-cart";
import { mensajeDeError } from "@/lib/error-message";

/**
 * Lo que el cliente puede arreglar solo: cambiar cómo paga o cancelar, mientras
 * el local todavía no aceptó el pedido. Todo en la misma pantalla y sin
 * ventanas encima: es un celular, y lo que hace falta confirmar se confirma
 * ahí mismo.
 */
export function AccionesPedido({
  pedido,
  empresa,
  local,
  token,
  accent,
  onCambio,
}: {
  pedido: OnlineOrderStatus;
  empresa: string;
  local: string;
  token: string;
  accent: string;
  /** Vuelve a pedir el estado: el pedido cambió. */
  onCambio: () => void;
}) {
  const cancelar = useServerFn(cancelOnlineOrder);
  const cambiarPago = useServerFn(changeOnlineOrderPayment);
  const [abierto, setAbierto] = useState<"pago" | "cancelar" | null>(null);
  const [pagaCon, setPagaCon] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const otroPago = pedido.paymentMethod === "mercadopago" ? "efectivo" : "mercadopago";
  const puedeCambiarPago = pedido.pagosDisponibles[otroPago];

  const confirmarCancelacion = async () => {
    setOcupado(true);
    try {
      const r = await cancelar({ data: { empresa, local, token } });
      toast.success(
        r.reembolso ? "Pedido cancelado. El local te devuelve la plata" : "Pedido cancelado",
      );
      onCambio();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo cancelar el pedido"));
      onCambio();
    } finally {
      setOcupado(false);
      setAbierto(null);
    }
  };

  const confirmarPago = async () => {
    const pagaConNumero = otroPago === "efectivo" && pagaCon ? Number(pagaCon) : undefined;
    if (pagaConNumero !== undefined) {
      if (Number.isNaN(pagaConNumero)) {
        toast.error("Poné un número válido en «¿con cuánto pagás?»");
        return;
      }
      if (pagaConNumero < Number(pedido.total)) {
        toast.error(
          `Con ${formatPrice(pagaConNumero)} no alcanza: el total es ${formatPrice(pedido.total)}`,
        );
        return;
      }
    }
    setOcupado(true);
    try {
      const r = await cambiarPago({
        data: {
          empresa,
          local,
          token,
          paymentMethod: otroPago,
          paysWith: pagaConNumero,
        },
      });
      if (r.pagarEn) {
        window.location.assign(r.pagarEn);
        return;
      }
      toast.success("Listo: pagás en efectivo");
      setAbierto(null);
      onCambio();
    } catch (err) {
      toast.error(mensajeDeError(err, "No se pudo cambiar cómo pagás"));
      onCambio();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-border p-4">
      <p className="text-sm font-bold">¿Te equivocaste?</p>
      <p className="text-sm text-muted-foreground">
        Hasta que el local acepte tu pedido podés cambiar cómo pagás o cancelarlo.
      </p>

      {abierto === null && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {puedeCambiarPago && (
            <button
              type="button"
              onClick={() => setAbierto("pago")}
              className="flex h-11 items-center justify-center rounded-xl border border-border text-sm font-bold"
            >
              Cambiar pago
            </button>
          )}
          <button
            type="button"
            onClick={() => setAbierto("cancelar")}
            className={`flex h-11 items-center justify-center rounded-xl border border-destructive/60 text-sm font-bold text-destructive ${
              puedeCambiarPago ? "" : "col-span-2"
            }`}
          >
            Cancelar pedido
          </button>
        </div>
      )}

      {abierto === "pago" && (
        <div className="mt-3 space-y-3">
          {otroPago === "efectivo" ? (
            <>
              <p className="flex items-center gap-2 text-sm">
                <Banknote className="h-4 w-4 shrink-0" />
                Pagás {formatPrice(pedido.total)} en efectivo al{" "}
                {pedido.deliveryMethod === "envio" ? "recibirlo" : "retirarlo"}.
              </p>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={pagaCon}
                onChange={(e) => setPagaCon(e.target.value)}
                placeholder={`¿Con cuánto pagás? Justo, ${formatPrice(pedido.total)}`}
                aria-label="Con cuánto pagás"
                className="h-12 w-full rounded-xl border border-border bg-card/40 px-4 outline-none focus:border-primary"
              />
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm">
              <Smartphone className="h-4 w-4 shrink-0" />
              Te llevamos a Mercado Pago para pagar {formatPrice(pedido.total)} desde el celular.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAbierto(null)}
              disabled={ocupado}
              className="flex h-11 items-center justify-center rounded-xl border border-border text-sm font-bold"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={confirmarPago}
              disabled={ocupado}
              className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white"
              style={{ background: accent }}
            >
              {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
              {otroPago === "efectivo" ? "Pagar en efectivo" : "Pagar con Mercado Pago"}
            </button>
          </div>
        </div>
      )}

      {abierto === "cancelar" && (
        <div className="mt-3 space-y-3">
          <p className="flex items-start gap-2 text-sm">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            {pedido.paymentMethod === "mercadopago"
              ? "¿Cancelamos el pedido? Si ya lo pagaste, el local te devuelve la plata."
              : "¿Cancelamos el pedido? No se puede deshacer: si te arrepentís, hacés uno nuevo."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAbierto(null)}
              disabled={ocupado}
              className="flex h-11 items-center justify-center rounded-xl border border-border text-sm font-bold"
            >
              No, seguir
            </button>
            <button
              type="button"
              onClick={confirmarCancelacion}
              disabled={ocupado}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-destructive text-sm font-bold text-destructive-foreground"
            >
              {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
              Sí, cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

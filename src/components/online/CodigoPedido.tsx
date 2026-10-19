import { ShieldCheck } from "lucide-react";

/**
 * El código de verificación del pedido, grande y separado letra por letra para
 * leerlo de un vistazo o dictarlo. Lo pide el local al entregar: el número de
 * pedido arranca en 1 cada día y cualquiera puede decir "soy el 3".
 */
export function CodigoPedido({
  codigo,
  accent,
  cuando,
  grande = false,
}: {
  codigo: string | null;
  accent: string | undefined;
  /** "al retirar", "al recibirlo"… */
  cuando: string;
  /** Tamaño del tótem, que se lee de lejos. */
  grande?: boolean;
}) {
  if (!codigo) return null;
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border-2 ${
        grande ? "px-8 py-5" : "px-4 py-3"
      }`}
      style={{ borderColor: accent }}
    >
      <div className="text-left">
        <p
          className={`flex items-center gap-1.5 font-bold uppercase tracking-wider text-muted-foreground ${
            grande ? "text-sm" : "text-xs"
          }`}
        >
          <ShieldCheck className={grande ? "h-5 w-5" : "h-4 w-4"} /> Tu código
        </p>
        <p className={`text-muted-foreground ${grande ? "text-base" : "text-xs"}`}>
          Mostralo {cuando}
        </p>
      </div>
      <p
        className={`font-mono font-black ${grande ? "text-6xl tracking-[0.25em]" : "text-3xl tracking-[0.2em]"}`}
        style={{ color: accent }}
        aria-label={`Código ${codigo.split("").join(" ")}`}
      >
        {codigo}
      </p>
    </div>
  );
}

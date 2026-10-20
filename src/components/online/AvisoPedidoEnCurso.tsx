import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Radio } from "lucide-react";
import { pedidoEnCurso, type PedidoRecordado } from "@/lib/pedidos-en-curso";

/**
 * "Tenés un pedido en curso": el cliente cerró la pestaña del seguimiento y
 * volvió a entrar a la tienda. Un toque y está de nuevo en su pedido, con su
 * código. Se lee al montar: el servidor no sabe qué guardó este celular.
 */
export function AvisoPedidoEnCurso({
  canal,
  accent,
  className = "",
}: {
  canal: string;
  accent: string;
  className?: string;
}) {
  const [pedido, setPedido] = useState<PedidoRecordado | null>(null);
  const navigate = useNavigate();
  useEffect(() => setPedido(pedidoEnCurso(canal)), [canal]);
  if (!pedido) return null;
  return (
    <button
      type="button"
      onClick={() => void navigate({ href: pedido.ruta })}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-card/80 p-3 text-left transition active:scale-[0.98] ${className}`}
      style={{ borderColor: accent }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: accent }}
      >
        <Radio className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold leading-tight">Tenés un pedido en curso</span>
        <span className="block text-sm text-muted-foreground">
          Pedido {pedido.numero}
          {pedido.codigo && (
            <>
              {" · código "}
              <b className="font-mono tracking-widest text-foreground">{pedido.codigo}</b>
            </>
          )}
        </span>
      </span>
      <span className="flex shrink-0 items-center text-sm font-bold" style={{ color: accent }}>
        Ver <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

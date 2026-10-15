import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Store } from "lucide-react";

/**
 * Lo que ve el cliente mientras espera al servidor: la marca del local tapando
 * toda la pantalla, el logo latiendo y una barrita que va y viene. Elegida por
 * el usuario en maquetas para toda espera de una solicitud del cliente (abrir
 * el menú, enviar el pedido, cancelarlo): además de avisar que está
 * trabajando, tapa los botones para que nadie los toque dos veces.
 *
 * Va al `body` por un portal, así queda arriba también de la hoja de abajo
 * (`Drawer`). Tapa en el acto, pero el contenido aparece con un pequeño
 * retraso: si la respuesta llega enseguida no hay un parpadeo de marca.
 */
export function CargaMarca({
  logoUrl,
  nombre,
  texto,
  accent,
}: {
  logoUrl: string | null | undefined;
  nombre: string;
  texto: string;
  accent?: string | null;
}) {
  // El portal necesita el documento: en el servidor no se dibuja.
  const [montada, setMontada] = useState(false);
  useEffect(() => setMontada(true), []);
  if (!montada) return null;

  const color = accent || "var(--primary)";
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="carga-marca fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground"
    >
      <div
        className="carga-late flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.75rem]"
        style={{
          background: color,
          boxShadow: `0 16px 36px color-mix(in oklab, ${color} 35%, transparent)`,
        }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Store className="h-10 w-10 text-white" />
        )}
      </div>
      <div className="space-y-1">
        <p className="font-display text-3xl tracking-wide">{nombre}</p>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border">
        <div className="carga-riel h-full w-2/5 rounded-full" style={{ background: color }} />
      </div>
    </div>,
    document.body,
  );
}

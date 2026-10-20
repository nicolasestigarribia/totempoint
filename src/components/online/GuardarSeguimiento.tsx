import { MessageCircle } from "lucide-react";

/**
 * "Guardar el link en WhatsApp": el cliente se manda a sí mismo (o a quien va
 * a retirar) el link del seguimiento. Sirve aunque cambie de celular o borre
 * el navegador, donde el aviso de "pedido en curso" no llega.
 */
export function GuardarSeguimiento({ texto }: { texto: string }) {
  const compartir = () => {
    const url = window.location.href;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${texto}: ${url}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  return (
    <button
      type="button"
      onClick={compartir}
      className="mt-2 flex w-full items-center justify-center gap-2 text-sm font-bold text-muted-foreground underline-offset-4 hover:underline"
    >
      <MessageCircle className="h-4 w-4" />
      Guardar este link en WhatsApp
    </button>
  );
}

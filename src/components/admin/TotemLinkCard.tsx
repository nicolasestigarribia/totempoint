import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * El enlace del tótem, para no tener que tipear una URL larga en la tablet:
 * se copia con un botón o se escanea el QR desde el dispositivo.
 */
export function TotemLinkCard({ slug, panelClass }: { slug: string; panelClass: string }) {
  // El origin solo existe en el navegador, así que se resuelve después del render.
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const path = `/t/${slug}`;
  // El enlace que va a la tablet lleva el marcador: desde ahí el tótem cierra
  // cualquier sesión de panel que quede abierta en ese dispositivo. El botón
  // "Abrir" de acá al lado usa el enlace pelado, para mirar el tótem desde la
  // computadora sin quedar afuera de tu propia sesión.
  const pathTablet = `${path}?totem=1`;
  const url = origin ? `${origin}${pathTablet}` : pathTablet;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  };

  return (
    <div className={`p-6 ${panelClass}`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <QrCode className="h-5 w-5 text-primary" />
              Enlace del tótem
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Abrí esta dirección en la tablet del mostrador. Escaneá el código con la cámara del
              dispositivo y no vas a tener que escribirla.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Input
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              className="h-11 flex-1"
            />
            <Button type="button" variant="outline" className="h-11 gap-2" onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <a
              href={path}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition hover:border-primary"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir
            </a>
          </div>

          <p className="text-xs text-muted-foreground">
            Abierta con este enlace, la tablet queda marcada como tótem: cada vez que vuelve a la
            portada cierra la sesión de panel que haya quedado abierta ahí, así nadie entra a{" "}
            <code className="rounded bg-white/10 px-1">/admin</code> desde el mostrador. Para
            sacarle la marca, abrila una vez con{" "}
            <code className="rounded bg-white/10 px-1">?totem=0</code>. Igual conviene administrar
            desde tu teléfono o tu computadora y dejar la tablet en modo kiosco.
          </p>
        </div>

        {/* Fondo blanco fijo: un QR sobre el panel oscuro no lo lee ninguna cámara. */}
        <div className="mx-auto shrink-0 rounded-2xl bg-white p-3 sm:mx-0">
          <QRCodeSVG value={url} size={148} level="M" />
        </div>
      </div>
    </div>
  );
}

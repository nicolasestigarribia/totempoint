import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, ExternalLink, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * El enlace de un tótem, para no tener que tipear una URL larga en la tablet:
 * se copia con un botón o se escanea el QR desde el dispositivo.
 *
 * Es una tarjeta por tótem, así que dice lo justo. Lo que hay que hacer una
 * sola vez —instalarlo como aplicación, fijar la pantalla— vive en
 * `TotemTabletTips`, arriba de la lista: repetido debajo de cada tótem era el
 * mismo párrafo tres veces y no se leía ninguna.
 */
export function TotemLinkCard({
  empresa,
  local,
  totem,
  panelClass,
}: {
  empresa: string;
  local: string;
  totem: number;
  panelClass: string;
}) {
  // El origin solo existe en el navegador, así que se resuelve después del render.
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const path = `/t/${empresa}/${local}/${totem}`;
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
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm text-muted-foreground">
            Abrí esta dirección en la tablet de este tótem. Escaneá el código con la cámara del
            dispositivo y no vas a tener que escribirla.
          </p>

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
        </div>

        {/* Fondo blanco fijo: un QR sobre el panel oscuro no lo lee ninguna cámara. */}
        <div className="mx-auto shrink-0 rounded-2xl bg-white p-3 sm:mx-0">
          <QRCodeSVG value={url} size={148} level="M" />
        </div>
      </div>
    </div>
  );
}

/**
 * Cómo se deja una tablet lista, una sola vez para todos los tótems del local.
 *
 * Son tres cosas distintas y conviene leerlas juntas: qué hace el `?totem=1`
 * del enlace, cómo se instala para que no se vea la barra de direcciones, y
 * qué hay que hacer en el sistema operativo, que es lo único que la aplicación
 * no puede resolver sola.
 */
export function TotemTabletTips({ panelClass }: { panelClass: string }) {
  return (
    <div className={`space-y-4 p-6 ${panelClass}`}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <Smartphone className="h-4 w-4 text-primary" />
        Cómo dejar lista la tablet
      </p>

      <p className="text-xs text-muted-foreground">
        Abierta con el enlace de acá abajo, la tablet queda marcada como tótem: cada vez que vuelve
        a la portada cierra la sesión de panel que haya quedado abierta ahí, así nadie entra a{" "}
        <code className="rounded bg-white/10 px-1">/admin</code> desde el mostrador. Para sacarle la
        marca, abrila una vez con <code className="rounded bg-white/10 px-1">?totem=0</code>. Igual
        conviene administrar desde tu teléfono o tu computadora.
      </p>

      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>
          Abrí el enlace del tótem en la tablet y, en el menú de Chrome, tocá{" "}
          <strong className="text-foreground">Agregar a la pantalla principal</strong>. Queda un
          ícono con el nombre de tu negocio que abre ese tótem a pantalla completa, sin barra de
          direcciones ni pestañas. Cada tótem instala el suyo.
        </li>
        <li>
          Si igual lo abrís desde el navegador, el primer toque en la pantalla ya lo pone en
          pantalla completa.
        </li>
        <li>
          Para que nadie pueda salirse: Ajustes → Seguridad →{" "}
          <strong className="text-foreground">Fijar pantalla</strong> en Android, o instalá un
          navegador de kiosco en la tablet.
        </li>
      </ol>
    </div>
  );
}

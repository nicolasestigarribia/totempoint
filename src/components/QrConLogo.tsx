import { useContext, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LogoQrContext } from "@/components/qr-logo";

// El logo viaja dentro del SVG como data URL: así aparece también en la hoja
// de QRs para imprimir, que es otra ventana y se imprime sin esperar imágenes.
const cache = new Map<string, Promise<string | null>>();

function aDataUrl(url: string): Promise<string | null> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.blob() : null))
      .then(
        (blob) =>
          blob &&
          new Promise<string | null>((ok) => {
            const lector = new FileReader();
            lector.onload = () => ok(typeof lector.result === "string" ? lector.result : null);
            lector.onerror = () => ok(null);
            lector.readAsDataURL(blob);
          }),
      )
      .catch(() => null);
    cache.set(url, p);
  }
  return p;
}

/**
 * Un QR con el logo de la marca en el centro. El logo tapa parte del código,
 * así que con logo usa la corrección de errores más alta (H, hasta 30%) y el
 * logo ocupa poco más de un quinto del lado: sigue leyéndose con cualquier
 * cámara. Sin logo, o mientras carga, es el QR de siempre.
 */
export function QrConLogo({
  value,
  size,
  marginSize,
  logoUrl,
}: {
  value: string;
  size: number;
  marginSize?: number;
  /** Por defecto, el de la empresa del panel. */
  logoUrl?: string | null;
}) {
  const delPanel = useContext(LogoQrContext);
  const url = logoUrl === undefined ? delPanel : logoUrl;
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setLogo(null);
    if (url) aDataUrl(url).then((d) => vigente && setLogo(d));
    return () => {
      vigente = false;
    };
  }, [url]);

  const lado = Math.round(size * 0.22);
  return (
    <QRCodeSVG
      value={value}
      size={size}
      marginSize={marginSize}
      level={logo ? "H" : "M"}
      imageSettings={logo ? { src: logo, width: lado, height: lado, excavate: true } : undefined}
    />
  );
}

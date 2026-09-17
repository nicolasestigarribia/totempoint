import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Marco de vista previa: un iframe con su propia ventana de 1280x800, escalado
 * para entrar en el panel.
 *
 * Hace falta el iframe y no basta con un div escalado: la portada del tótem usa
 * `min-h-screen` y clases por ancho (`lg:`, `md:`), y todas esas miran el
 * tamaño de la ventana real. Dentro de un div, con el panel angosto, la portada
 * se dibujaba en su versión de celular y los textos quedaban fuera del recorte.
 * Adentro del iframe, la ventana mide de verdad 1280x800 y se ve lo mismo que
 * va a ver el cliente en la tablet.
 */
export function PreviewFrame({
  children,
  width = 1280,
  height = 800,
  className = "",
}: {
  children: ReactNode;
  width?: number;
  height?: number;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState(0.4);

  // Los estilos de la app viven en el documento principal: hay que copiarlos
  // dentro del iframe, y seguir copiando los que agregue Vite al recargar.
  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;

    const copiarEstilos = () => {
      doc.head.querySelectorAll("[data-copiado]").forEach((n) => n.remove());
      document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
        const copia = node.cloneNode(true) as HTMLElement;
        copia.setAttribute("data-copiado", "");
        doc.head.appendChild(copia);
      });
    };

    doc.body.style.margin = "0";
    doc.documentElement.style.colorScheme = "dark";
    copiarEstilos();
    setBody(doc.body);

    const observer = new MutationObserver(copiarEstilos);
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, []);

  // El iframe se dibuja a tamaño real y se achica para entrar en el ancho del panel.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ajustar = () => setScale(Math.min(1, wrapper.clientWidth / width));
    ajustar();
    const observer = new ResizeObserver(ajustar);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height: height * scale }}
    >
      <iframe
        ref={frameRef}
        title="Vista previa del tótem"
        tabIndex={-1}
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
        style={{ width, height, transform: `scale(${scale})` }}
      />
      {body && createPortal(children, body)}
    </div>
  );
}

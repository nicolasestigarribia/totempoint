import { useEffect } from "react";

/**
 * Suelta la página si quedó trabada sin poder deslizarse.
 *
 * Las hojas que suben desde abajo (vaul) bloquean el scroll de la página
 * mientras están abiertas: en el iPhone la fijan con `position: fixed` y la
 * sueltan al cerrarse. Si la hoja se desmonta abierta —el cliente elige
 * sucursal y se navega en el mismo toque— ese bloqueo podía quedar pegado y
 * en el carrito no se podía volver a subir. Las hojas ya no tocan el body
 * (`noBodyStyles`), y esto es el seguro: al entrar a una pantalla, si nada está
 * abierto y la página sigue fijada, se libera.
 */
export function liberarDesplazamiento(): void {
  if (typeof document === "undefined") return;
  // Con una hoja o un diálogo abierto, el bloqueo es a propósito.
  if (document.querySelector('[role="dialog"]')) return;
  const b = document.body.style;
  if (b.position === "fixed") {
    const y = -parseInt(b.top || "0", 10) || 0;
    b.removeProperty("position");
    b.removeProperty("top");
    b.removeProperty("left");
    b.removeProperty("right");
    b.removeProperty("height");
    window.scrollTo(0, y);
  }
  if (b.overflow === "hidden") b.removeProperty("overflow");
  if (b.pointerEvents === "none") b.removeProperty("pointer-events");
}

/** Libera la página al montar la pantalla y al volver a ella. */
export function useLiberarDesplazamiento(): void {
  useEffect(() => {
    liberarDesplazamiento();
    // Un instante después también: la hoja que se cerraba al navegar puede
    // terminar de desmontarse recién después de que monta la pantalla nueva.
    const t = window.setTimeout(liberarDesplazamiento, 400);
    const alVolver = () => liberarDesplazamiento();
    window.addEventListener("pageshow", alVolver);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pageshow", alVolver);
    };
  }, []);
}

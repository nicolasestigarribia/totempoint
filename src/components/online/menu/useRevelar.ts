import { useCallback, useState } from "react";

/*
 * Un solo IntersectionObserver para todas las tarjetas del menú: con el menú
 * entero en una lista son decenas, y uno por tarjeta sería trabajo de más en
 * un teléfono. Cada tarjeta se revela una vez y deja de observarse.
 *
 * Que ya se vio vive en el estado de React, no en una clase puesta a mano:
 * cuando la tarjeta cambia su className (al entrar al pedido), React lo
 * reescribe entero y una clase agregada desde afuera se pierde, con lo que la
 * tarjeta volvía a quedar invisible.
 */
let observador: IntersectionObserver | null = null;
const avisos = new Map<Element, () => void>();

function observar(el: Element, alVerse: () => void) {
  if (typeof IntersectionObserver === "undefined") {
    alVerse();
    return;
  }
  observador ??= new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        avisos.get(e.target)?.();
        avisos.delete(e.target);
        observador?.unobserve(e.target);
      }
    },
    // Un poco antes de que asome: entra mientras sube, no ya quieta.
    { rootMargin: "0px 0px -40px 0px", threshold: 0.08 },
  );
  avisos.set(el, alVerse);
  observador.observe(el);
}

/**
 * Ref y estado para un elemento con la clase `revela`: `visible` pasa a true
 * cuando llega a la pantalla, así entra animado aunque esté al final del menú.
 * El componente agrega la clase `visible` cuando es true.
 */
export function useRevelar<T extends Element>(): [(el: T | null) => (() => void) | void, boolean] {
  const [visible, setVisible] = useState(false);
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    observar(el, () => setVisible(true));
    // Una tarjeta que se desmonta sin haber llegado a verse no queda colgada.
    return () => {
      avisos.delete(el);
      observador?.unobserve(el);
    };
  }, []);
  return [ref, visible];
}

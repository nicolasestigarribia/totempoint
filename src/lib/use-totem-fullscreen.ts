import { useEffect } from "react";
import { esDispositivoTotem } from "@/lib/use-totem-device";

/**
 * Pantalla completa al primer toque, en la tablet del mostrador.
 *
 * En Android no existe F11: Chrome no tiene modo pantalla completa ni atajo
 * de teclado, y con la barra de direcciones a la vista cualquiera puede
 * escribir otra dirección en el tótem. Lo único que sí permite el navegador es
 * que la propia página la pida, y solo dentro de un gesto del usuario.
 *
 * En un tótem eso viene regalado: el cliente siempre arranca tocando la
 * portada. Así que el primer toque de cualquier parte de la pantalla entra en
 * pantalla completa, y desde ahí no se ve nada del navegador. Si alguien sale
 * —el gesto de Android, la tecla de atrás—, el siguiente toque la devuelve.
 *
 * Solo corre en la tablet marcada como tótem (`?totem=1`). Es importante: el
 * botón "Abrir" del panel usa el enlace sin marcar, así que mirar la portada
 * desde la computadora no le toma la pantalla al dueño mientras trabaja.
 *
 * No reemplaza instalar el tótem desde el ícono ni fijar la pantalla en
 * Android; es lo que funciona sin configurar nada en el dispositivo.
 */
export function useTotemFullscreen() {
  useEffect(() => {
    if (!esDispositivoTotem()) return;

    const elemento = document.documentElement;
    if (!elemento.requestFullscreen) return;

    const pedir = () => {
      if (document.fullscreenElement) return;
      // Falla si el navegador no lo permite o el usuario lo rechaza; no hay
      // nada que hacer al respecto y el tótem funciona igual.
      elemento.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    };

    document.addEventListener("pointerdown", pedir, { capture: true, passive: true });
    return () => document.removeEventListener("pointerdown", pedir, { capture: true });
  }, []);
}

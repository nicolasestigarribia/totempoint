import { useEffect } from "react";

/**
 * Pide que la pantalla no se apague mientras esta página está abierta (Screen
 * Wake Lock). La comandera y el tótem son pantallas que nadie toca durante
 * minutos: una tablet que se bloquea por inactividad deja de sonar y de
 * mostrar los pedidos nuevos, y el local se entera cuando el cliente reclama.
 *
 * El navegador suelta el bloqueo cada vez que la pestaña queda oculta, así que
 * se vuelve a pedir al volver. Donde no existe (Safari viejo, Firefox) no hace
 * nada: queda la configuración de la tablet.
 */
export function usePantallaEncendida(): void {
  useEffect(() => {
    type Bloqueo = { release: () => Promise<void> };
    const wl = (
      navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Bloqueo> } }
    ).wakeLock;
    if (!wl) return;
    let bloqueo: Bloqueo | null = null;
    let vivo = true;
    const pedir = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const b = await wl.request("screen");
        if (vivo) bloqueo = b;
        else void b.release();
      } catch {
        // Sin permiso o con batería baja: la pantalla sigue su configuración.
      }
    };
    void pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", pedir);
      void bloqueo?.release().catch(() => {});
    };
  }, []);
}

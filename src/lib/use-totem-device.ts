import { useEffect } from "react";
import { leaveStaffSession } from "@/lib/api/totem.functions";

const FLAG = "totempoint:dispositivo-totem";

/**
 * Lee (y actualiza con `?totem=1` / `?totem=0`) la marca de esta tablet.
 *
 * Devuelve false si el navegador no tiene almacenamiento —ventana privada,
 * cookies bloqueadas—, que es lo mismo que decir "esta no es la tablet del
 * mostrador": el tótem sigue funcionando igual, solo que sin lo que depende
 * de estar marcado.
 */
export function esDispositivoTotem(): boolean {
  try {
    const parametro = new URLSearchParams(window.location.search).get("totem");
    if (parametro === "1") localStorage.setItem(FLAG, "1");
    else if (parametro === "0") localStorage.removeItem(FLAG);
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

/**
 * Marca a esta tablet como tótem y la mantiene sin sesión de panel.
 *
 * El problema que resuelve: la pantalla del tótem no tiene salida, pero la
 * barra de direcciones sí. Si el dueño entra al panel desde esa tablet para
 * corregir un precio y no cierra sesión, cualquier cliente que escriba /admin
 * se encuentra con el panel abierto. Avisarlo por escrito no alcanzaba.
 *
 * Cómo funciona: el enlace que el panel da para la tablet termina en
 * `?totem=1`. La primera vez que se abre, el dispositivo queda marcado, y de
 * ahí en más cada vez que se muestra la portada se cierra cualquier sesión de
 * panel que haya quedado abierta acá. Se sale con `?totem=0`.
 *
 * La marca vive en este navegador nada más, y el botón "Abrir" del panel usa
 * el enlace sin parámetro, así que mirar el tótem desde la computadora no te
 * deja afuera de tu propia sesión.
 */
export function useTotemDevice() {
  useEffect(() => {
    if (!esDispositivoTotem()) return;
    // Si no había sesión, esto no hace nada; no vale la pena preguntar antes.
    leaveStaffSession().catch(() => {});
  }, []);
}

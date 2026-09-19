import { useEffect } from "react";
import { leaveStaffSession } from "@/lib/api/totem.functions";

const FLAG = "totempoint:dispositivo-totem";

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
    let marcado = false;

    try {
      const parametro = new URLSearchParams(window.location.search).get("totem");
      if (parametro === "1") localStorage.setItem(FLAG, "1");
      else if (parametro === "0") localStorage.removeItem(FLAG);
      marcado = localStorage.getItem(FLAG) === "1";
    } catch {
      // Navegador sin almacenamiento (ventana privada, cookies bloqueadas):
      // no hay marca que leer y el tótem sigue funcionando igual.
      return;
    }

    if (!marcado) return;
    // Si no había sesión, esto no hace nada; no vale la pena preguntar antes.
    leaveStaffSession().catch(() => {});
  }, []);
}

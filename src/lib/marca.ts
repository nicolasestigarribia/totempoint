import { useEffect } from "react";

/**
 * La marca de la empresa en lugar de la de Totempoint: el ícono de la pestaña
 * y la pantalla de carga del panel muestran el logo del negocio, no el
 * nuestro. El dueño y su cliente ven su local, no el sistema que lo hace andar.
 */

const CLAVE = "marca-empresa";

export interface MarcaGuardada {
  nombre: string;
  logo: string | null;
}

/**
 * Se guarda en el navegador la última empresa que se abrió en el panel o la
 * comandera: al recargar, la pantalla de carga sale antes de saber de quién es
 * la sesión, y así ya muestra su logo. Null la borra (al cerrar sesión).
 */
export function guardarMarca(marca: MarcaGuardada | null): void {
  try {
    if (marca) localStorage.setItem(CLAVE, JSON.stringify(marca));
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento: la carga muestra la marca de Totempoint.
  }
}

export function leerMarca(): MarcaGuardada | null {
  try {
    const m = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as MarcaGuardada | null;
    return m && typeof m.nombre === "string" ? m : null;
  } catch {
    return null;
  }
}

/**
 * Pone el logo de la empresa como ícono de la pestaña (y el de "agregar a
 * inicio" del celular) mientras la pantalla está abierta, y devuelve el de
 * antes al salir. Sin logo deja el que hay.
 */
export function useFaviconMarca(logo: string | null | undefined): void {
  useEffect(() => {
    if (!logo || typeof document === "undefined") return;
    const links = [
      ...document.querySelectorAll<HTMLLinkElement>(
        'link[rel~="icon"], link[rel="apple-touch-icon"]',
      ),
    ];
    const antes = links.map((l) => ({ l, href: l.href, type: l.type }));
    for (const l of links) {
      l.href = logo;
      l.removeAttribute("type");
    }
    return () => {
      for (const { l, href, type } of antes) {
        l.href = href;
        if (type) l.type = type;
      }
    };
  }, [logo]);
}

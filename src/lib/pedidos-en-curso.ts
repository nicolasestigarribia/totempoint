import { useEffect } from "react";

/**
 * Los pedidos que el cliente hizo desde este celular, para volver a ellos.
 *
 * El seguimiento vive en un link con un código al azar: si el cliente cierra la
 * pestaña, pierde su pedido de vista (y el código que tiene que mostrar al
 * retirar). No tiene cuenta, así que es el teléfono el que lo recuerda: cada
 * vez que abre su seguimiento se guarda acá, y al volver a la tienda —por el
 * link, el QR o la mesa— un aviso arriba lo lleva de nuevo. Deja de ofrecerse
 * cuando el pedido se entregó o se canceló, o pasadas unas horas.
 */

const CLAVE = "pedidos-en-curso";
const VIGENCIA_MS = 12 * 60 * 60 * 1000;

export interface PedidoRecordado {
  /** "online:{empresa}" o "mesa:{token de la mesa}": dónde se ofrece. */
  canal: string;
  /** La dirección del seguimiento. */
  ruta: string;
  numero: string;
  codigo: string | null;
  terminado: boolean;
  /** Cuándo se vio por última vez. */
  visto: number;
}

function leer(): PedidoRecordado[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function recordarPedido(p: Omit<PedidoRecordado, "visto">): void {
  try {
    const ahora = Date.now();
    const lista = leer().filter((x) => x.ruta !== p.ruta && ahora - x.visto < VIGENCIA_MS);
    lista.unshift({ ...p, visto: ahora });
    localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, 10)));
  } catch {
    // Sin almacenamiento: queda el link de WhatsApp del seguimiento.
  }
}

/** El último pedido sin terminar de ese canal, si hay. */
export function pedidoEnCurso(canal: string): PedidoRecordado | null {
  const ahora = Date.now();
  return (
    leer().find((p) => p.canal === canal && !p.terminado && ahora - p.visto < VIGENCIA_MS) ?? null
  );
}

/** Lo guarda (o lo actualiza) cada vez que la página de seguimiento cambia de estado. */
export function useRecordarPedido(p: Omit<PedidoRecordado, "visto">): void {
  useEffect(() => {
    recordarPedido(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.ruta, p.terminado, p.codigo]);
}

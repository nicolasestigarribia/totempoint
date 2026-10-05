/**
 * Reglas del pedido que el celular y el servidor tienen que compartir, en un
 * módulo sin base de datos: así el navegador las importa sin arrastrar el
 * driver de MySQL, que es lo que pasa con cualquier cosa común exportada desde
 * un `*.functions.ts`.
 */

/** Tope de unidades por línea del pedido: igual en el carrito y en el servidor. */
export const MAX_POR_LINEA = 50;

/**
 * El aviso cuando el total que vio el cliente no es el que calcula el servidor
 * (cambió un precio mientras armaba el pedido). El celular lo reconoce para
 * recargar el menú y mostrar los precios nuevos.
 */
export const PRECIOS_CAMBIARON =
  "Cambiaron los precios mientras armabas tu pedido. Ya actualizamos el total: revisalo y volvé a enviarlo";

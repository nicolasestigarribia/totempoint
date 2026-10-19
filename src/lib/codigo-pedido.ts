/**
 * El código de verificación de un pedido: 4 caracteres al azar que el cliente
 * muestra al retirar.
 *
 * El número de pedido arranca en 1 todos los días, así que cualquiera puede
 * decir "soy el 3" en el mostrador; el código no se deduce del número ni de
 * nada, por eso se sortea. Sin los caracteres que se confunden al dictarlos o
 * leerlos en una pantalla chica (0/O, 1/I/L, 5/S, 8/B, 2/Z): 22 letras y
 * números, 234.256 combinaciones por pedido.
 */
export const ALFABETO_CODIGO = "ACDEFHJKMNPRTUVWXY3479";
export const LARGO_CODIGO = 4;

export function generarCodigoPedido(): string {
  const n = ALFABETO_CODIGO.length;
  // Se descartan los bytes del final del rango para que todas las letras
  // salgan con la misma probabilidad (256 no es múltiplo de 22).
  const tope = 256 - (256 % n);
  let codigo = "";
  while (codigo.length < LARGO_CODIGO) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    for (const b of bytes) {
      if (b >= tope) continue;
      codigo += ALFABETO_CODIGO[b % n];
      if (codigo.length === LARGO_CODIGO) break;
    }
  }
  return codigo;
}

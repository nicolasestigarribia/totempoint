import { useMemo } from "react";
import { claveDe, type TotemCartItem } from "@/lib/totem-cart";

/**
 * La clave con que se manda un pedido. Es la misma mientras el carrito no
 * cambie: si el envío falla porque se cortó la señal y el cliente lo vuelve a
 * mandar tal cual, el servidor reconoce la clave y no lo duplica. Si cambia
 * algo del carrito es otro pedido, y lleva otra clave.
 */
export function useClaveEnvio(items: TotemCartItem[]): string {
  const firma = items.map((i) => `${claveDe(i)}x${i.quantity}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => crypto.randomUUID(), [firma]);
}

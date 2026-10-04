/**
 * El menú del pedido online, pedido una vez y reusado entre el menú y "Tu
 * pedido". Mismo criterio que `totem-menu-cache.ts`: solo en el navegador,
 * treinta segundos, y sin guardar un error.
 */
import { getOnlineMenu, type OnlineMenu } from "@/lib/api/totem.functions";

const VIGENCIA_MS = 30_000;

const cache = new Map<string, { pedido: Promise<OnlineMenu>; hecho: number }>();

export function getOnlineMenuCached(empresa: string, local: string): Promise<OnlineMenu> {
  const pedirlo = () => getOnlineMenu({ data: { empresa, local } });
  if (typeof window === "undefined") return pedirlo();

  const clave = `${empresa}/${local}`;
  const guardado = cache.get(clave);
  if (guardado && Date.now() - guardado.hecho < VIGENCIA_MS) return guardado.pedido;

  const pedido = pedirlo().catch((error) => {
    cache.delete(clave);
    throw error;
  });
  cache.set(clave, { pedido, hecho: Date.now() });
  return pedido;
}

/** Clave del carrito del pedido online: separada de la de cualquier tótem. */
export const onlineCartKey = (empresa: string, local: string) => `online:${empresa}/${local}`;

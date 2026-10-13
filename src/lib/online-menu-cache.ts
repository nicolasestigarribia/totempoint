/**
 * El menú del pedido online, pedido una vez y reusado entre el menú y "Tu
 * pedido". Mismo criterio que `totem-menu-cache.ts`: solo en el navegador,
 * treinta segundos, y sin guardar un error.
 */
import {
  getMesaMenu,
  getOnlineMenu,
  type MesaMenu,
  type OnlineMenu,
} from "@/lib/api/totem.functions";

const VIGENCIA_MS = 30_000;

const cache = new Map<string, { pedido: Promise<OnlineMenu>; hecho: number }>();

function cacheado<T extends OnlineMenu>(clave: string, pedirlo: () => Promise<T>): Promise<T> {
  if (typeof window === "undefined") return pedirlo();

  const guardado = cache.get(clave);
  if (guardado && Date.now() - guardado.hecho < VIGENCIA_MS) return guardado.pedido as Promise<T>;

  const pedido = pedirlo().catch((error) => {
    cache.delete(clave);
    throw error;
  });
  cache.set(clave, { pedido, hecho: Date.now() });
  return pedido;
}

export function getOnlineMenuCached(empresa: string, local: string): Promise<OnlineMenu> {
  return cacheado(`${empresa}/${local}`, () => getOnlineMenu({ data: { empresa, local } }));
}

/** El menú de una mesa (/m/{token}): el mismo menú, sin envío, mínimo ni horario. */
export function getMesaMenuCached(token: string): Promise<MesaMenu> {
  return cacheado(`mesa:${token}`, () => getMesaMenu({ data: { token } }));
}

/** Clave del carrito del pedido online: separada de la de cualquier tótem. */
export const onlineCartKey = (empresa: string, local: string) => `online:${empresa}/${local}`;

/** Clave del carrito de una mesa: cada mesa el suyo, aunque compartan sucursal. */
export const mesaCartKey = (token: string) => `mesa:${token}`;

/**
 * Olvida el menú guardado: cuando el servidor avisa que los precios cambiaron,
 * el próximo pedido del menú tiene que traer los nuevos y no los de hace un rato.
 */
export function olvidarMenuOnline(): void {
  cache.clear();
}

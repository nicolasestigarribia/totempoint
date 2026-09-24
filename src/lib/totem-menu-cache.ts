import { getTotemMenu, type TotemMenu } from "@/lib/api/totem.functions";

/**
 * Cache corto del menú por tótem.
 *
 * El menú es el mismo para todas las categorías: pantalla de categorías, cada
 * categoría y combos piden `getTotemMenu` completo. Sin cache, saltar de una
 * categoría a otra (con el carrusel) va al servidor cada vez y se siente lento.
 * Se guarda la promesa —no el resultado— para que llamadas simultáneas
 * compartan el mismo pedido.
 *
 * TTL corto: si el dueño cambia el menú, la tablet lo toma en el próximo
 * arranque o a los pocos segundos, sin quedar pegada a una versión vieja.
 */
const TTL = 60_000;
const cache = new Map<string, { at: number; menu: Promise<TotemMenu> }>();

export function getMenuCached(empresa: string, local: string, totem: number): Promise<TotemMenu> {
  const key = `${empresa}/${local}/${totem}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.menu;

  const menu = getTotemMenu({ data: { empresa, local, totem } });
  cache.set(key, { at: Date.now(), menu });
  // Si el pedido falla, no dejar la promesa rota cacheada.
  void menu.catch(() => cache.delete(key));
  return menu;
}

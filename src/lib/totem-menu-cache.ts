/**
 * El menú del tótem, pedido una vez y reusado entre pantallas.
 *
 * Las tres pantallas de navegación —categorías, una categoría y combos— usan
 * el mismo menú completo, y hasta ahora cada una lo volvía a pedir entero al
 * entrar. Un cliente que mira cuatro categorías antes de decidirse disparaba
 * cuatro veces la misma consulta, con la base en Railway del otro lado de la
 * red: se nota en la tablet como un parpadeo en cada toque.
 *
 * Qué NO hace, a propósito:
 *
 * - **No cachea en el servidor.** Un módulo vive entre pedidos, así que un
 *   caché acá le serviría a un cliente lo que se calculó para otro. La clave
 *   incluye la empresa y el local, pero igual no vale la pena el riesgo por
 *   algo que en SSR se pide una sola vez.
 * - **No lo guarda para siempre.** El dueño cambia un precio o apaga un
 *   producto desde el panel mientras hay gente pidiendo, y el tótem tiene que
 *   enterarse solo. Treinta segundos es suficiente para que navegar sea fluido
 *   y poco para que alguien compre algo que ya no está.
 *
 * Además junta las llamadas en vuelo: si dos pantallas piden el menú al mismo
 * tiempo, sale una sola consulta y las dos esperan la misma respuesta.
 */
import { getTotemMenu, type TotemMenu } from "@/lib/api/totem.functions";

const VIGENCIA_MS = 30_000;

interface Entrada {
  /** La promesa, no el resultado: así las llamadas simultáneas se suman a ésta. */
  pedido: Promise<TotemMenu>;
  hecho: number;
}

const cache = new Map<string, Entrada>();

export function getMenuCached(empresa: string, local: string, totem: number): Promise<TotemMenu> {
  const pedirlo = () => getTotemMenu({ data: { empresa, local, totem } });

  // En el servidor no hay nada que ahorrar y sí algo que arriesgar.
  if (typeof window === "undefined") return pedirlo();

  const clave = `${empresa}/${local}/${totem}`;
  const guardado = cache.get(clave);
  if (guardado && Date.now() - guardado.hecho < VIGENCIA_MS) return guardado.pedido;

  const pedido = pedirlo().catch((error) => {
    // Un menú que falló no se guarda: el próximo toque tiene que reintentar y
    // no repetir el error durante medio minuto.
    cache.delete(clave);
    throw error;
  });

  cache.set(clave, { pedido, hecho: Date.now() });
  return pedido;
}

/**
 * Olvida lo cacheado. El tótem lo llama al volver a la portada por inactividad:
 * ahí empieza otro cliente y conviene que vea el menú de ahora, no el que se
 * cargó para el anterior.
 */
export function olvidarMenu(): void {
  cache.clear();
}

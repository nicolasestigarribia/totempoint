/**
 * "Repetir mi último pedido" del pedido online.
 *
 * El que vuelve suele pedir lo mismo. Al enviar un pedido se guardan sus líneas
 * en el celular, por sucursal; la próxima vez el menú lo ofrece con un toque.
 * Se guarda en el celular y no en el servidor porque el cliente no tiene
 * cuenta: es su teléfono el que lo recuerda.
 *
 * Al repetir no se confía en lo guardado: cada línea se rearma contra el menú
 * de ahora (precio, nombre, foto, regalo), lo que ya no se vende se saltea y
 * de lo que se le sacaba o agregaba quedan solo las opciones que siguen.
 * Después el servidor vuelve a validar todo, como en cualquier pedido.
 */
import type { TotemCombo, TotemProduct } from "@/lib/api/totem.functions";
import { regaloDeProducto, type TotemCartItem } from "@/lib/totem-cart";

const CLAVE = "pedido-online-repetir";
/** Pasado este tiempo ya no se ofrece: probablemente no es lo que quiere hoy. */
const VIGENCIA_MS = 120 * 24 * 60 * 60 * 1000;

export interface PedidoGuardado {
  items: TotemCartItem[];
  /** Cuándo se hizo, para decir "hace 3 días". */
  hecho: number;
}

function leerTodos(): Record<string, PedidoGuardado> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? "{}") as Record<string, PedidoGuardado>;
  } catch {
    return {};
  }
}

export function guardarParaRepetir(cartKey: string, items: TotemCartItem[]): void {
  try {
    const todos = leerTodos();
    todos[cartKey] = { items, hecho: Date.now() };
    localStorage.setItem(CLAVE, JSON.stringify(todos));
  } catch {
    // Sin espacio o en modo privado: no poder repetir no rompe nada.
  }
}

export function leerParaRepetir(cartKey: string): PedidoGuardado | null {
  const g = leerTodos()[cartKey];
  if (!g || !Array.isArray(g.items) || g.items.length === 0) return null;
  if (Date.now() - g.hecho > VIGENCIA_MS) return null;
  return g;
}

/**
 * Las líneas del pedido guardado, rearmadas contra el menú de hoy. Devuelve
 * también los nombres de lo que ya no se vende, para avisarlo.
 */
export function rearmarPedido(
  guardado: PedidoGuardado,
  products: TotemProduct[],
  combos: TotemCombo[],
): { lineas: TotemCartItem[]; faltan: string[] } {
  const lineas: TotemCartItem[] = [];
  const faltan: string[] = [];
  for (const i of guardado.items) {
    if (i.kind === "combo") {
      const c = combos.find((x) => x.id === i.refId);
      if (!c) {
        faltan.push(i.name);
        continue;
      }
      // Un combo a elección se repite con sus gustos solo si siguen a la venta
      // y suman lo que el combo trae hoy; si no, que lo arme de nuevo.
      const elecciones = i.elecciones ?? [];
      const gustosValidos = c.grupos.every(
        (g) =>
          elecciones
            .filter((e) => e.grupo === g.indice)
            .every((e) => g.opciones.some((o) => o.id === e.productId)) &&
          elecciones.filter((e) => e.grupo === g.indice).reduce((t, e) => t + e.quantity, 0) ===
            g.cantidad,
      );
      if (c.grupos.length > 0 && !gustosValidos) {
        faltan.push(`${c.name} (armalo de nuevo, cambiaron los gustos)`);
        continue;
      }
      lineas.push({
        ...i,
        name: c.name,
        price: c.price,
        photoUrl: c.photoUrl,
        regalo: c.regalo,
        removed: [],
        extras: [],
        pan: undefined,
        elecciones: c.grupos.length > 0 ? elecciones : undefined,
      });
      continue;
    }
    const p = products.find((x) => x.id === i.refId);
    if (!p) {
      faltan.push(i.name);
      continue;
    }
    const removibles = new Set(p.removables.map((r) => r.id));
    const extras = new Map(p.extras.map((e) => [e.id, e]));
    lineas.push({
      ...i,
      name: p.name,
      price: p.price,
      photoUrl: p.photoUrl,
      regalo: regaloDeProducto(p),
      // El pan elegido solo si el producto se sigue haciendo en los dos.
      pan: p.pan === "ambos" ? (i.pan ?? "blanco") : undefined,
      removed: i.removed.filter((r) => removibles.has(r.id)),
      extras: i.extras
        .filter((e) => extras.has(e.id))
        .map((e) => ({ ...e, price: extras.get(e.id)!.price })),
    });
  }
  return { lineas, faltan };
}

/** "hoy", "ayer", "hace 3 días". */
export function haceCuanto(hecho: number): string {
  const dias = Math.floor((Date.now() - hecho) / (24 * 60 * 60 * 1000));
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

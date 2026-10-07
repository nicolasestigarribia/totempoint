/**
 * "Cada 12, van 2 más de regalo".
 *
 * La regla es de la categoría: cada `cada` unidades **pagadas**, el local
 * regala `cantidad`. Las categorías con la misma regla suman juntas —doce
 * sándwiches de miga son doce aunque sean de cuatro listas— y un combo cuenta
 * por lo que trae adentro: "12 clásicos" ya son doce.
 *
 * **El regalo lo elige el cliente y no se le cobra.** Con 14 sándwiches paga
 * 12: los 2 más baratos de los sueltos salen gratis. Si tiene derecho a regalo
 * y todavía no lo agregó (por ejemplo, pidió un combo de 12), se le avisa que
 * los agregue; si igual no lo hace, la comanda le dice a la cocina cuántos
 * poner a elección del local. Lo que viene adentro de un combo nunca sale
 * gratis: el combo ya tiene su precio.
 *
 * Vive sin base de datos porque lo usan el carrito (para mostrar el total) y el
 * servidor (para cobrar), y los dos tienen que llegar al mismo número.
 */

export interface ReglaRegalo {
  /** Cada cuántas unidades pagadas. */
  cada: number;
  /** Cuántas de regalo. */
  cantidad: number;
}

/** Unidades de un pedido que cuentan para una regla. */
export interface UnidadesConRegalo {
  regla: ReglaRegalo;
  unidades: number;
}

/**
 * Una parte del pedido para el cálculo: cuántas unidades cuentan y a qué
 * precio cada una. Precio null = vienen adentro de un combo (cuentan para
 * ganar el regalo, pero no pueden salir gratis).
 */
export interface ParteRegalo extends UnidadesConRegalo {
  precioUnitario: number | null;
}

export interface ResultadoRegalo {
  /** Unidades que el cliente agregó y no se le cobran. */
  gratis: number;
  /** Lo que se descuenta del total por esas unidades. */
  descuento: number;
  /** Las que le corresponden y todavía no agregó. */
  pendientes: number;
  /** Para el próximo regalo, cuando no tiene ninguno pendiente. */
  proximo: { faltan: number; cantidad: number } | null;
}

const clave = (r: ReglaRegalo) => `${r.cada}x${r.cantidad}`;

const NINGUNO: ResultadoRegalo = { gratis: 0, descuento: 0, pendientes: 0, proximo: null };

export function calcularRegalo(partes: ParteRegalo[]): ResultadoRegalo {
  const grupos = new Map<string, { regla: ReglaRegalo; total: number; precios: number[] }>();
  for (const p of partes) {
    if (p.regla.cada < 1 || p.regla.cantidad < 1 || p.unidades <= 0) continue;
    const k = clave(p.regla);
    const g = grupos.get(k) ?? { regla: p.regla, total: 0, precios: [] };
    g.total += p.unidades;
    if (p.precioUnitario !== null) {
      for (let i = 0; i < p.unidades; i++) g.precios.push(p.precioUnitario);
    }
    grupos.set(k, g);
  }
  if (grupos.size === 0) return NINGUNO;

  let gratis = 0;
  let descuento = 0;
  let pendientes = 0;
  let proximo: ResultadoRegalo["proximo"] = null;

  for (const g of grupos.values()) {
    const { cada, cantidad } = g.regla;
    // Cuántas salen gratis: las más que se pueda, sin que las pagadas dejen
    // de alcanzar para ganarlas. 14 → 2 gratis (12 pagadas); 13 → 1.
    let f = Math.min(g.precios.length, g.total);
    while (f > 0 && f > Math.floor((g.total - f) / cada) * cantidad) f--;
    const pagadas = g.total - f;
    const ganadas = Math.floor(pagadas / cada) * cantidad;

    gratis += f;
    descuento += [...g.precios]
      .sort((a, b) => a - b)
      .slice(0, f)
      .reduce((t, x) => t + x, 0);
    pendientes += ganadas - f;

    // El próximo regalo solo se anuncia a mitad de camino: justo en 12 lo que
    // corresponde es agregar los 2, no "sumá 12 más".
    const resto = pagadas % cada;
    if (ganadas - f === 0 && resto > 0) {
      const este = { faltan: cada - resto, cantidad };
      if (!proximo || este.faltan < proximo.faltan) proximo = este;
    }
  }

  return { gratis, descuento: Math.round(descuento * 100) / 100, pendientes, proximo };
}

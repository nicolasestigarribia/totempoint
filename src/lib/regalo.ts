/**
 * "Cada 12, van 2 más de regalo".
 *
 * La regla es de la categoría: cada `cada` unidades de sus productos, el local
 * regala `cantidad`. Las categorías con la misma regla suman juntas —doce
 * sándwiches de miga son doce aunque sean de cuatro listas distintas— y un
 * combo cuenta por lo que trae adentro: "12 clásicos" ya son doce.
 *
 * Qué se regala lo elige el local; la app solo dice cuántos, al cliente en su
 * carrito y a la cocina en la comanda, para que nadie tenga que acordarse.
 *
 * Vive sin base de datos porque lo usan el carrito (para mostrarlo) y el
 * servidor (para guardarlo en el pedido, sin creerle al celular).
 */

export interface ReglaRegalo {
  /** Cada cuántas unidades. */
  cada: number;
  /** Cuántas de regalo. */
  cantidad: number;
}

/** Unidades de un pedido que cuentan para una regla. */
export interface UnidadesConRegalo {
  regla: ReglaRegalo;
  unidades: number;
}

const clave = (r: ReglaRegalo) => `${r.cada}x${r.cantidad}`;

/** Agrupa por regla: las categorías con la misma regla suman juntas. */
function porRegla(partes: UnidadesConRegalo[]) {
  const grupos = new Map<string, UnidadesConRegalo>();
  for (const p of partes) {
    if (p.regla.cada < 1 || p.regla.cantidad < 1 || p.unidades <= 0) continue;
    const g = grupos.get(clave(p.regla));
    if (g) g.unidades += p.unidades;
    else grupos.set(clave(p.regla), { regla: p.regla, unidades: p.unidades });
  }
  return [...grupos.values()];
}

/** Cuántas unidades de regalo corresponden. */
export function unidadesDeRegalo(partes: UnidadesConRegalo[]): number {
  return porRegla(partes).reduce(
    (t, g) => t + Math.floor(g.unidades / g.regla.cada) * g.regla.cantidad,
    0,
  );
}

/**
 * Cuánto le falta para el próximo regalo, para avisarle al cliente ("sumá 3
 * más y te regalamos 2"). Null si nada de lo que pidió tiene regalo.
 */
export function proximoRegalo(
  partes: UnidadesConRegalo[],
): { faltan: number; cantidad: number } | null {
  const grupos = porRegla(partes);
  if (grupos.length === 0) return null;
  // Con más de una regla, la que está más cerca.
  return grupos
    .map((g) => ({
      faltan: g.regla.cada - (g.unidades % g.regla.cada),
      cantidad: g.regla.cantidad,
    }))
    .sort((a, b) => a.faltan - b.faltan)[0];
}

/**
 * Lo que suma para el regalo un carrito, con las reglas que trae el menú. Es
 * lo mismo que cuenta el servidor al tomar el pedido, para que el cliente vea
 * en su carrito el regalo que después le dice la comanda.
 */
export function partesDelCarrito(
  items: { kind: "producto" | "combo"; refId: number; quantity: number }[],
  productos: { id: number; regalo: ReglaRegalo | null }[],
  combos: { id: number; regalo: UnidadesConRegalo[] }[],
): UnidadesConRegalo[] {
  return items.flatMap((i): UnidadesConRegalo[] => {
    if (i.kind === "combo") {
      const combo = combos.find((c) => c.id === i.refId);
      return (combo?.regalo ?? []).map((r) => ({
        regla: r.regla,
        unidades: r.unidades * i.quantity,
      }));
    }
    const regla = productos.find((p) => p.id === i.refId)?.regalo;
    return regla ? [{ regla, unidades: i.quantity }] : [];
  });
}

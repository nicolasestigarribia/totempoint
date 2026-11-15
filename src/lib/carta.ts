/**
 * Cargar el menú desde la carta: lo que se puede decidir sin base ni IA.
 *
 * La IA devuelve un borrador (categorías con sus productos, precios y tamaños).
 * Antes de mostrárselo al dueño hay que ordenarlo: juntar categorías repetidas,
 * avisar qué ya existe en el catálogo para no duplicarlo, y descartar lo que no
 * sirve (un producto sin nombre, un precio negativo). Todo eso vive acá, puro,
 * para poder probarlo.
 */

export interface TamanioLeido {
  nombre: string;
  precio: number;
}

export interface ProductoLeido {
  nombre: string;
  descripcion: string | null;
  /** Null cuando la carta no lo dice o no se lee: el dueño lo completa. */
  precio: number | null;
  tamanios: TamanioLeido[];
}

export interface CategoriaLeida {
  nombre: string;
  productos: ProductoLeido[];
}

export interface CartaLeida {
  categorias: CategoriaLeida[];
  /** Lo que la IA no pudo leer bien, en palabras para el dueño. */
  avisos: string[];
}

/** Una línea del borrador que el dueño revisa antes de cargar. */
export interface ProductoBorrador extends ProductoLeido {
  /** Ya hay un producto con ese nombre en el catálogo: viene destildado. */
  yaExiste: boolean;
  incluir: boolean;
}

export interface CategoriaBorrador {
  nombre: string;
  /** Id de la categoría existente con ese nombre, o null si se va a crear. */
  existenteId: number | null;
  productos: ProductoBorrador[];
}

/** Para comparar nombres: sin acentos, mayúsculas ni espacios de más. */
export function claveNombre(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Un precio usable: positivo, finito y redondeado a centavos. */
function precioValido(p: number | null | undefined): number | null {
  if (p == null || !Number.isFinite(p) || p <= 0 || p > 100_000_000) return null;
  return Math.round(p * 100) / 100;
}

function limpiarTexto(s: string | null | undefined, max: number): string {
  return (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Ordena lo que leyó la IA contra el catálogo actual:
 * - categorías con el mismo nombre (dentro de la carta o contra las existentes)
 *   se juntan en una;
 * - un producto repetido dentro de la carta queda una sola vez;
 * - lo que ya existe en el catálogo viene marcado y destildado;
 * - con un solo tamaño no hay tamaños: ese es el precio.
 */
export function armarBorrador(
  carta: CartaLeida,
  existentes: { categorias: { id: number; name: string }[]; productos: string[] },
): CategoriaBorrador[] {
  const categoriaPorClave = new Map(existentes.categorias.map((c) => [claveNombre(c.name), c]));
  const productosExistentes = new Set(existentes.productos.map(claveNombre));

  const salida = new Map<string, CategoriaBorrador>();
  const vistos = new Set<string>();

  for (const cat of carta.categorias) {
    const nombreCat = limpiarTexto(cat.nombre, 80) || "Otros";
    const clave = claveNombre(nombreCat);
    let destino = salida.get(clave);
    if (!destino) {
      const existente = categoriaPorClave.get(clave);
      destino = {
        nombre: existente?.name ?? nombreCat,
        existenteId: existente?.id ?? null,
        productos: [],
      };
      salida.set(clave, destino);
    }

    for (const p of cat.productos) {
      const nombre = limpiarTexto(p.nombre, 120);
      if (!nombre) continue;
      const claveProd = claveNombre(nombre);
      if (vistos.has(claveProd)) continue;
      vistos.add(claveProd);

      const tamaniosVistos = new Set<string>();
      let tamanios: TamanioLeido[] = [];
      for (const t of p.tamanios ?? []) {
        const n = limpiarTexto(t.nombre, 40);
        const precio = precioValido(t.precio);
        if (!n || precio == null || tamaniosVistos.has(claveNombre(n))) continue;
        tamaniosVistos.add(claveNombre(n));
        tamanios.push({ nombre: n, precio });
      }
      let precio = precioValido(p.precio);
      if (tamanios.length === 1) {
        precio = tamanios[0].precio;
        tamanios = [];
      }

      const yaExiste = productosExistentes.has(claveProd);
      destino.productos.push({
        nombre,
        descripcion: limpiarTexto(p.descripcion, 500) || null,
        precio: tamanios.length > 0 ? tamanios[0].precio : precio,
        tamanios,
        yaExiste,
        incluir: !yaExiste,
      });
    }
  }

  return [...salida.values()].filter((c) => c.productos.length > 0);
}

/** Qué le falta a una línea tildada para poder cargarse, o null si está bien. */
export function faltaEnProducto(p: ProductoBorrador): string | null {
  if (!p.nombre.trim()) return "Falta el nombre";
  if (p.tamanios.length === 0 && precioValido(p.precio) == null) return "Falta el precio";
  return null;
}

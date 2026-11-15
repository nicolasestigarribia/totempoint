/**
 * Convierte el texto de una carta (lo que sale de leer una foto o un PDF) en
 * categorías y productos con precio. Sin IA y sin costo: son reglas, así que
 * acierta con cartas prolijas (nombre ..... $precio, títulos de categoría) y
 * se equivoca con las muy diseñadas. Por eso lo que devuelve siempre pasa por
 * la revisión del dueño, y las líneas que no entendió se le muestran aparte.
 *
 * Puro y probado en `carta-texto.test.ts`.
 */
import type { CartaLeida, CategoriaLeida, ProductoLeido } from "@/lib/carta";

/** Palabras que nombran un tamaño o presentación. */
const PALABRAS_TAMANIO = new Set([
  "grande",
  "grandes",
  "chica",
  "chicas",
  "chico",
  "mediana",
  "mediano",
  "entera",
  "media",
  "individual",
  "familiar",
  "docena",
  "simple",
  "doble",
  "triple",
  "porcion",
  "porción",
  "vaso",
  "jarra",
  "botella",
  "lata",
  "unidad",
  "c/u",
  "x6",
  "x12",
  "1/2",
]);

/** Líneas que no son productos: datos del local. */
const RUIDO =
  /\b(horarios?|abierto|abrimos|cerramos|tel[eé]fono|tel\.|whatsapp|instagram|facebook|delivery|env[ií]os? sin cargo|consult[ae]|precios sujetos)|www\.|\.com|@/i;

/**
 * Precio: "$12.500", "12.500", "1.250,50", "12500", "$ 900". Un número entero:
 * no empieza ni termina en medio de otro (si no, "500ml" se leía como "50"), y
 * no es una medida ("500 ml", "1,5 L").
 */
const PRECIO =
  /(?<![\d.,])(\$\s*)?(\d{1,3}(?:[.,\s]\d{3})+|\d+)(?:,(\d{1,2}))?(?![\d.,]*\d)(?!\s*(?:ml|m1|mi|cc|gr?|kg|lts?|l|cm|u|un|uds?|%)\b)/gi;

/** Corrige lo que la lectura de la foto confunde dentro de un precio: "$12.5OO". */
function arreglarPrecios(linea: string): string {
  return linea.replace(/\$\s*[\dOoIl.,]+/g, (m) => m.replace(/[Oo]/g, "0").replace(/[Il]/g, "1"));
}

/** El valor de un precio escrito a la argentina, o null si no es un precio. */
export function leerPrecio(texto: string): number | null {
  const m = texto.trim().match(/^(\$\s*)?(\d{1,3}(?:[.,\s]\d{3})+|\d+)(?:,(\d{1,2}))?$/);
  if (!m) return null;
  const entero = Number(m[2].replace(/[.,\s]/g, ""));
  const valor = entero + (m[3] ? Number(m[3].padEnd(2, "0")) / 100 : 0);
  if (!Number.isFinite(valor) || valor <= 0 || valor > 100_000_000) return null;
  return valor;
}

interface Precio {
  valor: number;
  inicio: number;
  fin: number;
}

function preciosDe(linea: string): Precio[] {
  const salida: Precio[] = [];
  for (const m of linea.matchAll(PRECIO)) {
    const conSigno = Boolean(m[1]);
    const valor = leerPrecio(m[0]);
    if (valor == null) continue;
    // Sin "$", un número chico es una cantidad ("x 6", "2 porciones"), no un precio.
    if (!conSigno && valor < 100) continue;
    // Un número pegado a una letra es parte de un nombre ("7up", "1/2").
    const antes = linea[m.index - 1];
    if (!conSigno && antes && /[a-záéíóúñ/]/i.test(antes)) continue;
    // Pegado a una letra después ("500ml", "500m1" mal leído) es una medida.
    const despues = linea[m.index + m[0].length];
    if (despues && /[a-záéíóúñ]/i.test(despues)) continue;
    salida.push({ valor, inicio: m.index, fin: m.index + m[0].length });
  }
  return salida;
}

/** Saca los puntos guía ("Muzza ........") y símbolos sueltos de los bordes. */
function limpiar(s: string): string {
  return s
    .replace(/[.·•…_\-–—:|*]{2,}/g, " ")
    .replace(/^[\s.·•…_\-–—:|*$]+|[\s.·•…_\-–—:|*$]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function letras(s: string): string {
  return s.replace(/[^a-záéíóúüñ]/gi, "");
}

function enMayusculas(s: string): boolean {
  const l = letras(s);
  if (l.length < 3) return false;
  const mayus = l.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "").length;
  return mayus / l.length >= 0.8;
}

const MINUSCULAS = new Set([
  "de",
  "del",
  "con",
  "sin",
  "y",
  "e",
  "o",
  "a",
  "al",
  "la",
  "el",
  "en",
  "los",
  "las",
]);

/** "MUZZARELLA CON JAMÓN" → "Muzzarella con Jamón". Lo demás queda como está. */
export function aNombre(s: string): string {
  if (!enMayusculas(s)) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function esTamanio(palabra: string): boolean {
  return PALABRAS_TAMANIO.has(palabra.toLowerCase());
}

/** Una línea que solo nombra tamaños: "Grande   Chica" encabeza columnas de precios. */
function columnasDe(linea: string): string[] | null {
  const palabras = limpiar(linea).split(" ").filter(Boolean);
  if (palabras.length < 2 || !palabras.every(esTamanio)) return null;
  return palabras.map(aNombre);
}

interface LineaProducto {
  nombre: string;
  precio: number;
  tamanios: { nombre: string; precio: number }[];
}

/**
 * Lee una línea con precio. "Muzza ..... $12.500" es un producto; con varios
 * precios son tamaños: rotulados ("Grande $12.500 Chica $9.000") o por las
 * columnas que anunció un encabezado ("Grande Chica").
 */
function productoDe(
  linea: string,
  precios: Precio[],
  columnas: string[] | null,
): LineaProducto | null {
  let nombre = limpiar(linea.slice(0, precios[0].inicio));
  if (letras(nombre).length < 2) return null;

  if (precios.length === 1) {
    return { nombre: aNombre(nombre), precio: precios[0].valor, tamanios: [] };
  }

  // El rótulo de cada precio es el texto que lo precede.
  const rotulos: (string | null)[] = precios.map((p, i) => {
    if (i === 0) return null;
    const r = limpiar(linea.slice(precios[i - 1].fin, p.inicio));
    return r && letras(r).length > 0 ? r : null;
  });
  if (rotulos.slice(1).every((r) => r != null)) {
    // El primer rótulo quedó pegado al nombre: "Muzza Grande $12.500 Chica $9.000".
    const palabras = nombre.split(" ");
    const ultima = palabras[palabras.length - 1];
    let primero = "Tamaño 1";
    if (palabras.length > 1 && esTamanio(ultima)) {
      primero = ultima;
      nombre = palabras.slice(0, -1).join(" ");
    }
    rotulos[0] = primero;
  } else {
    for (let i = 0; i < rotulos.length; i++) {
      rotulos[i] = columnas && columnas.length === precios.length ? columnas[i] : `Opción ${i + 1}`;
    }
  }

  const tamanios = precios.map((p, i) => ({
    nombre: aNombre(rotulos[i] ?? `Opción ${i + 1}`),
    precio: p.valor,
  }));
  return { nombre: aNombre(nombre), precio: tamanios[0].precio, tamanios };
}

export interface ResultadoTexto {
  carta: CartaLeida;
  /** Líneas con texto que no se pudieron ubicar: el dueño las mira aparte. */
  noEntendidas: string[];
}

export function interpretarCarta(texto: string): ResultadoTexto {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => arreglarPrecios(l.replace(/\s+/g, " ").trim()))
    .filter((l) => letras(l).length > 0 || preciosDe(l).length > 0);

  const categorias: CategoriaLeida[] = [];
  const noEntendidas: string[] = [];
  let actual: CategoriaLeida | null = null;
  let ultimo: ProductoLeido | null = null;
  let columnas: string[] | null = null;

  const categoria = (nombre: string) => {
    actual = { nombre: aNombre(nombre), productos: [] };
    categorias.push(actual);
    ultimo = null;
    columnas = null;
  };
  const agregar = (p: ProductoLeido) => {
    if (!actual) categoria("");
    actual!.productos.push(p);
    ultimo = p;
  };
  /** La línea es un producto con nombre y precio (no un precio suelto). */
  const tienePrecio = (l: string | undefined) => {
    const ps = l ? preciosDe(l) : [];
    return ps.length > 0 && letras(limpiar(l!.slice(0, ps[0].inicio))).length >= 2;
  };

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (RUIDO.test(linea)) {
      noEntendidas.push(linea);
      continue;
    }
    const precios = preciosDe(linea);

    if (precios.length > 0) {
      // Solo un precio en la línea: es del producto de arriba que no tenía.
      if (letras(limpiar(linea.slice(0, precios[0].inicio))).length < 2) {
        const previo = ultimo as ProductoLeido | null;
        if (previo && previo.precio == null && precios.length === 1) {
          previo.precio = precios[0].valor;
        } else {
          noEntendidas.push(linea);
        }
        continue;
      }
      const p = productoDe(linea, precios, columnas);
      if (p)
        agregar({ nombre: p.nombre, descripcion: null, precio: p.precio, tamanios: p.tamanios });
      else noEntendidas.push(linea);
      continue;
    }

    const limpia = limpiar(linea);
    if (letras(limpia).length < 3) continue;

    const cols = columnasDe(limpia);
    if (cols) {
      columnas = cols;
      continue;
    }

    const corta = limpia.length <= 40 && limpia.split(" ").length <= 5 && !/[,.;]$/.test(limpia);
    const previo = ultimo as ProductoLeido | null;
    // Un título de categoría: corto y en mayúsculas, o corto y seguido de precios
    // cuando no venimos de un producto.
    // "Bebidas" o "Pizzas especiales" en minúsculas también: una o dos palabras
    // que empiezan con mayúscula y abren una lista de precios.
    const tituloSuelto =
      tienePrecio(lineas[i + 1]) &&
      (!previo || (limpia.split(" ").length <= 2 && /^[A-ZÁÉÍÓÚÑ]/.test(limpia)));
    if (corta && (enMayusculas(limpia) || tituloSuelto)) {
      categoria(limpia);
      continue;
    }
    // Texto debajo de un producto: su descripción.
    if (previo) {
      previo.descripcion = previo.descripcion ? `${previo.descripcion} ${limpia}` : limpia;
      continue;
    }
    // Un nombre sin precio: puede que el precio venga en la línea siguiente.
    if (corta) {
      agregar({ nombre: aNombre(limpia), descripcion: null, precio: null, tamanios: [] });
      continue;
    }
    noEntendidas.push(linea);
  }

  return { carta: { categorias, avisos: [] }, noEntendidas };
}

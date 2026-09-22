/**
 * El ícono que queda en la pantalla de inicio de la tablet.
 *
 * Android exige un PNG de 192 y otro de 512 píxeles para instalar una web como
 * aplicación; sin eso crea un acceso directo común, que abre en una pestaña de
 * Chrome **con la barra de direcciones a la vista** — justo lo que se quiere
 * evitar en un mostrador. Un SVG no alcanza: Chrome no lo toma para el ícono
 * del lanzador en Android.
 *
 * Por eso el PNG se dibuja acá, píxel por píxel, en vez de sumar una
 * dependencia de imágenes o pedirle al dueño que suba dos archivos más. Se
 * dibuja un tótem: una pantalla con su pie, en el color de la marca sobre la
 * base que eligió. No es el logo del negocio —recortar y redimensionar un logo
 * cualquiera a un cuadrado sin un decodificador de imágenes no se puede hacer
 * bien— pero es suyo por el color, y en una tablet que tiene una sola
 * aplicación instalada eso alcanza de sobra.
 */
import { deflateSync } from "node:zlib";

type Rgb = [number, number, number];

/** #rgb o #rrggbb a componentes. Cualquier otra cosa devuelve null. */
export function hexARgb(hex: string | null | undefined): Rgb | null {
  if (!hex) return null;
  const limpio = hex.trim().replace(/^#/, "");
  const largo = limpio.length === 3 ? limpio.replace(/./g, (c) => c + c) : limpio;
  if (!/^[0-9a-fA-F]{6}$/.test(largo)) return null;
  return [
    parseInt(largo.slice(0, 2), 16),
    parseInt(largo.slice(2, 4), 16),
    parseInt(largo.slice(4, 6), 16),
  ];
}

/** Distancia de un punto al rectángulo redondeado, negativa adentro. */
function distanciaCajaRedondeada(
  px: number,
  py: number,
  cx: number,
  cy: number,
  mitadAncho: number,
  mitadAlto: number,
  radio: number,
): number {
  const dx = Math.abs(px - cx) - (mitadAncho - radio);
  const dy = Math.abs(py - cy) - (mitadAlto - radio);
  const fuera = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const adentro = Math.min(Math.max(dx, dy), 0);
  return fuera + adentro - radio;
}

/**
 * Mezcla `tinta` sobre `base` según cuánto del píxel cubre la forma. El borde
 * se suaviza con la distancia, así el ícono no queda escalonado a 192 píxeles.
 */
function pintar(destino: Rgb, tinta: Rgb, cobertura: number): Rgb {
  const a = Math.min(1, Math.max(0, cobertura));
  return [
    Math.round(destino[0] + (tinta[0] - destino[0]) * a),
    Math.round(destino[1] + (tinta[1] - destino[1]) * a),
    Math.round(destino[2] + (tinta[2] - destino[2]) * a),
  ];
}

/**
 * Dibuja el tótem y devuelve los píxeles RGB, fila por fila.
 *
 * `escala` encoge el dibujo alrededor del centro sin tocar el fondo. Sirve
 * para la variante "maskable": Android recorta ese ícono a un círculo y solo
 * garantiza el 80% central, así que ahí el tótem tiene que entrar más chico o
 * se queda sin pie.
 */
function dibujar(size: number, fondo: Rgb, marca: Rgb, escala: number): Buffer {
  const pixeles = Buffer.alloc(size * size * 3);
  const s = size;
  const centro = s / 2;
  /** Una medida del dibujo, encogida alrededor del centro. */
  const e = (fraccion: number) => centro + (s * fraccion - centro) * escala;
  /** Un largo del dibujo (no una posición), encogido. */
  const l = (fraccion: number) => s * fraccion * escala;

  // Medidas en fracciones del lado, para que 192 y 512 se vean iguales.
  const pantallaMitadAncho = l(0.26);
  const pantallaMitadAlto = l(0.3);
  const pantallaCx = centro;
  const pantallaCy = e(0.43);
  const pantallaRadio = l(0.07);
  const grosor = l(0.062);

  const pieMitadAncho = l(0.055);
  const pieMitadAlto = l(0.1);
  const pieCy = e(0.79);

  const baseMitadAncho = l(0.19);
  const baseMitadAlto = l(0.032);
  const baseCy = e(0.875);

  // Suavizado: un píxel de transición a cada lado del borde.
  const borde = 0.9;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let color = fondo;

      // Marco de la pantalla: el anillo entre la caja y la caja interior.
      const dPantalla = distanciaCajaRedondeada(
        px,
        py,
        pantallaCx,
        pantallaCy,
        pantallaMitadAncho,
        pantallaMitadAlto,
        pantallaRadio,
      );
      const anillo = Math.abs(dPantalla + grosor / 2) - grosor / 2;
      color = pintar(color, marca, (borde - anillo) / borde);

      // Pie y base, macizos.
      const dPie = distanciaCajaRedondeada(
        px,
        py,
        pantallaCx,
        pieCy,
        pieMitadAncho,
        pieMitadAlto,
        l(0.015),
      );
      color = pintar(color, marca, (borde - dPie) / borde);

      const dBase = distanciaCajaRedondeada(
        px,
        py,
        pantallaCx,
        baseCy,
        baseMitadAncho,
        baseMitadAlto,
        l(0.03),
      );
      color = pintar(color, marca, (borde - dBase) / borde);

      const i = (y * s + x) * 3;
      pixeles[i] = color[0];
      pixeles[i + 1] = color[1];
      pixeles[i + 2] = color[2];
    }
  }

  return pixeles;
}

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(datos: Buffer): number {
  let c = 0xffffffff;
  for (const byte of datos) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "latin1"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([largo, cuerpo, crc]);
}

/**
 * Arma el PNG del ícono. `size` es el lado en píxeles y `escala` cuánto del
 * cuadrado ocupa el dibujo (1 llena el ícono normal, menos deja el margen que
 * Android recorta en los "maskable").
 */
export function iconoTotemPng(
  size: number,
  fondoHex: string,
  marcaHex: string,
  escala = 1,
): Buffer {
  const fondo = hexARgb(fondoHex) ?? [5, 1, 2];
  const marca = hexARgb(marcaHex) ?? [255, 255, 255];
  const pixeles = dibujar(size, fondo, marca, escala);

  // Cada fila del PNG va precedida por su byte de filtro (0 = ninguno).
  const crudo = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const desde = y * size * 3;
    crudo[y * (size * 3 + 1)] = 0;
    pixeles.copy(crudo, y * (size * 3 + 1) + 1, desde, desde + size * 3);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por componente
  ihdr[9] = 2; // color: RGB
  ihdr[10] = 0; // compresión: deflate
  ihdr[11] = 0; // filtrado estándar
  ihdr[12] = 0; // sin entrelazado

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(crudo, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

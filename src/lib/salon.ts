/**
 * La geometría del salón, sin base ni DOM: la usan el editor del panel (para
 * dibujar y para no soltar una mesa encima de otra) y `saveSalon` (para
 * rechazar un plano que no entra o se pisa).
 *
 * El salón es una grilla de columnas × filas que elige el dueño. Una mesa
 * ocupa un rectángulo de `w` × `h` celdas, también elegido por el dueño e
 * independiente de sus lugares; su posición (x, y) es la celda de la esquina
 * superior izquierda.
 */

/** El tamaño de un salón que todavía no se agrandó ni achicó. */
export const COLUMNAS = 24;
export const FILAS = 16;

export const SALON_MIN = { columnas: 6, filas: 4 };
export const SALON_MAX = { columnas: 60, filas: 40 };
/** El lado más largo de una mesa, en celdas. */
export const MESA_MAX = 12;

export const FORMAS = ["redonda", "cuadrada", "rectangular"] as const;
export type Forma = (typeof FORMAS)[number];

export const LUGARES_MIN = 1;
export const LUGARES_MAX = 12;

export interface Salon {
  columnas: number;
  filas: number;
}

export interface MesaPlano {
  number: number;
  seats: number;
  shape: Forma;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * El tamaño con que nace una mesa nueva, según su forma y sus lugares. Después
 * el dueño la estira como quiera: cambiar los lugares ya no la cambia.
 */
export function tamanioInicial(shape: Forma, seats: number): { w: number; h: number } {
  if (shape === "rectangular") {
    return { w: Math.max(2, Math.ceil(seats / 2)), h: 2 };
  }
  if (seats <= 2) return { w: 1, h: 1 };
  if (seats <= 4) return { w: 2, h: 2 };
  return { w: 3, h: 3 };
}

/** ¿La mesa entra entera dentro del salón? */
export function dentro(m: MesaPlano, salon: Salon): boolean {
  return m.x >= 0 && m.y >= 0 && m.x + m.w <= salon.columnas && m.y + m.h <= salon.filas;
}

/** ¿Las dos mesas comparten alguna celda? */
export function sePisan(a: MesaPlano, b: MesaPlano): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * ¿Se puede poner `m` ahí? Dentro del salón y sin pisar a ninguna de `otras`
 * (que no deben incluirla a ella misma).
 */
export function libre(m: MesaPlano, otras: MesaPlano[], salon: Salon): boolean {
  return dentro(m, salon) && otras.every((o) => !sePisan(m, o));
}

/**
 * La primera celda donde entra una mesa nueva de `w` × `h`, recorriendo fila
 * por fila. Null si no hay lugar.
 */
export function primerHueco(
  w: number,
  h: number,
  mesas: MesaPlano[],
  salon: Salon,
): { x: number; y: number } | null {
  for (let y = 0; y < salon.filas; y++) {
    for (let x = 0; x < salon.columnas; x++) {
      const prueba: MesaPlano = { number: 0, seats: 1, shape: "cuadrada", x, y, w, h };
      if (libre(prueba, mesas, salon)) return { x, y };
    }
  }
  return null;
}

/** El número que le toca a una mesa nueva: el siguiente al más alto. */
export function proximoNumero(mesas: MesaPlano[]): number {
  return mesas.reduce((max, m) => Math.max(max, m.number), 0) + 1;
}

/**
 * El salón más chico que todavía contiene todas las mesas: hasta ahí se puede
 * achicar sin dejar ninguna afuera.
 */
export function salonMinimo(mesas: MesaPlano[]): Salon {
  return {
    columnas: Math.max(SALON_MIN.columnas, ...mesas.map((m) => m.x + m.w)),
    filas: Math.max(SALON_MIN.filas, ...mesas.map((m) => m.y + m.h)),
  };
}

/**
 * Por qué un plano no se puede guardar, o null si está bien. Lo usa el server:
 * el editor ya lo evita, pero el server no le cree al cliente.
 */
export function errorDelPlano(mesas: MesaPlano[], salon: Salon): string | null {
  if (
    !Number.isInteger(salon.columnas) ||
    !Number.isInteger(salon.filas) ||
    salon.columnas < SALON_MIN.columnas ||
    salon.filas < SALON_MIN.filas ||
    salon.columnas > SALON_MAX.columnas ||
    salon.filas > SALON_MAX.filas
  ) {
    return `El salón va de ${SALON_MIN.columnas}×${SALON_MIN.filas} a ${SALON_MAX.columnas}×${SALON_MAX.filas} cuadros`;
  }
  const numeros = new Set<number>();
  for (const [i, m] of mesas.entries()) {
    if (!Number.isInteger(m.number) || m.number < 1) return "Cada mesa necesita un número";
    if (numeros.has(m.number)) return `Hay dos mesas con el número ${m.number}`;
    numeros.add(m.number);
    if (m.seats < LUGARES_MIN || m.seats > LUGARES_MAX)
      return `La mesa ${m.number} tiene que tener entre ${LUGARES_MIN} y ${LUGARES_MAX} lugares`;
    if (
      !Number.isInteger(m.w) ||
      !Number.isInteger(m.h) ||
      m.w < 1 ||
      m.h < 1 ||
      m.w > MESA_MAX ||
      m.h > MESA_MAX
    )
      return `La mesa ${m.number} tiene un tamaño inválido`;
    if (!dentro(m, salon)) return `La mesa ${m.number} queda afuera del salón`;
    const pisada = mesas.slice(0, i).find((o) => sePisan(m, o));
    if (pisada) return `La mesa ${m.number} está encima de la ${pisada.number}`;
  }
  return null;
}

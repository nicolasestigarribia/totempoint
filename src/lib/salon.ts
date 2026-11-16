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
/** Cuántas mesas (o carpas) puede tener una sucursal: un balneario tiene cientos. */
export const MAX_MESAS = 400;
/** El número más alto que puede tener una mesa. */
export const NUMERO_MAX = 999;

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

export interface PedidoVarias {
  /** El número de la primera. */
  desde: number;
  cantidad: number;
  /** Cuántas van en cada fila antes de pasar a la siguiente. */
  porFila: number;
  seats: number;
  shape: Forma;
  w: number;
  h: number;
  /** Cuadros libres entre una y otra (el pasillo). */
  separacion: number;
}

/**
 * Crea muchas de una vez, numeradas seguidas y en filas, debajo de las que ya
 * hay: un balneario con 150 carpas no las arrastra de a una. Agranda el salón
 * lo que haga falta. Devuelve un error en palabras si no se puede.
 */
export function crearVarias(
  p: PedidoVarias,
  mesas: MesaPlano[],
  salon: Salon,
  nombre = "mesas",
): { nuevas: MesaPlano[]; salon: Salon } | { error: string } {
  const enteros = [p.desde, p.cantidad, p.porFila, p.seats, p.w, p.h, p.separacion];
  if (!enteros.every(Number.isInteger)) return { error: "Revisá los números" };
  if (p.cantidad < 1) return { error: `¿Cuántas ${nombre} querés crear?` };
  if (mesas.length + p.cantidad > MAX_MESAS)
    return { error: `Como mucho ${MAX_MESAS} ${nombre} por sucursal` };
  if (p.desde < 1 || p.desde + p.cantidad - 1 > NUMERO_MAX)
    return { error: `Los números van del 1 al ${NUMERO_MAX}` };
  if (p.porFila < 1) return { error: "Tiene que haber al menos una por fila" };
  if (p.seats < LUGARES_MIN || p.seats > LUGARES_MAX)
    return { error: `Los lugares van de ${LUGARES_MIN} a ${LUGARES_MAX}` };
  if (p.w < 1 || p.h < 1 || p.w > MESA_MAX || p.h > MESA_MAX) return { error: "Revisá el tamaño" };
  if (p.separacion < 0 || p.separacion > 4) return { error: "La separación va de 0 a 4 cuadros" };

  const usados = new Set(mesas.map((m) => m.number));
  const repetidos: number[] = [];
  for (let n = p.desde; n < p.desde + p.cantidad; n++) if (usados.has(n)) repetidos.push(n);
  if (repetidos.length > 0) {
    const muestra = repetidos.slice(0, 5).join(", ") + (repetidos.length > 5 ? "…" : "");
    return { error: `Ya existen: ${muestra}. Empezá desde ${proximoNumero(mesas)}` };
  }

  const porFila = Math.min(p.porFila, p.cantidad);
  const filas = Math.ceil(p.cantidad / porFila);
  const y0 = mesas.length > 0 ? Math.max(...mesas.map((m) => m.y + m.h)) + p.separacion : 0;
  const ancho = porFila * p.w + (porFila - 1) * p.separacion;
  const alto = y0 + filas * p.h + (filas - 1) * p.separacion;
  if (ancho > SALON_MAX.columnas || alto > SALON_MAX.filas) {
    return {
      error: `No entran en el plano (como mucho ${SALON_MAX.columnas}×${SALON_MAX.filas} cuadros). Probá con menos por fila, más chicas o sin separación.`,
    };
  }

  const nuevas: MesaPlano[] = Array.from({ length: p.cantidad }, (_, i) => ({
    number: p.desde + i,
    seats: p.seats,
    shape: p.shape,
    x: (i % porFila) * (p.w + p.separacion),
    y: y0 + Math.floor(i / porFila) * (p.h + p.separacion),
    w: p.w,
    h: p.h,
  }));
  return {
    nuevas,
    salon: {
      columnas: Math.max(salon.columnas, ancho),
      filas: Math.max(salon.filas, alto),
    },
  };
}

/**
 * Por qué un plano no se puede guardar, o null si está bien. Lo usa el server:
 * el editor ya lo evita, pero el server no le cree al cliente.
 */
export function errorDelPlano(mesas: MesaPlano[], salon: Salon): string | null {
  if (mesas.length > MAX_MESAS) return `Como mucho ${MAX_MESAS} por sucursal`;
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

import { describe, expect, test } from "bun:test";
import {
  COLUMNAS,
  FILAS,
  MESA_MAX,
  SALON_MAX,
  SALON_MIN,
  crearVarias,
  errorDelPlano,
  libre,
  primerHueco,
  proximoNumero,
  salonMinimo,
  sePisan,
  tamanioInicial,
  type MesaPlano,
  type Salon,
} from "./salon";

const SALON: Salon = { columnas: COLUMNAS, filas: FILAS };

const mesa = (p: Partial<MesaPlano>): MesaPlano => ({
  number: 1,
  seats: 4,
  shape: "cuadrada",
  x: 0,
  y: 0,
  w: 2,
  h: 2,
  ...p,
});

describe("tamanioInicial", () => {
  test("redonda y cuadrada nacen parejas", () => {
    expect(tamanioInicial("redonda", 2)).toEqual({ w: 1, h: 1 });
    expect(tamanioInicial("cuadrada", 4)).toEqual({ w: 2, h: 2 });
    expect(tamanioInicial("redonda", 8)).toEqual({ w: 3, h: 3 });
  });

  test("la rectangular nace a lo largo", () => {
    expect(tamanioInicial("rectangular", 6)).toEqual({ w: 3, h: 2 });
    expect(tamanioInicial("rectangular", 12)).toEqual({ w: 6, h: 2 });
  });
});

describe("sePisan / libre", () => {
  test("dos mesas que se tocan por el borde no se pisan", () => {
    expect(sePisan(mesa({ x: 0 }), mesa({ x: 2 }))).toBe(false);
  });

  test("dos mesas que comparten una celda se pisan", () => {
    expect(sePisan(mesa({ x: 0, y: 0 }), mesa({ x: 1, y: 1 }))).toBe(true);
  });

  test("el tamaño es el de la mesa, no el de sus lugares", () => {
    // 2 lugares pero estirada a 5×1: una barra.
    const barra = mesa({ seats: 2, w: 5, h: 1 });
    expect(sePisan(barra, mesa({ x: 4, w: 1, h: 1 }))).toBe(true);
    expect(sePisan(barra, mesa({ x: 5, w: 1, h: 1 }))).toBe(false);
  });

  test("no se puede poner una mesa fuera del salón", () => {
    expect(libre(mesa({ x: COLUMNAS - 1 }), [], SALON)).toBe(false);
    expect(libre(mesa({ y: FILAS - 1 }), [], SALON)).toBe(false);
    expect(libre(mesa({ x: -1 }), [], SALON)).toBe(false);
    expect(libre(mesa({ x: COLUMNAS - 2, y: FILAS - 2 }), [], SALON)).toBe(true);
  });

  test("lo que entra depende del tamaño del salón", () => {
    const chico: Salon = { columnas: 8, filas: 6 };
    expect(libre(mesa({ x: 7 }), [], chico)).toBe(false);
    expect(libre(mesa({ x: 6 }), [], chico)).toBe(true);
  });
});

describe("primerHueco", () => {
  test("en un salón vacío es la esquina", () => {
    expect(primerHueco(2, 2, [], SALON)).toEqual({ x: 0, y: 0 });
  });

  test("salta las mesas que ya están", () => {
    expect(primerHueco(2, 2, [mesa({ x: 0, y: 0 })], SALON)).toEqual({ x: 2, y: 0 });
  });

  test("con el salón lleno no hay hueco", () => {
    const salon: Salon = { columnas: 4, filas: 4 };
    const llenas = [
      mesa({ number: 1, x: 0, y: 0 }),
      mesa({ number: 2, x: 2, y: 0 }),
      mesa({ number: 3, x: 0, y: 2 }),
      mesa({ number: 4, x: 2, y: 2 }),
    ];
    expect(primerHueco(1, 1, llenas, salon)).toBeNull();
  });
});

test("proximoNumero sigue al más alto, aunque haya huecos", () => {
  expect(proximoNumero([])).toBe(1);
  expect(proximoNumero([mesa({ number: 3 }), mesa({ number: 9 })])).toBe(10);
});

test("salonMinimo no deja ninguna mesa afuera", () => {
  expect(salonMinimo([])).toEqual(SALON_MIN);
  expect(salonMinimo([mesa({ x: 10, y: 7, w: 3, h: 2 })])).toEqual({ columnas: 13, filas: 9 });
});

describe("errorDelPlano", () => {
  test("un plano bien armado pasa", () => {
    expect(errorDelPlano([mesa({ number: 1 }), mesa({ number: 2, x: 4 })], SALON)).toBeNull();
  });

  test("rechaza números repetidos, mesas encimadas, afuera o sin lugares válidos", () => {
    expect(errorDelPlano([mesa({ number: 1 }), mesa({ number: 1, x: 4 })], SALON)).toContain(
      "dos mesas",
    );
    expect(errorDelPlano([mesa({ number: 1 }), mesa({ number: 2, x: 1 })], SALON)).toContain(
      "encima",
    );
    expect(errorDelPlano([mesa({ x: COLUMNAS })], SALON)).toContain("afuera");
    expect(errorDelPlano([mesa({ seats: 0 })], SALON)).toContain("lugares");
    expect(errorDelPlano([mesa({ number: 0 })], SALON)).toContain("número");
  });

  test("rechaza tamaños de mesa y de salón fuera de rango", () => {
    expect(errorDelPlano([mesa({ w: 0 })], SALON)).toContain("tamaño");
    expect(errorDelPlano([mesa({ h: MESA_MAX + 1 })], SALON)).toContain("tamaño");
    expect(errorDelPlano([], { columnas: SALON_MAX.columnas + 1, filas: 10 })).toContain("salón");
    expect(errorDelPlano([], { columnas: 10, filas: SALON_MIN.filas - 1 })).toContain("salón");
  });

  test("achicar el salón con una mesa en el borde la deja afuera", () => {
    expect(errorDelPlano([mesa({ x: 20 })], { columnas: 20, filas: 16 })).toContain("afuera");
  });
});

describe("crearVarias", () => {
  const pedido = {
    desde: 1,
    cantidad: 25,
    porFila: 10,
    seats: 4,
    shape: "cuadrada" as const,
    w: 2,
    h: 2,
    separacion: 1,
  };

  test("numeradas seguidas, en filas, y el salón crece lo necesario", () => {
    const r = crearVarias(pedido, [], SALON);
    if ("error" in r) throw new Error(r.error);
    expect(r.nuevas).toHaveLength(25);
    expect(r.nuevas.map((m) => m.number)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(r.nuevas[0]).toMatchObject({ x: 0, y: 0 });
    expect(r.nuevas[9]).toMatchObject({ x: 27, y: 0 });
    expect(r.nuevas[10]).toMatchObject({ x: 0, y: 3 });
    // 10 de 2 con 9 pasillos = 29 columnas; 3 filas de 2 con 2 pasillos = 8 filas.
    expect(r.salon).toEqual({ columnas: 29, filas: FILAS });
    expect(errorDelPlano(r.nuevas, r.salon)).toBeNull();
  });

  test("van debajo de las que ya hay, sin pisarlas", () => {
    const hay = [mesa({ number: 1, x: 3, y: 4, w: 2, h: 2 })];
    const r = crearVarias({ ...pedido, desde: 2, cantidad: 5 }, hay, SALON);
    if ("error" in r) throw new Error(r.error);
    expect(r.nuevas[0].y).toBe(7);
    expect(errorDelPlano([...hay, ...r.nuevas], r.salon)).toBeNull();
  });

  test("150 carpas de 1 cuadro entran", () => {
    const r = crearVarias({ ...pedido, cantidad: 150, porFila: 15, w: 1, h: 1 }, [], SALON);
    if ("error" in r) throw new Error(r.error);
    expect(r.nuevas).toHaveLength(150);
    expect(errorDelPlano(r.nuevas, r.salon)).toBeNull();
  });

  test("rechaza números repetidos, de más y planos que no entran", () => {
    const hay = [mesa({ number: 3 })];
    const r1 = crearVarias({ ...pedido, cantidad: 5 }, hay, SALON);
    expect("error" in r1 && r1.error).toContain("Ya existen: 3");
    const r2 = crearVarias({ ...pedido, desde: 990, cantidad: 20 }, [], SALON);
    expect("error" in r2).toBe(true);
    const r3 = crearVarias({ ...pedido, porFila: 40, cantidad: 40 }, [], SALON);
    expect("error" in r3 && r3.error).toContain("No entran");
    const r4 = crearVarias({ ...pedido, cantidad: 401 }, [], SALON);
    expect("error" in r4).toBe(true);
  });
});

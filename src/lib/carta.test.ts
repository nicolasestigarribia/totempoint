import { describe, expect, test } from "bun:test";
import { armarBorrador, claveNombre, faltaEnProducto, type CartaLeida } from "./carta";

const vacio = { categorias: [], productos: [] };

describe("claveNombre", () => {
  test("ignora acentos, mayúsculas y espacios", () => {
    expect(claveNombre("  Empanadas   ÁRABES ")).toBe("empanadas arabes");
  });
});

describe("armarBorrador", () => {
  test("junta categorías repetidas y usa la existente", () => {
    const carta: CartaLeida = {
      avisos: [],
      categorias: [
        {
          nombre: "Pizzas",
          productos: [{ nombre: "Muzza", descripcion: null, precio: 9000, tamanios: [] }],
        },
        {
          nombre: "PIZZAS",
          productos: [{ nombre: "Napo", descripcion: null, precio: 9500, tamanios: [] }],
        },
      ],
    };
    const b = armarBorrador(carta, { categorias: [{ id: 7, name: "Pizzas" }], productos: [] });
    expect(b).toHaveLength(1);
    expect(b[0].existenteId).toBe(7);
    expect(b[0].productos.map((p) => p.nombre)).toEqual(["Muzza", "Napo"]);
  });

  test("marca y destilda lo que ya existe, y no repite productos", () => {
    const carta: CartaLeida = {
      avisos: [],
      categorias: [
        {
          nombre: "Empanadas",
          productos: [
            { nombre: "Carne", descripcion: null, precio: 1500, tamanios: [] },
            { nombre: "carne", descripcion: null, precio: 1500, tamanios: [] },
            { nombre: "Jamón y queso", descripcion: null, precio: 1500, tamanios: [] },
          ],
        },
      ],
    };
    const b = armarBorrador(carta, { categorias: [], productos: ["Jamon y Queso"] });
    expect(b[0].productos).toHaveLength(2);
    expect(b[0].productos[0]).toMatchObject({ yaExiste: false, incluir: true });
    expect(b[0].productos[1]).toMatchObject({ yaExiste: true, incluir: false });
  });

  test("un solo tamaño es el precio; varios tamaños fijan el precio del primero", () => {
    const carta: CartaLeida = {
      avisos: [],
      categorias: [
        {
          nombre: "Pizzas",
          productos: [
            {
              nombre: "Fugazza",
              descripcion: null,
              precio: null,
              tamanios: [{ nombre: "Grande", precio: 12000 }],
            },
            {
              nombre: "Muzza",
              descripcion: null,
              precio: null,
              tamanios: [
                { nombre: "Grande", precio: 11000 },
                { nombre: "Chica", precio: 8000 },
                { nombre: "grande", precio: 1 },
                { nombre: "Gigante", precio: -5 },
              ],
            },
          ],
        },
      ],
    };
    const [fuga, muzza] = armarBorrador(carta, vacio)[0].productos;
    expect(fuga).toMatchObject({ precio: 12000, tamanios: [] });
    expect(muzza.precio).toBe(11000);
    expect(muzza.tamanios).toEqual([
      { nombre: "Grande", precio: 11000 },
      { nombre: "Chica", precio: 8000 },
    ]);
  });

  test("descarta productos sin nombre y categorías vacías; precio inválido queda null", () => {
    const carta: CartaLeida = {
      avisos: [],
      categorias: [
        {
          nombre: "Vacía",
          productos: [{ nombre: "  ", descripcion: null, precio: 100, tamanios: [] }],
        },
        { nombre: "", productos: [{ nombre: "Agua", descripcion: "  ", precio: 0, tamanios: [] }] },
      ],
    };
    const b = armarBorrador(carta, vacio);
    expect(b).toHaveLength(1);
    expect(b[0].nombre).toBe("Otros");
    expect(b[0].productos[0]).toMatchObject({ nombre: "Agua", descripcion: null, precio: null });
  });
});

describe("faltaEnProducto", () => {
  const base = { descripcion: null, tamanios: [], yaExiste: false, incluir: true };
  test("pide precio cuando no hay tamaños", () => {
    expect(faltaEnProducto({ ...base, nombre: "Agua", precio: null })).toBe("Falta el precio");
    expect(faltaEnProducto({ ...base, nombre: "Agua", precio: 800 })).toBeNull();
    expect(faltaEnProducto({ ...base, nombre: " ", precio: 800 })).toBe("Falta el nombre");
  });
});

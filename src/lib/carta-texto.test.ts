import { describe, expect, test } from "bun:test";
import { aNombre, interpretarCarta, leerPrecio } from "./carta-texto";

describe("leerPrecio", () => {
  test("formato argentino", () => {
    expect(leerPrecio("$12.500")).toBe(12500);
    expect(leerPrecio("12.500")).toBe(12500);
    expect(leerPrecio("$ 1.250,50")).toBe(1250.5);
    expect(leerPrecio("12500")).toBe(12500);
    expect(leerPrecio("12,500")).toBe(12500);
    expect(leerPrecio("$900")).toBe(900);
    expect(leerPrecio("1.250.000")).toBe(1250000);
  });
  test("no es precio", () => {
    expect(leerPrecio("abc")).toBeNull();
    expect(leerPrecio("0")).toBeNull();
  });
});

describe("aNombre", () => {
  test("pasa las mayúsculas a nombre", () => {
    expect(aNombre("MUZZARELLA CON JAMON")).toBe("Muzzarella con Jamon");
    expect(aNombre("Fugazzeta")).toBe("Fugazzeta");
  });
});

describe("interpretarCarta", () => {
  test("categorías en mayúsculas y productos con puntos guía", () => {
    const { carta, noEntendidas } = interpretarCarta(
      [
        "PIZZAS",
        "Muzzarella ............ $12.500",
        "Salsa de tomate, muzzarella y aceitunas",
        "Napolitana ..... $13.800",
        "BEBIDAS",
        "Coca-Cola 500ml ...... $2.500",
        "Agua mineral    $1.800",
      ].join("\n"),
    );
    expect(noEntendidas).toEqual([]);
    expect(carta.categorias.map((c) => c.nombre)).toEqual(["Pizzas", "Bebidas"]);
    expect(carta.categorias[0].productos).toEqual([
      {
        nombre: "Muzzarella",
        descripcion: "Salsa de tomate, muzzarella y aceitunas",
        precio: 12500,
        tamanios: [],
      },
      { nombre: "Napolitana", descripcion: null, precio: 13800, tamanios: [] },
    ]);
    // "500ml" es parte del nombre, no un precio.
    expect(carta.categorias[1].productos[0]).toMatchObject({
      nombre: "Coca-Cola 500ml",
      precio: 2500,
    });
  });

  test("tamaños rotulados en la misma línea", () => {
    const { carta } = interpretarCarta("PIZZAS\nMuzzarella Grande $12.500 Chica $9.000");
    expect(carta.categorias[0].productos[0]).toEqual({
      nombre: "Muzzarella",
      descripcion: null,
      precio: 12500,
      tamanios: [
        { nombre: "Grande", precio: 12500 },
        { nombre: "Chica", precio: 9000 },
      ],
    });
  });

  test("tamaños por columnas anunciadas en un encabezado", () => {
    const { carta } = interpretarCarta(
      ["PIZZAS", "Entera   Media", "Muzzarella  $12.500  $7.000", "Fugazzeta  14.000  8.000"].join(
        "\n",
      ),
    );
    const [muzza, fuga] = carta.categorias[0].productos;
    expect(muzza.tamanios).toEqual([
      { nombre: "Entera", precio: 12500 },
      { nombre: "Media", precio: 7000 },
    ]);
    expect(fuga.tamanios.map((t) => t.precio)).toEqual([14000, 8000]);
  });

  test("varios precios sin rótulo ni encabezado quedan como opciones", () => {
    const { carta } = interpretarCarta("Lomito  $9.000  $11.000");
    expect(carta.categorias[0].productos[0].tamanios.map((t) => t.nombre)).toEqual([
      "Opción 1",
      "Opción 2",
    ]);
  });

  test("precio en la línea de abajo", () => {
    const { carta } = interpretarCarta(
      ["EMPANADAS", "Carne cortada a cuchillo", "$1.500", "Jamón y queso $1.400"].join("\n"),
    );
    expect(carta.categorias[0].productos.map((p) => [p.nombre, p.precio])).toEqual([
      ["Carne cortada a cuchillo", 1500],
      ["Jamón y queso", 1400],
    ]);
  });

  test("título en minúsculas después de otra categoría", () => {
    const { carta } = interpretarCarta(
      ["Pizzas", "Muzza $12.000", "Bebidas", "Agua $1.800"].join("\n"),
    );
    expect(carta.categorias.map((c) => [c.nombre, c.productos.length])).toEqual([
      ["Pizzas", 1],
      ["Bebidas", 1],
    ]);
  });

  test("datos del local y ruido van aparte; corrige O por 0 en precios", () => {
    const { carta, noEntendidas } = interpretarCarta(
      ["Horario: martes a domingo de 20 a 00", "PIZZAS", "Muzza $12.5OO", "@lamusa.pizza"].join(
        "\n",
      ),
    );
    expect(carta.categorias[0].productos[0].precio).toBe(12500);
    expect(noEntendidas).toHaveLength(2);
  });

  test("medidas no son precios, aunque la foto lea mal la unidad", () => {
    for (const linea of [
      "Coca-Cola 500ml ...... $2.500",
      "Coca-Cola 500m1 ...... $2.500",
      "Coca-Cola 500 ml ...... $2.500",
      "Cerveza 1000cc $4.000",
    ]) {
      const p = interpretarCarta(linea).carta.categorias[0].productos[0];
      expect(p.tamanios).toEqual([]);
      expect(p.precio === 2500 || p.precio === 4000).toBe(true);
    }
  });

  test("cantidades chicas no son precios", () => {
    const { carta } = interpretarCarta("EMPANADAS\nDocena x 12 $15.000");
    expect(carta.categorias[0].productos[0]).toMatchObject({
      nombre: "Docena x 12",
      precio: 15000,
    });
  });
});

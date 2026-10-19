import { describe, expect, test } from "bun:test";
import {
  nombreMitadYMitad,
  opcionesDeMitad,
  precioMitadYMitad,
  type ProductoMitad,
} from "./mitades";

const pizza = (
  id: number,
  name: string,
  grande: number,
  chica?: number,
  extra: Partial<ProductoMitad> = {},
): ProductoMitad => ({
  id,
  name,
  price: String(grande),
  categoryId: 1,
  mitades: true,
  tamanios: [
    { nombre: "Grande", precio: String(grande) },
    ...(chica ? [{ nombre: "Chica", precio: String(chica) }] : []),
  ],
  ...extra,
});

const muzza = pizza(1, "Muzzarella", 12000, 8000);
const napo = pizza(2, "Napolitana", 14000, 9000);
const fugazza = pizza(3, "Fugazzeta", 13000); // solo grande
const empanada = pizza(4, "Empanada", 1500, undefined, { categoryId: 2 });
const sinMitades = pizza(5, "Especial", 16000, 10000, { mitades: false });
const menu = [muzza, napo, fugazza, empanada, sinMitades];

describe("mitad y mitad", () => {
  test("se combina con los de su categoría que vienen en ese tamaño", () => {
    expect(opcionesDeMitad(muzza, menu, "Grande").map((p) => p.id)).toEqual([2, 3]);
    expect(opcionesDeMitad(muzza, menu, "Chica").map((p) => p.id)).toEqual([2]);
  });

  test("si la categoría no lo permite, no hay opciones", () => {
    expect(opcionesDeMitad(sinMitades, menu, "Grande")).toEqual([]);
  });

  test("se cobra la mitad más cara", () => {
    expect(precioMitadYMitad(muzza, napo, "Grande")).toBe(14000);
    expect(precioMitadYMitad(napo, muzza, "Chica")).toBe(9000);
    expect(precioMitadYMitad(muzza, fugazza, "Chica")).toBeNull();
  });

  test("el nombre dice las dos mitades", () => {
    expect(nombreMitadYMitad("Muzzarella", "Napolitana")).toBe("½ Muzzarella + ½ Napolitana");
  });
});

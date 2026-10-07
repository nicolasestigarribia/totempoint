import { describe, expect, test } from "bun:test";
import { calcularRegalo, type ParteRegalo } from "./regalo";

const miga = { cada: 12, cantidad: 2 };
const sueltos = (unidades: number, precio = 8000): ParteRegalo => ({
  regla: miga,
  unidades,
  precioUnitario: precio,
});
const combo = (unidades: number): ParteRegalo => ({ regla: miga, unidades, precioUnitario: null });

describe("cada 12, 2 de regalo", () => {
  test("con 11 no hay regalo y avisa cuánto falta", () => {
    expect(calcularRegalo([sueltos(11)])).toEqual({
      gratis: 0,
      descuento: 0,
      pendientes: 0,
      proximo: { faltan: 1, cantidad: 2 },
    });
  });

  test("con 12 le corresponden 2 que todavía no agregó, sin 'sumá 12 más'", () => {
    const r = calcularRegalo([sueltos(12)]);
    expect(r.gratis).toBe(0);
    expect(r.pendientes).toBe(2);
    expect(r.proximo).toBeNull();
  });

  test("con 14 paga 12", () => {
    expect(calcularRegalo([sueltos(14)])).toMatchObject({
      gratis: 2,
      descuento: 16000,
      pendientes: 0,
    });
  });

  test("con 13 sale 1 gratis y le queda 1 por agregar", () => {
    expect(calcularRegalo([sueltos(13)])).toMatchObject({ gratis: 1, pendientes: 1 });
  });

  test("salen gratis los más baratos", () => {
    const r = calcularRegalo([sueltos(12, 10000), sueltos(2, 8000)]);
    expect(r.descuento).toBe(16000);
    const r2 = calcularRegalo([sueltos(13, 8000), sueltos(1, 18000)]);
    expect(r2.descuento).toBe(16000);
  });

  test("un combo de 12 gana 2 y los sueltos que agrega no se cobran", () => {
    expect(calcularRegalo([combo(12)])).toMatchObject({ gratis: 0, pendientes: 2 });
    expect(calcularRegalo([combo(12), sueltos(2)])).toMatchObject({
      gratis: 2,
      descuento: 16000,
      pendientes: 0,
    });
  });

  test("lo de adentro de un combo nunca sale gratis", () => {
    expect(calcularRegalo([combo(14)])).toMatchObject({ gratis: 0, pendientes: 2 });
  });

  test("con 28 paga 24", () => {
    expect(calcularRegalo([sueltos(28)])).toMatchObject({ gratis: 4, pendientes: 0 });
  });

  test("sin regla no hay nada", () => {
    expect(calcularRegalo([])).toEqual({ gratis: 0, descuento: 0, pendientes: 0, proximo: null });
  });
});

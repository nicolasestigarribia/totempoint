import { describe, expect, test } from "bun:test";
import { aCsv } from "./planilla";

const BOM = String.fromCharCode(0xfeff);

describe("aCsv", () => {
  test("punto y coma, BOM y decimales con coma", () => {
    expect(
      aCsv([
        ["Pedido", "Total"],
        ["1019-01", 24400.5],
      ]),
    ).toBe(BOM + "Pedido;Total\r\n1019-01;24400,5");
  });

  test("entrecomilla lo que tiene separadores o comillas", () => {
    expect(aCsv([['Muzza; "grande"', null]])).toBe(BOM + '"Muzza; ""grande""";');
  });

  test("lo que escribió un cliente no se ejecuta como fórmula", () => {
    expect(aCsv([["=HYPERLINK(1)"], [-5]])).toBe(BOM + "'=HYPERLINK(1)\r\n-5");
  });
});

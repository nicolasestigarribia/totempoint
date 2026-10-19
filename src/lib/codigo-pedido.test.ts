import { describe, expect, test } from "bun:test";
import { ALFABETO_CODIGO, LARGO_CODIGO, generarCodigoPedido } from "./codigo-pedido";

describe("generarCodigoPedido", () => {
  test("cuatro caracteres del alfabeto, sin los que se confunden", () => {
    for (let i = 0; i < 2000; i++) {
      const c = generarCodigoPedido();
      expect(c).toHaveLength(LARGO_CODIGO);
      for (const ch of c) expect(ALFABETO_CODIGO).toContain(ch);
    }
    for (const confuso of "0O1IL5S8B2Z") expect(ALFABETO_CODIGO).not.toContain(confuso);
  });

  test("no se repite como un número correlativo", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 500; i++) vistos.add(generarCodigoPedido());
    // 500 sorteos entre 234.256 combinaciones: casi todos distintos.
    expect(vistos.size).toBeGreaterThan(490);
  });
});

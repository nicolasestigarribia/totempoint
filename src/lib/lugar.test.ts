import { describe, expect, test } from "bun:test";
import { lugarDe, lugarEfectivo, nombreLugar, sustantivo, Sustantivo } from "./lugar";

describe("lugar", () => {
  test("un valor desconocido o vacío es mesa", () => {
    expect(lugarDe(null)).toBe("mesa");
    expect(lugarDe(undefined)).toBe("mesa");
    expect(lugarDe("quincho")).toBe("mesa");
    expect(lugarDe("carpa")).toBe("carpa");
  });

  test("solo un balneario tiene carpas: otra empresa dice mesa", () => {
    expect(lugarEfectivo(false, "carpa")).toBe("mesa");
    expect(lugarEfectivo(null, "sombrilla")).toBe("mesa");
    expect(lugarEfectivo(true, "carpa")).toBe("carpa");
    expect(lugarEfectivo(true, null)).toBe("mesa");
  });

  test("nombres", () => {
    expect(nombreLugar("carpa", 23)).toBe("Carpa 23");
    expect(nombreLugar("mesa", 4)).toBe("Mesa 4");
    expect(sustantivo("sombrilla")).toBe("sombrilla");
    expect(Sustantivo("sombrilla", true)).toBe("Sombrillas");
  });
});

import { describe, expect, test } from "bun:test";
import type { TotemCombo, TotemProduct } from "@/lib/api/totem.functions";
import {
  buscarEnMenu,
  hashDeSeccion,
  idDeCategoria,
  ID_COMBOS,
  normalizar,
  partirNombre,
  seccionDelHash,
} from "./menu-online";

const producto = (name: string, description: string | null = null) =>
  ({ name, description }) as TotemProduct;
const combo = (name: string, items: string[]) =>
  ({ name, description: null, items: items.map((n) => ({ name: n, quantity: 1 })) }) as TotemCombo;

test("normalizar ignora tildes y mayúsculas", () => {
  expect(normalizar("Jamón CRUDO")).toBe("jamon crudo");
});

test("partirNombre separa el número de la carta", () => {
  expect(partirNombre("01 · Jamón y queso")).toEqual({ numero: "1", resto: "Jamón y queso" });
  expect(partirNombre("Coca-Cola")).toEqual({ numero: null, resto: "Coca-Cola" });
});

describe("buscarEnMenu", () => {
  const productos = [producto("10 · Jamón crudo"), producto("2 · Palta", "con jamon")];
  const combos = [combo("Planazo", ["Jamón cocido"]), combo("Birra", ["IPA"])];

  test("sin texto no hay búsqueda", () => {
    expect(buscarEnMenu("  ", combos, productos)).toBeNull();
  });

  test("encuentra por nombre, descripción y contenido del combo, sin tildes", () => {
    const r = buscarEnMenu("jamon", combos, productos)!;
    expect(r.combos.map((c) => c.name)).toEqual(["Planazo"]);
    // Por número de carta, no alfabético: el 2 antes que el 10.
    expect(r.productos.map((p) => p.name)).toEqual(["2 · Palta", "10 · Jamón crudo"]);
  });
});

describe("hash de la categoría abierta", () => {
  const secciones = [ID_COMBOS, idDeCategoria(12)];

  test("ida y vuelta", () => {
    expect(hashDeSeccion(idDeCategoria(12))).toBe("categoria-12");
    expect(hashDeSeccion(ID_COMBOS)).toBe("categoria-combos");
    expect(seccionDelHash("#categoria-12", secciones)).toBe("cat-12");
    expect(seccionDelHash("categoria-combos", secciones)).toBe("combos");
  });

  test("lo que no es una sección del menú es la grilla", () => {
    expect(seccionDelHash("", secciones)).toBeNull();
    expect(seccionDelHash("#categoria-99", secciones)).toBeNull();
    expect(seccionDelHash("#otra-cosa", secciones)).toBeNull();
  });
});

import { describe, expect, test } from "bun:test";
import { buscarEnPanel } from "./buscador-panel";

const todo = () => true;

describe("buscarEnPanel", () => {
  test("encuentra por las palabras de quien no conoce el sistema", () => {
    expect(buscarEnPanel("delivery", todo)[0].ir).toBe("online:entrega");
    expect(buscarEnPanel("km", todo)[0].ir).toBe("online:entrega");
    expect(buscarEnPanel("whatsapp", todo)[0].ir).toBe("empresa");
    expect(buscarEnPanel("horario", todo)[0].ir).toBe("online:horario");
    expect(buscarEnPanel("excel", todo)[0].ir).toBe("caja");
  });

  test("ignora tildes y mayúsculas", () => {
    expect(buscarEnPanel("CONTRASEÑA", todo).map((d) => d.ir)).toContain("/cuenta");
    expect(buscarEnPanel("tamaño", todo)[0].titulo).toContain("Tamaños");
  });

  test("todas las palabras tienen que estar", () => {
    expect(buscarEnPanel("mitad gustos", todo)[0].ir).toBe("categorias");
    expect(buscarEnPanel("mitad zzz", todo)).toEqual([]);
  });

  test("no ofrece lo que el usuario no puede abrir", () => {
    const sinOnline = (ir: string) => !ir.startsWith("online");
    expect(buscarEnPanel("horario", sinOnline)).toEqual([]);
  });
});

import { describe, expect, test } from "bun:test";
import { linkWhatsApp, numeroWhatsApp } from "./whatsapp";

describe("numeroWhatsApp", () => {
  test("acepta como lo escriben en Argentina", () => {
    expect(numeroWhatsApp("2235550000")).toBe("5492235550000");
    expect(numeroWhatsApp("0223 15 555-0000")).toBe("5492235550000");
    expect(numeroWhatsApp("+54 9 11 5555-0000")).toBe("5491155550000");
    expect(numeroWhatsApp("+54 11 5555 0000")).toBe("5491155550000");
    expect(numeroWhatsApp("011 15 5555-0000")).toBe("5491155550000");
    expect(numeroWhatsApp("02254 15 41-2345")).toBe("5492254412345");
  });

  test("si no se puede llevar a un celular, no hay link", () => {
    expect(numeroWhatsApp("")).toBeNull();
    expect(numeroWhatsApp(null)).toBeNull();
    expect(numeroWhatsApp("4555-0000")).toBeNull();
  });

  test("el mensaje va codificado", () => {
    expect(linkWhatsApp("2235550000", "Hola! pedido 1019-01")).toBe(
      "https://wa.me/5492235550000?text=Hola!%20pedido%201019-01",
    );
  });
});

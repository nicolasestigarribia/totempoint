import { describe, expect, test } from "bun:test";
import { linkAvisoRecibido, mensajeRecibido, type PedidoAvisable } from "./aviso-cliente";

const base: PedidoAvisable = {
  customerName: "Juan Pérez",
  customerPhone: "223 555-1234",
  numero: "1110-03",
  codigo: "K3DN",
  deliveryMethod: "mostrador",
  // Aceptado a las 21:00 de Argentina con 30 minutos.
  acceptedAt: "2026-11-11T00:00:00.000Z",
  etaMinutes: 30,
  seguimiento: "https://totempoint.up.railway.app/p/primorosas/carilo/pedido/abc",
};

describe("aviso de pedido recibido", () => {
  test("arma el mensaje con número, hora, código y link", () => {
    const m = mensajeRecibido(base, "PrimoRosas");
    expect(m).toContain("¡Hola Juan!");
    expect(m).toContain("pedido 1110-03 en PrimoRosas");
    expect(m).toContain("listo para retirar alrededor de las 21:30");
    expect(m).toContain("Tu código: K3DN");
    expect(m).toContain("https://totempoint.up.railway.app/p/primorosas/carilo/pedido/abc");
  });

  test("un envío dice cuándo llega", () => {
    expect(mensajeRecibido({ ...base, deliveryMethod: "envio" }, "PrimoRosas")).toContain(
      "Te llega alrededor de las 21:30",
    );
  });

  test("sin un teléfono que sirva para WhatsApp no hay link", () => {
    expect(linkAvisoRecibido({ ...base, customerPhone: "4555" }, "PrimoRosas")).toBeNull();
    expect(linkAvisoRecibido(base, "PrimoRosas")).toStartWith("https://wa.me/5492235551234?text=");
  });
});

import { describe, expect, test } from "bun:test";
import { cobroComanda, comandasHtml, destinoComanda, type ComandaPedido } from "./comanda";

const base: ComandaPedido = {
  orderNumber: 3,
  codigo: "FYKM",
  businessDate: "2026-10-19",
  customerName: "Ana",
  createdAt: "2026-10-19T23:10:00.000Z",
  acceptedAt: null,
  etaMinutes: null,
  channel: "totem",
  tableNumber: null,
  deliveryMethod: "mostrador",
  deliveryAddress: null,
  deliveryDetails: null,
  customerPhone: null,
  comments: null,
  regaloUnidades: 0,
  paymentMethod: "efectivo",
  paymentStatus: "pendiente",
  cashPaysWith: null,
  total: "12500.00",
  items: [
    {
      productName: "Muzza",
      quantity: 2,
      removed: ["cebolla"],
      extras: [],
      pan: null,
      tamanio: "Grande",
      elecciones: [],
    },
  ],
};

describe("comanda de cocina", () => {
  test("dice a dónde va el pedido", () => {
    expect(destinoComanda(base)).toBe("RETIRA");
    expect(destinoComanda({ ...base, channel: "mesa", tableNumber: 7 })).toBe("MESA 7");
    expect(destinoComanda({ ...base, deliveryMethod: "envio" })).toBe("ENVÍO");
  });

  test("un efectivo sin cobrar sale resaltado con el monto y el vuelto", () => {
    const c = cobroComanda({ ...base, cashPaysWith: "20000" });
    expect(c.alerta).toBe(true);
    expect(c.texto).toContain("COBRAR $12.500 EFECTIVO");
    expect(c.texto).toContain("vuelto $7.500");
  });

  test("uno pagado no pide cobrar", () => {
    expect(cobroComanda({ ...base, paymentStatus: "pagado" })).toEqual({
      texto: "PAGADO",
      alerta: false,
    });
  });

  test("escapa lo que escribió el cliente", () => {
    const html = comandasHtml([{ ...base, comments: "<script>x</script>" }]);
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("SIN CEBOLLA");
    expect(html).toContain("1019-03");
  });
});

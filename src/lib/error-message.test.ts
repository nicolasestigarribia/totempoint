import { describe, expect, test } from "bun:test";
import { esErrorTecnico, mensajeDeError } from "./error-message";

describe("esErrorTecnico", () => {
  test("lo técnico no llega a la pantalla", () => {
    expect(
      esErrorTecnico(
        "Failed query: select `id`, `name` from `companies` where `companies`.`slug` = ? limit ?",
      ),
    ).toBe(true);
    expect(esErrorTecnico("read ECONNRESET")).toBe(true);
    expect(esErrorTecnico("Connection lost: PROTOCOL_CONNECTION_LOST")).toBe(true);
    expect(esErrorTecnico("ER_DUP_ENTRY: Duplicate entry")).toBe(true);
    expect(esErrorTecnico("Too many connections")).toBe(true);
  });

  test("lo que escribimos para el usuario se muestra tal cual", () => {
    for (const m of [
      "Usuario o contraseña incorrectos",
      "Este comercio no toma pedidos online",
      "En este momento no estamos tomando pedidos online",
      "Muzzarella ya no viene en tamaño Chica. Sacalo de tu pedido y volvé a elegirlo",
      "No encontramos este comercio",
      "Seleccioná una sucursal para actualizar el precio",
    ]) {
      expect(esErrorTecnico(m)).toBe(false);
    }
  });
});

describe("mensajeDeError", () => {
  test("un error técnico se cambia por el genérico", () => {
    expect(mensajeDeError(new Error("Failed query: select 1 from x"), "No se pudo cargar")).toBe(
      "No se pudo cargar",
    );
  });
  test("uno nuestro pasa", () => {
    expect(mensajeDeError(new Error("Ahora no hay Fainá. Sacalo de tu pedido"))).toBe(
      "Ahora no hay Fainá. Sacalo de tu pedido",
    );
  });
});

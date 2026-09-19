import { describe, expect, test } from "bun:test";
import {
  PANEL_SECTIONS,
  SECTION_LABEL,
  canEditSection,
  canViewSection,
  effectiveLevel,
  impliedBy,
  type PermissionMap,
} from "./permissions";
import { checkPassword, checkEmail } from "./password-policy";

describe("permisos del panel", () => {
  test("sin permisos no ve ni edita nada", () => {
    const nada: PermissionMap = {};
    for (const section of PANEL_SECTIONS) {
      expect(canViewSection(nada, section)).toBe(false);
      expect(canEditSection(nada, section)).toBe(false);
    }
  });

  test('"ver" deja mirar pero no modificar', () => {
    const perms: PermissionMap = { stock: "ver" };
    expect(canViewSection(perms, "stock")).toBe(true);
    expect(canEditSection(perms, "stock")).toBe(false);
  });

  test('"editar" incluye ver', () => {
    const perms: PermissionMap = { stock: "editar" };
    expect(canViewSection(perms, "stock")).toBe(true);
    expect(canEditSection(perms, "stock")).toBe(true);
  });

  test("el permiso de una sección no se filtra a las demás", () => {
    const perms: PermissionMap = { stock: "editar" };
    expect(canViewSection(perms, "movimientos")).toBe(false);
    expect(canViewSection(perms, "comandera")).toBe(false);
    expect(canEditSection(perms, "portada")).toBe(false);
  });

  test("quien puede cargar productos puede crear categorías", () => {
    const perms: PermissionMap = { productos: "editar" };
    expect(canEditSection(perms, "categorias")).toBe(true);
    expect(canViewSection(perms, "categorias")).toBe(true);
  });

  test("el arrastre mantiene el nivel: ver productos no habilita editar categorías", () => {
    const perms: PermissionMap = { productos: "ver" };
    expect(canViewSection(perms, "categorias")).toBe(true);
    expect(canEditSection(perms, "categorias")).toBe(false);
  });

  test("el permiso propio gana si es más alto que el arrastrado", () => {
    const perms: PermissionMap = { productos: "ver", categorias: "editar" };
    expect(effectiveLevel(perms, "categorias")).toBe("editar");
  });

  test("categorías sola no habilita productos", () => {
    const perms: PermissionMap = { categorias: "editar" };
    expect(canViewSection(perms, "productos")).toBe(false);
    expect(canEditSection(perms, "productos")).toBe(false);
  });

  test("solo productos y comandera arrastran a otra sección", () => {
    // Quien carga productos necesita poder crear la categoría donde ponerlos, y
    // quien marca los cobros necesita ver el cierre que esos cobros arman.
    expect(impliedBy("productos")).toEqual(["categorias"]);
    expect(impliedBy("comandera")).toEqual(["caja"]);
    for (const section of PANEL_SECTIONS) {
      if (section !== "productos" && section !== "comandera") {
        expect(impliedBy(section)).toEqual([]);
      }
    }
  });

  test("marcar cobros alcanza para ver el cierre de caja", () => {
    const perms: PermissionMap = { comandera: "editar" };
    expect(canViewSection(perms, "caja")).toBe(true);
    // Pero ver la comandera sin poder operarla no debería dar edición del cierre.
    expect(canEditSection({ comandera: "ver" }, "caja")).toBe(false);
    expect(canViewSection({ comandera: "ver" }, "caja")).toBe(true);
  });

  test("toda sección del panel tiene nombre para mostrar", () => {
    for (const section of PANEL_SECTIONS) {
      expect(SECTION_LABEL[section]).toBeTruthy();
    }
  });
});

describe("política de contraseñas y emails", () => {
  test("rechaza las cortas, sin letra, sin número o con espacios", () => {
    expect(checkPassword("abc123").ok).toBe(false);
    expect(checkPassword("solo-letras").ok).toBe(false);
    expect(checkPassword("12345678").ok).toBe(false);
    expect(checkPassword("hola 1234").ok).toBe(false);
  });

  test("rechaza las de catálogo aunque cumplan la forma", () => {
    expect(checkPassword("password1").ok).toBe(false);
    expect(checkPassword("abcd1234").ok).toBe(false);
  });

  test("acepta una razonable y explica qué falta cuando no", () => {
    expect(checkPassword("miga2026sanguches").ok).toBe(true);
    expect(checkPassword("corta1").problemas).toContain("Al menos 8 caracteres");
  });

  test("el email tiene que poder recibir correo", () => {
    expect(checkEmail("gerente@primorosas.com").ok).toBe(true);
    expect(checkEmail("gerente@primorosas.con").ok).toBe(false);
    expect(checkEmail("gerente@localhost").ok).toBe(false);
    expect(checkEmail("sin-arroba.com").ok).toBe(false);
    expect(checkEmail("  Gerente@PrimoRosas.com ".trim().toLowerCase()).ok).toBe(true);
  });
});

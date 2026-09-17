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

  test("productos es la única sección que arrastra a otra", () => {
    expect(impliedBy("productos")).toEqual(["categorias"]);
    for (const section of PANEL_SECTIONS) {
      if (section !== "productos") expect(impliedBy(section)).toEqual([]);
    }
  });

  test("toda sección del panel tiene nombre para mostrar", () => {
    for (const section of PANEL_SECTIONS) {
      expect(SECTION_LABEL[section]).toBeTruthy();
    }
  });
});

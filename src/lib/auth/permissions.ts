/**
 * Permisos del panel: qué secciones hay, cómo se llaman y qué implica cada una.
 *
 * Es un módulo puro, sin base de datos, para que lo usen por igual el servidor
 * (al validar) y el navegador (al dibujar el menú y el formulario de permisos).
 */

export const PANEL_SECTIONS = [
  "portada",
  "categorias",
  "productos",
  "combos",
  "ingredientes",
  "disponibilidad",
  "stock",
  "movimientos",
  "codigos",
  "precios",
  "comandera",
  "caja",
] as const;

export type PanelSection = (typeof PANEL_SECTIONS)[number];
export type PermissionLevel = "ver" | "editar";
export type PermissionMap = Partial<Record<PanelSection, PermissionLevel>>;

export const SECTION_LABEL: Record<PanelSection, string> = {
  portada: "Portada del tótem",
  categorias: "Categorías",
  productos: "Productos",
  combos: "Combos",
  ingredientes: "Ingredientes",
  disponibilidad: "Disponibilidad",
  stock: "Stock",
  movimientos: "Movimientos",
  codigos: "Motivos de movimiento",
  precios: "Precios por sucursal",
  comandera: "Comandera",
  caja: "Recaudación",
};

/**
 * Secciones que vienen de arrastre con otra, porque no se pueden usar por
 * separado: quien puede cargar productos tiene que poder crear la categoría
 * donde ponerlos. La implicación es del mismo nivel: si el origen es "ver", la
 * arrastrada también.
 *
 * Stock y Movimientos no están acá a propósito: se pueden dar por separado, y
 * cargar un movimiento acepta permiso de edición en cualquiera de las dos.
 */
export const IMPLIED_BY: Partial<Record<PanelSection, PanelSection[]>> = {
  categorias: ["productos"],
  // El cierre de caja es la suma de lo que se cobró en la comandera: quien
  // marca los cobros tiene que poder ver el total que le da.
  caja: ["comandera"],
};

const RANK: Record<PermissionLevel, number> = { ver: 1, editar: 2 };

/** El nivel que realmente tiene una sección, contando lo que le llega de arrastre. */
export function effectiveLevel(
  perms: PermissionMap,
  section: PanelSection,
): PermissionLevel | undefined {
  let best = perms[section];
  for (const source of IMPLIED_BY[section] ?? []) {
    const fromSource = perms[source];
    if (fromSource && (!best || RANK[fromSource] > RANK[best])) best = fromSource;
  }
  return best;
}

export function canViewSection(perms: PermissionMap, section: PanelSection): boolean {
  return effectiveLevel(perms, section) !== undefined;
}

export function canEditSection(perms: PermissionMap, section: PanelSection): boolean {
  return effectiveLevel(perms, section) === "editar";
}

/** Qué secciones se le abren solas al elegir una, para poder avisarlo en el formulario. */
export function impliedBy(section: PanelSection): PanelSection[] {
  return PANEL_SECTIONS.filter((target) => (IMPLIED_BY[target] ?? []).includes(section));
}

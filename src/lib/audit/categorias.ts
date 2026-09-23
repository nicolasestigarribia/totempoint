/**
 * Categorías de la auditoría. Vive aparte de `registrar.ts` porque esto lo usa
 * también el navegador, y aquel archivo importa la base.
 */
export const AUDIT_CATEGORIES = [
  "permisos",
  "precios",
  "cobros",
  "pedidos",
  "sucursales",
  "empresa",
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = {
  permisos: "Accesos y permisos",
  precios: "Precios",
  cobros: "Cobros",
  pedidos: "Pedidos",
  sucursales: "Sucursales y tótems",
  empresa: "Empresa",
};

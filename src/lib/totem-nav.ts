// Los tres datos que identifican un tótem en la URL /t/{empresa}/{local}/{totem}.
// Se pasan como strings (vienen de los params de la ruta) para armar los <Link>.
export interface TotemNav {
  empresa: string;
  local: string;
  totem: string;
}

// Clave del carrito en localStorage: un carrito por tótem, no por empresa.
export function totemCartKey(n: TotemNav): string {
  return `${n.empresa}/${n.local}/${n.totem}`;
}

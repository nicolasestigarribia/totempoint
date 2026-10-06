// Helpers de slug (sin base de datos), para compartir entre empresa y local.

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// Nombres que no pueden ser slug de empresa ni link corto de pedido online,
// porque chocan con rutas del sistema (/admin, /login, etc.). Los dos van como
// primer segmento de la URL: el link corto es literalmente /{alias}.
export const RESERVED_SLUGS = [
  "admin",
  "login",
  "kitchen",
  "superadmin",
  "api",
  "t",
  "totem",
  "img",
  "p",
  "cuenta",
  "bienvenida",
  "assets",
] as const;

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug);
}

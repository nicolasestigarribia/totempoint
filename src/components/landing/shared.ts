import { Timer, UsersRound, BadgeCheck, TrendingUp, Wallet, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// TODO: reemplazar por el número real de WhatsApp (formato internacional sin +,
// espacios ni guiones, ej. 5491112345678). Placeholder hasta que lo dé Nicolas.
export const WHATSAPP_NUMERO = "5490000000000";
const WHATSAPP_MENSAJE = encodeURIComponent("Hola, quiero conocer Totempoint para mi negocio.");
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}?text=${WHATSAPP_MENSAJE}`;

export type Beneficio = { icon: LucideIcon; title: string; desc: string };

// Fuentes candidatas para los títulos de card (subtítulos). Todas ya están
// cargadas en __root.tsx.
// Formatos de la imagen/visual del hero.
export type HeroFormat = { id: string; label: string };
export const HERO_FORMATS: HeroFormat[] = [
  { id: "mosaico", label: "Mosaico" },
  { id: "carrusel", label: "Carrusel" },
  { id: "pila", label: "Pila" },
];

export type SubFont = { id: string; label: string; family: string };
export const SUB_FONTS: SubFont[] = [
  { id: "inter", label: "Inter", family: '"Inter", system-ui, sans-serif' },
  { id: "nunito", label: "Nunito", family: '"Nunito", system-ui, sans-serif' },
  { id: "baloo", label: "Baloo 2", family: '"Baloo 2", system-ui, sans-serif' },
  { id: "archivo", label: "Archivo Black", family: '"Archivo Black", system-ui, sans-serif' },
];

export type AuroraTheme = {
  id: string;
  label: string;
  accent: string;
  bg: string;
  blobs: [string, string, string];
  heroGrad: string;
};

// Tres esquemas de color del estilo Aurora, mezclando la paleta del proyecto
// (naranja primary, ámbar/gold). El acento tiene L bajo para contrastar con
// texto blanco en botones.
export const AURORA_THEMES: AuroraTheme[] = [
  {
    id: "coral",
    label: "Coral",
    accent: "oklch(0.62 0.2 28)",
    bg: "oklch(0.99 0.005 90)",
    blobs: ["oklch(0.85 0.14 35)", "oklch(0.82 0.13 330)", "oklch(0.85 0.12 200)"],
    // 3 stops (c1, c2, c1) para que el gradiente en movimiento loopee sin costura.
    heroGrad:
      "linear-gradient(100deg, oklch(0.62 0.2 28), oklch(0.7 0.18 350), oklch(0.62 0.2 28))",
  },
  {
    id: "brasa",
    label: "Brasa",
    accent: "oklch(0.55 0.22 25)",
    bg: "oklch(0.99 0.008 60)",
    blobs: ["oklch(0.7 0.19 40)", "oklch(0.6 0.23 25)", "oklch(0.85 0.16 80)"],
    heroGrad:
      "linear-gradient(100deg, oklch(0.55 0.22 25), oklch(0.78 0.16 70), oklch(0.55 0.22 25))",
  },
  {
    id: "dorado",
    label: "Dorado",
    accent: "oklch(0.54 0.15 65)",
    bg: "oklch(0.99 0.01 88)",
    blobs: ["oklch(0.85 0.16 85)", "oklch(0.82 0.14 60)", "oklch(0.72 0.18 40)"],
    heroGrad: "linear-gradient(100deg, oklch(0.6 0.16 65), oklch(0.58 0.2 32), oklch(0.6 0.16 65))",
  },
];

export const BENEFICIOS: Beneficio[] = [
  {
    icon: Timer,
    title: "Ahorrás tiempo",
    desc: "Uno paga mientras otro pide. La fila vuela.",
  },
  {
    icon: UsersRound,
    title: "Menos gente en caja",
    desc: "Un mostrador atiende con menos personal.",
  },
  {
    icon: BadgeCheck,
    title: "Menos errores",
    desc: "Lo arma el cliente y llega escrito a la cocina.",
  },
  {
    icon: TrendingUp,
    title: "Más ticket promedio",
    desc: "Combos y extras suben la venta solos.",
  },
  {
    icon: Wallet,
    title: "Menos efectivo",
    desc: "Cobro por Mercado Pago, menos vuelto y arqueos.",
  },
  {
    icon: BarChart3,
    title: "Números claros",
    desc: "Ventas, stock y caja por sucursal, sin planillas.",
  },
];

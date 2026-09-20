import { useEffect } from "react";

/**
 * Tiñe el tótem con el color de la empresa.
 *
 * Hasta ahora la portada estaba cuidada y apenas el cliente tocaba "Empezar
 * pedido" caía en un negro plano igual para todos. Acá se pisan los tokens de
 * color mientras la pantalla del tótem está montada, así que todas las
 * pantallas de adentro (categorías, productos, carrito, checkout) siguen la
 * marca sin tocar una sola clase.
 *
 * El dueño elige el color y la base; no puede subir una imagen de fondo a
 * propósito: encima del menú hay que leer nombres y precios.
 */
export type TotemTheme = "oscuro" | "claro" | "calido" | "noche" | "arena" | "bosque";
export type TotemFont = "impacto" | "elegante" | "moderno" | "redondeado" | "sobrio";
export type TotemCorners = "redondeado" | "suave" | "recto";

/**
 * Parejas de tipografías, no fuentes sueltas.
 *
 * El dueño elige un aire, no dos familias: así no termina con un título que no
 * combina con el texto. El cuerpo queda casi siempre en Inter porque es la que
 * mejor se lee en una tablet a un metro de distancia; lo que cambia es el
 * título, que es lo que da carácter.
 */
export const FUENTES: Record<TotemFont, { display: string; cuerpo: string; nombre: string }> = {
  impacto: {
    nombre: "Impacto",
    display: '"Bebas Neue", Impact, system-ui, sans-serif',
    cuerpo: '"Inter", system-ui, sans-serif',
  },
  elegante: {
    nombre: "Elegante",
    display: '"Playfair Display", Georgia, serif',
    cuerpo: '"Inter", system-ui, sans-serif',
  },
  moderno: {
    nombre: "Moderno",
    display: '"Archivo Black", Arial, sans-serif',
    cuerpo: '"Inter", system-ui, sans-serif',
  },
  redondeado: {
    nombre: "Redondeado",
    display: '"Baloo 2", system-ui, sans-serif',
    cuerpo: '"Nunito", system-ui, sans-serif',
  },
  sobrio: {
    nombre: "Sobrio",
    display: '"Inter", system-ui, sans-serif',
    cuerpo: '"Inter", system-ui, sans-serif',
  },
};

/** Cuánto se redondean las cajas. Cambia el carácter sin tocar el contenido. */
export const ESQUINAS: Record<TotemCorners, { nombre: string; escala: string }> = {
  redondeado: { nombre: "Redondeado", escala: "1" },
  suave: { nombre: "Suave", escala: "0.5" },
  recto: { nombre: "Recto", escala: "0" },
};

/** Tokens que cambian según la base elegida. El acento los tiñe después. */
const BASES: Record<TotemTheme, Record<string, string>> = {
  oscuro: {
    "--background": "oklch(0.09 0.015 20)",
    "--foreground": "oklch(0.98 0.005 80)",
    "--card": "oklch(0.15 0.015 20)",
    "--muted": "oklch(0.2 0.02 20)",
    "--muted-foreground": "oklch(0.72 0.02 40)",
    "--border": "oklch(0.25 0.02 20)",
  },
  claro: {
    "--background": "oklch(0.97 0.01 80)",
    "--foreground": "oklch(0.2 0.02 40)",
    "--card": "oklch(1 0 0)",
    "--muted": "oklch(0.93 0.015 80)",
    "--muted-foreground": "oklch(0.45 0.03 50)",
    "--border": "oklch(0.87 0.02 70)",
  },
  calido: {
    "--background": "oklch(0.16 0.03 55)",
    "--foreground": "oklch(0.97 0.02 80)",
    "--card": "oklch(0.22 0.04 55)",
    "--muted": "oklch(0.27 0.04 55)",
    "--muted-foreground": "oklch(0.78 0.04 70)",
    "--border": "oklch(0.32 0.04 55)",
  },
  // Azul de medianoche: serio, va bien con marcas frías.
  noche: {
    "--background": "oklch(0.15 0.04 260)",
    "--foreground": "oklch(0.97 0.01 250)",
    "--card": "oklch(0.21 0.045 260)",
    "--muted": "oklch(0.26 0.05 260)",
    "--muted-foreground": "oklch(0.76 0.03 255)",
    "--border": "oklch(0.31 0.05 260)",
  },
  // Claro cálido, tipo papel: panaderías, cafés, todo lo que quiera verse amable.
  arena: {
    "--background": "oklch(0.96 0.02 75)",
    "--foreground": "oklch(0.24 0.03 50)",
    "--card": "oklch(0.99 0.01 80)",
    "--muted": "oklch(0.91 0.025 75)",
    "--muted-foreground": "oklch(0.47 0.04 55)",
    "--border": "oklch(0.85 0.03 70)",
  },
  // Verde profundo: verdulerías, comida sana, lo que sea "natural".
  bosque: {
    "--background": "oklch(0.16 0.035 155)",
    "--foreground": "oklch(0.96 0.02 140)",
    "--card": "oklch(0.22 0.04 155)",
    "--muted": "oklch(0.27 0.045 155)",
    "--muted-foreground": "oklch(0.77 0.04 150)",
    "--border": "oklch(0.32 0.045 155)",
  },
};

/**
 * Mezcla cada token con el color de la marca. La proporción es baja a
 * propósito: se busca que el fondo "sepa" a la marca, no que grite.
 */
function tenir(valor: string, accent: string, porcentaje: number) {
  return `color-mix(in oklab, ${accent} ${porcentaje}%, ${valor})`;
}

/**
 * Los tokens ya teñidos, como objeto de estilo. Sirven tanto para pisarlos en
 * el documento (el tótem real) como para ponerlos inline en un contenedor,
 * que es lo que necesita la vista previa del panel: vive en un iframe y no
 * comparte el documento con la pantalla.
 */
export function themeVars(
  accentColor: string | null,
  theme: TotemTheme = "oscuro",
  fuente: TotemFont = "impacto",
  esquinas: TotemCorners = "redondeado",
): Record<string, string> {
  const base = BASES[theme] ?? BASES.oscuro;
  const accent = accentColor?.trim();
  const vars: Record<string, string> = {};

  for (const [nombre, valor] of Object.entries(base)) {
    vars[nombre] = accent
      ? tenir(valor, accent, nombre === "--background" ? 8 : nombre === "--card" ? 6 : 4)
      : valor;
  }
  if (accent) {
    vars["--primary"] = accent;
    vars["--ring"] = accent;
  }

  const f = FUENTES[fuente] ?? FUENTES.impacto;
  vars["--font-display"] = f.display;
  vars["--font-cuerpo"] = f.cuerpo;

  // El radio se multiplica: las clases de Tailwind siguen escritas igual, pero
  // todas se achican o se van a cero de una sola vez.
  vars["--radio-escala"] = (ESQUINAS[esquinas] ?? ESQUINAS.redondeado).escala;

  return vars;
}

export function useTotemTheme(
  accentColor: string | null,
  theme: TotemTheme = "oscuro",
  fuente: TotemFont = "impacto",
  esquinas: TotemCorners = "redondeado",
) {
  useEffect(() => {
    const root = document.documentElement;
    const previos: [string, string][] = [];

    for (const [nombre, valor] of Object.entries(themeVars(accentColor, theme, fuente, esquinas))) {
      previos.push([nombre, root.style.getPropertyValue(nombre)]);
      root.style.setProperty(nombre, valor);
    }

    return () => {
      for (const [nombre, valor] of previos) {
        if (valor) root.style.setProperty(nombre, valor);
        else root.style.removeProperty(nombre);
      }
    };
  }, [accentColor, theme, fuente, esquinas]);
}

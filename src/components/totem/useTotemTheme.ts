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
export type TotemTheme = "oscuro" | "claro" | "calido";

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
  return vars;
}

export function useTotemTheme(accentColor: string | null, theme: TotemTheme = "oscuro") {
  useEffect(() => {
    const root = document.documentElement;
    const previos: [string, string][] = [];

    for (const [nombre, valor] of Object.entries(themeVars(accentColor, theme))) {
      previos.push([nombre, root.style.getPropertyValue(nombre)]);
      root.style.setProperty(nombre, valor);
    }

    return () => {
      for (const [nombre, valor] of previos) {
        if (valor) root.style.setProperty(nombre, valor);
        else root.style.removeProperty(nombre);
      }
    };
  }, [accentColor, theme]);
}

import { VariantAurora } from "./VariantAurora";
import { AURORA_THEMES, SUB_FONTS } from "./shared";

// Configuración elegida: color Brasa, fuente Inter, imágenes en Mosaico.
const TEMA = AURORA_THEMES.find((t) => t.id === "brasa") ?? AURORA_THEMES[0];
const FONT = SUB_FONTS.find((f) => f.id === "inter") ?? SUB_FONTS[0];

export function LandingShowcase() {
  return <VariantAurora theme={TEMA} subFont={FONT.family} heroFormat="mosaico" />;
}

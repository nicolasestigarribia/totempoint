/**
 * Motas que suben flotando por la portada, del color de la marca.
 *
 * Es decoración, y decoración con una intención: una pantalla completamente
 * quieta en un mostrador se lee como un cartel apagado, y la gente pasa de
 * largo. Con algo moviéndose despacio, la pantalla parece encendida y esperando.
 *
 * Los valores están escritos a mano y no salen de Math.random a propósito: la
 * portada se dibuja primero en el servidor, y dos tandas de números al azar
 * distintas hacen que React tire un error de hidratación. Además así se puede
 * elegir a ojo que queden repartidas y no todas juntas de un lado.
 *
 * Son decorativas, así que van con aria-hidden: para un lector de pantalla no
 * existen.
 */

interface Mota {
  /** Posición horizontal, en porcentaje del ancho. */
  x: number;
  /** Tamaño en píxeles. */
  tam: number;
  /** Cuánto tarda en subir, en segundos. */
  dura: number;
  /** Cuánto espera antes de empezar, en segundos. */
  demora: number;
  /** Cuánto se corre de costado mientras sube. */
  deriva: number;
  opacidad: number;
}

const MOTAS: Mota[] = [
  { x: 6, tam: 8, dura: 17, demora: 0, deriva: 26, opacidad: 0.35 },
  { x: 18, tam: 5, dura: 22, demora: 3, deriva: -18, opacidad: 0.25 },
  { x: 29, tam: 11, dura: 15, demora: 7, deriva: 34, opacidad: 0.3 },
  { x: 41, tam: 6, dura: 25, demora: 1, deriva: -28, opacidad: 0.22 },
  { x: 53, tam: 9, dura: 19, demora: 9, deriva: 20, opacidad: 0.32 },
  { x: 64, tam: 4, dura: 27, demora: 5, deriva: -14, opacidad: 0.2 },
  { x: 76, tam: 10, dura: 16, demora: 12, deriva: 30, opacidad: 0.28 },
  { x: 88, tam: 7, dura: 21, demora: 2, deriva: -22, opacidad: 0.26 },
  { x: 95, tam: 5, dura: 24, demora: 14, deriva: 16, opacidad: 0.18 },
];

export function TotemMotas({ accent }: { accent?: string }) {
  const color = accent ?? "var(--primary)";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {MOTAS.map((m, i) => (
        <span
          key={i}
          className="flota absolute bottom-0 rounded-full blur-[1px]"
          style={
            {
              left: `${m.x}%`,
              width: m.tam,
              height: m.tam,
              background: color,
              opacity: m.opacidad,
              "--dura": `${m.dura}s`,
              "--demora": `${m.demora}s`,
              "--deriva": `${m.deriva}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

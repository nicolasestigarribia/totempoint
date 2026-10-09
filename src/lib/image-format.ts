/**
 * Qué formato es una imagen según sus primeros bytes, no según lo que diga
 * quien la manda.
 *
 * El navegador puede declarar `image/webp` y mandar otra cosa: Safari no sabe
 * codificar WebP desde un canvas y devuelve un PNG sin avisar. Así entró un
 * logo PNG de 463 KB etiquetado como WebP. Mirar la firma del archivo evita
 * guardar una etiqueta falsa y rechaza lo que no sea una imagen.
 */
export type FormatoImagen = "image/webp" | "image/jpeg" | "image/png" | "image/svg+xml";

export function formatoDeImagen(bytes: Uint8Array): FormatoImagen | null {
  const ascii = (desde: number, hasta: number) =>
    String.fromCharCode(...bytes.subarray(desde, hasta));

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (bytes.length >= 8 && ascii(1, 4) === "PNG" && bytes[0] === 0x89) return "image/png";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  // SVG: solo lo cargan los scripts de seed, nunca uploadImage.
  const inicio = ascii(0, Math.min(bytes.length, 256)).trimStart();
  if (inicio.startsWith("<svg") || (inicio.startsWith("<?xml") && inicio.includes("<svg")))
    return "image/svg+xml";
  return null;
}

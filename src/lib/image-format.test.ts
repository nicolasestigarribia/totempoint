import { describe, expect, test } from "bun:test";
import { formatoDeImagen } from "./image-format";

const bytes = (...partes: (number[] | string)[]) =>
  new Uint8Array(
    partes.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)),
  );

describe("formatoDeImagen", () => {
  test("reconoce JPEG, PNG y WebP por su firma", () => {
    expect(formatoDeImagen(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(formatoDeImagen(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(formatoDeImagen(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe("image/webp");
  });

  test("un PNG que dice ser WebP es PNG (lo que manda Safari)", () => {
    const png = bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13], "IHDR");
    expect(formatoDeImagen(png)).toBe("image/png");
  });

  test("reconoce SVG, con o sin declaración XML", () => {
    expect(formatoDeImagen(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(
      "image/svg+xml",
    );
    expect(formatoDeImagen(bytes('<?xml version="1.0"?>\n<svg/>'))).toBe("image/svg+xml");
  });

  test("lo que no es imagen da null", () => {
    expect(formatoDeImagen(bytes("<html><script>alert(1)</script>"))).toBeNull();
    expect(formatoDeImagen(bytes("iVBORw0KGgo"))).toBeNull(); // un PNG todavía en base64
    expect(formatoDeImagen(bytes("RIFF", [0, 0, 0, 0], "WAVE"))).toBeNull();
    expect(formatoDeImagen(new Uint8Array())).toBeNull();
  });
});

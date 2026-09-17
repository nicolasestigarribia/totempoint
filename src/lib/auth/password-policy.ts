import { z } from "zod";

/**
 * Regla única para las contraseñas, usada por el servidor al validar y por el
 * navegador al avisar mientras se escribe. Cualquier alta o cambio de
 * contraseña pasa por acá.
 *
 * Es deliberadamente corta: largo, letras y números, y fuera las de catálogo.
 * Exigir símbolos y mayúsculas obliga a la gente a anotar la contraseña en un
 * papel al lado de la caja, que es peor que lo que evita.
 */
export const PASSWORD_MIN = 8;

/** Las que prueba cualquiera en los primeros intentos. */
const OBVIAS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "contrasena",
  "contraseña",
  "qwertyui",
  "11111111",
  "abcd1234",
  "totempoint",
]);

export interface PasswordCheck {
  ok: boolean;
  problemas: string[];
}

export function checkPassword(raw: string): PasswordCheck {
  const value = raw ?? "";
  const problemas: string[] = [];

  if (value.length < PASSWORD_MIN) problemas.push(`Al menos ${PASSWORD_MIN} caracteres`);
  if (!/[a-zA-Z]/.test(value)) problemas.push("Al menos una letra");
  if (!/[0-9]/.test(value)) problemas.push("Al menos un número");
  if (/\s/.test(value)) problemas.push("Sin espacios");
  if (OBVIAS.has(value.toLowerCase())) problemas.push("Demasiado común, elegí otra");

  return { ok: problemas.length === 0, problemas };
}

export const PASSWORD_HINT = `Mínimo ${PASSWORD_MIN} caracteres, con al menos una letra y un número.`;

/** Schema de zod para las server functions. */
export const passwordSchema = z
  .string()
  .max(100)
  .refine((v) => checkPassword(v).ok, {
    message: `Contraseña débil. ${PASSWORD_HINT}`,
  });

/**
 * Email: además del formato, se descartan cosas que en la práctica no sirven
 * para recibir un código de recuperación.
 */
export function checkEmail(raw: string): { ok: boolean; problema?: string } {
  const value = (raw ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    return { ok: false, problema: "Escribí un email válido, como nombre@dominio.com" };
  }
  if (value.endsWith(".con") || value.endsWith(".cmo") || value.endsWith(".ccom")) {
    return { ok: false, problema: "Revisá el final del email: parece un error de tipeo" };
  }
  const dominio = value.split("@")[1];
  if (dominio === "localhost" || dominio.endsWith(".local") || dominio.endsWith(".test")) {
    return { ok: false, problema: "Ese dominio no recibe correo: usá un email real" };
  }
  return { ok: true };
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .refine((v) => checkEmail(v).ok, {
    message: "Escribí un email válido: ahí se manda el código para recuperar la contraseña",
  });

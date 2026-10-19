/**
 * Texto legible para el error de una server function.
 *
 * Los `throw new Error("...")` de los handlers ya llegan con un mensaje en
 * castellano listo para mostrar. Los que rebotan en el `inputValidator`, en
 * cambio, llegan como el array de issues de zod serializado, y si se muestra
 * tal cual el usuario ve algo como
 * `[{ "validation": "regex", "code": "invalid_string", ... }]`.
 *
 * Acá se saca de ahí lo único que le sirve: los mensajes.
 */
export function mensajeDeError(err: unknown, porDefecto = "No se pudo completar la operación") {
  const crudo = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!crudo) return porDefecto;
  // Lo técnico (una consulta que falló, la conexión a la base) no le dice nada
  // a quien usa la app y no tiene por qué ver el SQL.
  if (esErrorTecnico(crudo)) return porDefecto;

  const deZod = mensajesDeZod(crudo);
  if (deZod) return deZod;

  // El genérico de TanStack Start cuando el handler falla sin mensaje propio.
  if (crudo === "An error occurred in the Server Function") return porDefecto;

  return crudo;
}

/**
 * Si el mensaje es un error técnico y no uno escrito para el usuario: lo que
 * escribimos nosotros va en castellano y sin SQL.
 */
export function esErrorTecnico(mensaje: string): boolean {
  return /Failed query|\bselect\b.*\bfrom\b|\binsert into\b|\bupdate\b.*\bset\b|ECONN|EPIPE|ETIMEDOUT|PROTOCOL_|ER_[A-Z_]+|Too many connections|fetch failed|Failed to fetch|NetworkError|Load failed|Unexpected token|is not defined|Cannot read properties/i.test(
    mensaje,
  );
}

function mensajesDeZod(crudo: string): string | null {
  const texto = crudo.trim();
  if (!texto.startsWith("[") && !texto.startsWith("{")) return null;

  try {
    const parsed: unknown = JSON.parse(texto);
    const issues = Array.isArray(parsed) ? parsed : [parsed];
    const mensajes = issues
      .map((i) => (i as { message?: unknown }).message)
      .filter((m): m is string => typeof m === "string" && m.length > 0);

    if (mensajes.length === 0) return null;
    return [...new Set(mensajes)].join(". ");
  } catch {
    return null;
  }
}

/**
 * Qué impresora tiene emparejada cada tótem, guardado en el navegador de la
 * tablet. No va a la base: el emparejado Bluetooth vive en el dispositivo
 * físico (el permiso Web Bluetooth es por-origen y por-navegador), así que la
 * asociación "este tótem usa esta impresora" pertenece a esa tablet.
 *
 * La clave incluye empresa/local/tótem para que una tablet que atienda más de
 * un tótem no mezcle impresoras: 1 tótem, 1 impresora.
 */

export interface PairedPrinter {
  /** Id que devuelve Web Bluetooth; sirve para reconectar con getDevices(). */
  deviceId: string;
  name: string;
}

const clave = (empresa: string, local: string, totem: number) =>
  `totem-printer:${empresa}/${local}/${totem}`;

export function getPaired(empresa: string, local: string, totem: number): PairedPrinter | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(clave(empresa, local, totem));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PairedPrinter;
  } catch {
    return null;
  }
}

export function savePaired(
  empresa: string,
  local: string,
  totem: number,
  printer: PairedPrinter,
): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(clave(empresa, local, totem), JSON.stringify(printer));
}

export function clearPaired(empresa: string, local: string, totem: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(clave(empresa, local, totem));
}

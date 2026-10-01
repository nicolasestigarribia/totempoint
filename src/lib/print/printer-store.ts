/**
 * Qué impresoras tiene emparejadas cada tótem, guardado en el navegador de la
 * tablet. No va a la base: el emparejado Bluetooth vive en el dispositivo
 * físico (el permiso Web Bluetooth es por-origen y por-navegador), así que la
 * asociación "esta tablet usa estas impresoras" pertenece a esa tablet.
 *
 * Un tótem imprime en dos lugares: su propia impresora (rol "totem", copia del
 * cliente) y la impresora de caja (rol "caja", copia del mostrador). La de caja
 * puede ser una sola física compartida entre varios tótems; cada tablet igual la
 * empareja por separado, porque el permiso Web Bluetooth es por-tablet.
 *
 * La clave incluye empresa/local/tótem para que una tablet que atienda más de
 * un tótem no mezcle impresoras.
 */

export type PrinterRole = "totem" | "caja";

export interface PairedPrinter {
  /** Id que devuelve Web Bluetooth; sirve para reconectar con getDevices(). */
  deviceId: string;
  name: string;
  /** Dedicada a este tótem ("totem") o compartida en caja ("caja"). */
  role: PrinterRole;
}

const clave = (empresa: string, local: string, totem: number) =>
  `totem-printer:${empresa}/${local}/${totem}`;

/**
 * Lee la lista de impresoras emparejadas. Retro-compat: el formato viejo era un
 * único objeto `{deviceId, name}` sin rol; se migra a `[{..., role: "totem"}]`
 * para que una tablet ya emparejada siga imprimiendo sin re-emparejar.
 */
export function getPairedList(empresa: string, local: string, totem: number): PairedPrinter[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(clave(empresa, local, totem));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((p): p is PairedPrinter => !!p && typeof p.deviceId === "string");
    }
    // Formato viejo: objeto único → la impresora dedicada del tótem.
    if (parsed && typeof parsed.deviceId === "string") {
      return [{ deviceId: parsed.deviceId, name: parsed.name ?? "Impresora", role: "totem" }];
    }
    return [];
  } catch {
    return [];
  }
}

/** Agrega o reemplaza la impresora de ese rol (máximo una por rol → 2 en total). */
export function addPaired(
  empresa: string,
  local: string,
  totem: number,
  printer: PairedPrinter,
): void {
  if (typeof localStorage === "undefined") return;
  const lista = getPairedList(empresa, local, totem).filter((p) => p.role !== printer.role);
  lista.push(printer);
  localStorage.setItem(clave(empresa, local, totem), JSON.stringify(lista));
}

export function removePaired(
  empresa: string,
  local: string,
  totem: number,
  role: PrinterRole,
): void {
  if (typeof localStorage === "undefined") return;
  const lista = getPairedList(empresa, local, totem).filter((p) => p.role !== role);
  if (lista.length === 0) localStorage.removeItem(clave(empresa, local, totem));
  else localStorage.setItem(clave(empresa, local, totem), JSON.stringify(lista));
}

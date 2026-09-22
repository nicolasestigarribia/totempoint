/**
 * Transporte del ticket por Web Bluetooth (BLE).
 *
 * OJO: Web Bluetooth solo habla Bluetooth Low Energy, no Bluetooth Classic
 * (SPP). Muchas térmicas —incluidas varias Epson TM por Bluetooth— son Classic
 * y NO van a aparecer en el selector. Si la impresora no aparece, es Classic y
 * hay que ir por otro camino (app nativa / red). Esta capa sirve de
 * diagnóstico y, si la impresora es BLE, de impresión real.
 *
 * No conocemos el servicio de cada modelo, así que tras conectar recorremos los
 * servicios y elegimos una característica de impresión conocida si aparece, y si
 * no la primera que permita escribir. Se listan como `optionalServices` los
 * UUIDs de servicio más comunes en térmicas BLE; sin listarlos, el navegador no
 * deja acceder a esos servicios después.
 */

// Tipos mínimos de Web Bluetooth: no vienen en la lib DOM por defecto.
interface BleCharacteristic {
  uuid: string;
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}
interface BleService {
  uuid: string;
  getCharacteristics(): Promise<BleCharacteristic[]>;
}
interface BleServer {
  connected: boolean;
  connect(): Promise<BleServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BleService[]>;
}
interface BleDevice {
  id: string;
  name?: string;
  gatt?: BleServer;
}
interface BleFilter {
  namePrefix?: string;
  services?: (number | string)[];
}
interface BleRequestOptions {
  acceptAllDevices?: boolean;
  filters?: BleFilter[];
  optionalServices?: (number | string)[];
}
interface BleApi {
  requestDevice(opts: BleRequestOptions): Promise<BleDevice>;
  getDevices?: () => Promise<BleDevice[]>;
}

declare global {
  interface Navigator {
    bluetooth?: BleApi;
  }
}

// Servicios habituales en térmicas BLE ESC/POS.
const SERVICIOS_CANDIDATOS: (number | string)[] = [
  0x18f0, // genéricas (característica de escritura 0x2af1)
  0xff00,
  0xffe0, // módulos tipo HM-10 (escritura 0xffe1)
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // UART transparente ISSC/Microchip, muy común
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // otra variante frecuente
];

export interface Impresora {
  device: BleDevice;
  characteristic: BleCharacteristic;
  serviceUuid: string;
  charUuid: string;
  /** Lista de todos los servicios/características, para diagnóstico en pantalla. */
  diagnostico: string[];
}

// Características de impresión conocidas: se prefieren si están presentes, para
// no escribir en una de configuración por error.
const CHARS_IMPRESION = [
  "2af1", // genéricas ESC/POS (servicio 0x18F0)
  "49535343-8841-43f4-a8d4-ecbe34729bb3", // UART transparente ISSC (escritura)
  "ffe1", // módulos HM-10
];

const corto = (uuid: string) =>
  /^0000[0-9a-f]{4}-0000-1000-8000-00805f9b34fb$/i.test(uuid) ? uuid.slice(4, 8) : uuid;

export function soportaWebBluetooth(): boolean {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

// Nombres típicos de impresoras térmicas para el filtro de respaldo.
const NOMBRES_IMPRESORA = ["TM", "TM-", "Epson", "EPSON", "MTP", "MPT", "Printer", "BT", "POS"];

/** Abre el selector del navegador, conecta y ubica una característica de escritura. */
export async function elegirYConectar(): Promise<Impresora> {
  const bt = navigator.bluetooth;
  if (!bt) throw new Error("Este navegador no soporta Web Bluetooth");

  let device: BleDevice;
  try {
    // Chrome soporta acceptAllDevices: lista todo, ideal para no adivinar.
    device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: SERVICIOS_CANDIDATOS,
    });
  } catch {
    // Bluefy (iOS) no soporta acceptAllDevices y rechaza sin abrir el selector.
    // Reintenta con filtros por nombre de impresora y por servicios conocidos.
    device = await bt.requestDevice({
      filters: [
        ...NOMBRES_IMPRESORA.map((n) => ({ namePrefix: n })),
        ...SERVICIOS_CANDIDATOS.map((s) => ({ services: [s] })),
      ],
      optionalServices: SERVICIOS_CANDIDATOS,
    });
  }
  return conectar(device);
}

async function conectar(device: BleDevice): Promise<Impresora> {
  if (!device.gatt) throw new Error("El dispositivo no expone GATT (no es BLE)");

  const server = await device.gatt.connect();
  const servicios = await server.getPrimaryServices();

  const escribibles: { service: string; char: BleCharacteristic }[] = [];
  const diagnostico: string[] = [];

  for (const s of servicios) {
    const chars = await s.getCharacteristics();
    for (const c of chars) {
      const w = c.properties.write;
      const wn = c.properties.writeWithoutResponse;
      diagnostico.push(
        `svc ${corto(s.uuid)} chr ${corto(c.uuid)} ${w ? "W" : "-"}${wn ? "w" : "-"}`,
      );
      if (w || wn) escribibles.push({ service: s.uuid, char: c });
    }
  }

  if (escribibles.length === 0) {
    throw new Error(`Sin característica de escritura. ${diagnostico.join(" | ")}`);
  }

  // Preferir una característica de impresión conocida; si no, la primera escribible.
  const elegida =
    escribibles.find((e) => CHARS_IMPRESION.some((p) => e.char.uuid.toLowerCase().includes(p))) ??
    escribibles[0];

  return {
    device,
    characteristic: elegida.char,
    serviceUuid: elegida.service,
    charUuid: elegida.char.uuid,
    diagnostico,
  };
}

/**
 * Reconecta a una impresora ya emparejada sin abrir el selector, usando el id
 * guardado. Devuelve null si el navegador no recuerda el permiso (hay que
 * volver a emparejar). `getDevices()` es por-origen: solo funciona en la misma
 * tablet donde se emparejó.
 */
export async function reconectarGuardada(deviceId: string): Promise<Impresora | null> {
  if (!navigator.bluetooth?.getDevices) return null;
  const devices = await navigator.bluetooth.getDevices();
  const device = devices.find((d) => d.id === deviceId);
  if (!device) return null;
  return conectar(device);
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Manda los bytes en tandas chicas: el MTU de BLE es limitado y una escritura
 * grande de una sola vez falla o se corta. 180 bytes es un tamaño seguro.
 */
export async function imprimir(impresora: Impresora, datos: Uint8Array): Promise<void> {
  const c = impresora.characteristic;
  // 20 bytes = MTU por defecto de BLE (23 - 3 de cabecera ATT). Escribir más de
  // una vez suele descartarse silenciosamente en impresoras que no negocian MTU.
  const TAM = 20;
  for (let i = 0; i < datos.length; i += TAM) {
    const tanda = datos.slice(i, i + TAM);
    if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(tanda);
    else await c.writeValueWithResponse(tanda);
    await dormir(20);
  }
}

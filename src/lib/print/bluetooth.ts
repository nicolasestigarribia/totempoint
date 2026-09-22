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
 * servicios y usamos la primera característica que permita escribir. Se listan
 * como `optionalServices` los UUIDs de servicio más comunes en térmicas BLE;
 * sin listarlos, el navegador no deja acceder a esos servicios después.
 */

// Tipos mínimos de Web Bluetooth: no vienen en la lib DOM por defecto.
interface BleCharacteristic {
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
interface BleApi {
  requestDevice(opts: {
    acceptAllDevices?: boolean;
    optionalServices?: (number | string)[];
  }): Promise<BleDevice>;
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
}

export function soportaWebBluetooth(): boolean {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

/** Abre el selector del navegador, conecta y ubica una característica de escritura. */
export async function elegirYConectar(): Promise<Impresora> {
  if (!navigator.bluetooth) throw new Error("Este navegador no soporta Web Bluetooth");

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICIOS_CANDIDATOS,
  });
  return conectar(device);
}

async function conectar(device: BleDevice): Promise<Impresora> {
  if (!device.gatt) throw new Error("El dispositivo no expone GATT (no es BLE)");

  const server = await device.gatt.connect();
  const servicios = await server.getPrimaryServices();

  for (const s of servicios) {
    const chars = await s.getCharacteristics();
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) {
        return { device, characteristic: c };
      }
    }
  }
  throw new Error("La impresora no expone una característica de escritura conocida");
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
  const TAM = 180;
  for (let i = 0; i < datos.length; i += TAM) {
    const tanda = datos.slice(i, i + TAM);
    if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(tanda);
    else await c.writeValueWithResponse(tanda);
    await dormir(20);
  }
}

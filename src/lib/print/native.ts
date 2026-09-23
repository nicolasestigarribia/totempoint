/**
 * Impresión por Bluetooth nativo, dentro de la app Android (Capacitor).
 *
 * A diferencia de Web Bluetooth, el plugin nativo habla Bluetooth Classic
 * (SPP), así que sirve para térmicas genéricas además de las BLE. Empareja por
 * MAC: `connectAndPrint` reconecta en cada impresión, así que la asociación
 * sobrevive a recargas y reinicios sin depender de getDevices() ni de flags.
 *
 * Este módulo solo se usa cuando la app corre nativa (el APK); en Chrome normal
 * se usa el camino Web Bluetooth de `bluetooth.ts`.
 */
import { Capacitor } from "@capacitor/core";
import { BluetoothPrinter } from "@kduma-autoid/capacitor-bluetooth-printer";

export interface DispositivoBt {
  name: string;
  address: string;
  type: string;
}

export function esAppNativa(): boolean {
  return Capacitor.isNativePlatform();
}

/** Dispositivos Bluetooth ya emparejados a nivel sistema. */
export async function listarEmparejados(): Promise<DispositivoBt[]> {
  const { devices } = await BluetoothPrinter.list();
  return devices;
}

/**
 * El plugin escribe `data.getBytes()` (UTF-8). Nuestro ticket es ASCII puro
 * (acentos transliterados en ticket.ts), así que mandar cada byte como carácter
 * lo deja idéntico. No meter bytes >127 en el ticket sin revisar esto.
 */
function bytesAString(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

/** Conecta por MAC e imprime, en una sola operación. */
export async function imprimirNativo(address: string, bytes: Uint8Array): Promise<void> {
  await BluetoothPrinter.connectAndPrint({ address, data: bytesAString(bytes) });
}

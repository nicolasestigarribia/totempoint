/**
 * Escaneo de QR con la cámara, en la app nativa.
 *
 * Usa el escáner de Google (ML Kit): abre su propia pantalla, pide el permiso
 * de cámara y descarga el módulo la primera vez. Si el dispositivo no lo tiene
 * (tablets viejas sin Google Play), tira error y el wizard cae en pegar el link
 * a mano.
 */
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";

/** Devuelve el texto del primer QR leído, o null si se canceló. */
export async function escanearQr(): Promise<string | null> {
  const { barcodes } = await BarcodeScanner.scan();
  return barcodes[0]?.rawValue ?? null;
}

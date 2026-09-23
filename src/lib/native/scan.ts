/**
 * Escaneo de QR con la cámara, en la app nativa.
 *
 * Usa el escáner de Google (ML Kit): abre su propia pantalla, pide el permiso
 * de cámara y descarga el módulo la primera vez. Si el dispositivo no lo tiene
 * (tablets viejas sin Google Play), tira error y el wizard cae en pegar el link
 * a mano.
 */
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";

/**
 * Devuelve el texto del primer QR leído, o null si se canceló.
 *
 * El escáner de Google descarga un módulo de Play Services la primera vez. Si
 * todavía no está, se pide la instalación (baja en segundo plano) y se avisa
 * para reintentar; el segundo intento ya escanea.
 */
export async function escanearQr(): Promise<string | null> {
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (!available) {
    await BarcodeScanner.installGoogleBarcodeScannerModule();
    throw new Error("Descargando el escáner (una sola vez). Esperá unos segundos y reintentá.");
  }
  const { barcodes } = await BarcodeScanner.scan();
  return barcodes[0]?.rawValue ?? null;
}

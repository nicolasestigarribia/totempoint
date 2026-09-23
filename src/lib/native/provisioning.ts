/**
 * A qué tótem está pegada esta tablet (app nativa).
 *
 * Se guarda en Preferences nativo para que sobreviva a recargas y reinicios: la
 * app abre siempre el mismo tótem sin preguntar. Se configura una vez, en el
 * wizard de setup, escaneando el QR que muestra la sección Tótems del panel.
 */
import { Preferences } from "@capacitor/preferences";

const KEY = "totemUrl";

// Debe coincidir con el host de capacitor.config.ts (WebView → prod).
const HOST = "totempoint.up.railway.app";

export interface TotemRef {
  empresa: string;
  local: string;
  totem: number;
  url: string;
}

export async function getTotemUrl(): Promise<string | null> {
  const { value } = await Preferences.get({ key: KEY });
  return value ?? null;
}

export async function setTotemUrl(url: string): Promise<void> {
  await Preferences.set({ key: KEY, value: url });
}

export async function clearTotemUrl(): Promise<void> {
  await Preferences.remove({ key: KEY });
}

/**
 * Valida y parsea un enlace de tótem `/t/{empresa}/{local}/{totem}`. Rechaza
 * cualquier cosa que no sea del dominio del sistema, para que un QR cualquiera
 * no deje la tablet apuntando a otro lado.
 */
export function parseTotemUrl(raw: string): TotemRef | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.host !== HOST) return null;
  const m = u.pathname.match(/^\/t\/([a-z0-9-]{1,60})\/([a-z0-9-]{1,60})\/(\d+)\/?$/i);
  if (!m) return null;
  return { empresa: m[1], local: m[2], totem: Number(m[3]), url: u.toString() };
}

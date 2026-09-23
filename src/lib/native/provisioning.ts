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
 * Valida y parsea un enlace de tótem `/t/{empresa}/{local}/{totem}`.
 *
 * No importa el host del enlace escaneado: el QR del panel puede salir con
 * `localhost` (dev) o con el dominio de prod. Lo que define que es un tótem es
 * la forma del path. La URL final se arma siempre contra el host de prod, así
 * que la tablet abre producción aunque el QR viniera de otro lado.
 */
export function parseTotemUrl(raw: string): TotemRef | null {
  const texto = raw.trim();
  // Acepta URL completa o un path suelto /t/e/l/n.
  const path = texto.startsWith("/") ? texto : safePathname(texto);
  if (!path) return null;
  const m = path.match(/^\/t\/([a-z0-9-]{1,60})\/([a-z0-9-]{1,60})\/(\d+)\/?$/i);
  if (!m) return null;
  const empresa = m[1];
  const local = m[2];
  const totem = Number(m[3]);
  const url = `https://${HOST}/t/${empresa}/${local}/${totem}?totem=1`;
  return { empresa, local, totem, url };
}

function safePathname(raw: string): string | null {
  try {
    return new URL(raw).pathname;
  } catch {
    return null;
  }
}

import type { CapacitorConfig } from "@capacitor/cli";

/**
 * App nativa (Android) que envuelve el tótem web.
 *
 * `server.url` apunta a la web de producción: el WebView carga Railway, así que
 * los deploys web siguen independientes del APK. `allowNavigation` habilita que
 * el bridge nativo (impresión Bluetooth) funcione en ese dominio remoto.
 */
const PROD_URL = "https://totempoint.up.railway.app";

const config: CapacitorConfig = {
  appId: "com.totempoint.app",
  appName: "Totempoint",
  webDir: "www",
  server: {
    url: PROD_URL,
    cleartext: false,
    allowNavigation: [new URL(PROD_URL).host],
  },
  android: {
    // El tótem es a pantalla completa; la barra de estado se maneja desde la web.
    backgroundColor: "#000000",
  },
};

export default config;

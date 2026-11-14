// Service worker mínimo de la comandera: solo existe para que Chrome la
// reconozca como app instalable (con ícono en la tablet). Instalada, Chrome la
// deja sonar sin pedir un toque cada vez que se abre. No guarda nada en caché:
// los pedidos siempre se piden al servidor.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

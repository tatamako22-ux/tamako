// Cambiamos la versión de la caché para forzar la actualización en los celulares
const CACHE_NAME = "tamaku-v29-pwa-logo";

const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/assets/images/tamaku-icon-192.png",
  "/assets/images/tamaku-icon-512.png",
];

// Pantallas estaticas: se guardan al visitarlas, no todas en la primera visita.
const paginasVisitadas = new Set([
  "/", "/index.html",
  "/pages/agenda.html",
  "/pages/clientes.html",
  "/pages/comunicados.html",
  "/pages/dashboard.html",
  "/pages/profesionales.html",
  "/pages/facturacion.html",
  "/pages/liquidaciones.html",
  "/pages/usuarios.html",
  "/pages/ajustes.html",
  "/pages/tienda.html",
  "/pages/suscripcion.html",
  "/pages/servicios.html",
  "/pages/registro.html",
  "/pages/reserva.html",
]);

// INSTALACIÓN
self.addEventListener("install", (event) => {
  self.skipWaiting(); // fuerza activación inmediata

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)),
  );
});

// ACTIVACIÓN
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache.startsWith("tamaku-") && cache !== CACHE_NAME) {
            return caches.delete(cache); // elimina versiones viejas
          }
        }),
      );
    }),
  );

  self.clients.claim(); // toma control inmediato
});

// FETCH
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Las respuestas de API, autenticacion y URLs parametrizadas no se almacenan.
  if (url.search || (!paginasVisitadas.has(url.pathname) && !urlsToCache.includes(url.pathname))) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && !response.redirected) {
          const copia = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia)).catch(() => {}));
        }
        return response;
      })
      .catch(async () => (await caches.match(event.request)) || Response.error()),
  );
});

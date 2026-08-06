// Cambiamos la versión de la caché para forzar la actualización en los celulares
const CACHE_NAME = "tamaku-v6-marketplace";

const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/assets/images/icon-192.png",
  "/assets/images/icon-512.png",
  "/pages/agenda.html",
  "/pages/clientes.html",
  "/pages/dashboard.html",
  "/pages/profesionales.html",
  "/pages/facturacion.html",
  "/pages/usuarios.html",
  "/pages/ajustes.html",
  "/pages/tienda.html",
  "/pages/servicios.html",
  "/pages/registro.html",
  "/pages/reserva.html",
];

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
          if (cache !== CACHE_NAME) {
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
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});

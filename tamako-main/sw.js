const CACHE_NAME = "tamako-v2";

// Archivos a cachear
const urlsToCache = [
  "/",
  "/index.html",
  "/agenda.html",
  "/clientes.html",
  "/dashboard.html",
  "/barberos.html",
  "/ajustes.html",
  "/servicios.html",
  "/registro.html"
];

// INSTALACIÓN
self.addEventListener("install", event => {
  self.skipWaiting(); // fuerza activación inmediata

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// ACTIVACIÓN
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // elimina versiones viejas
          }
        })
      );
    })
  );

  self.clients.claim(); // toma control inmediato
});

// FETCH
self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
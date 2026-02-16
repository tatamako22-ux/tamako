const CACHE_NAME = "tamako-v1";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        "/",
        "/index.html",
        "/agenda.html",
        "/clientes.html",
        "/dashboard.html",
        "/barberos.html",
        "/ajustes.html",
        "/servicios.html",
        "/registro.html"
      ]);
    })
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

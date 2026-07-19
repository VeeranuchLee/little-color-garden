const CACHE_NAME = "little-color-garden-v3";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./assets/pages/solar-system.png",
  "./assets/pages/space-kid.png",
  "./assets/pages/moon-flag.png",
  "./assets/pages/mars-rover.png",
  "./assets/pages/pink-princess.png",
  "./assets/pages/magic-princess.png",
  "./assets/pages/mermaid-princess.png",
  "./assets/pages/bird-princess.png",
  "./assets/pages/hibiscus.png",
  "./assets/pages/ginger-lily.png",
  "./assets/pages/blue-pea.png",
  "./assets/pages/ylang-ylang.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});

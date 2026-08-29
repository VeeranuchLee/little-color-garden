const CACHE_NAME = "little-color-garden-v15";
const PAGE_IDS = [
  "solar-system",
  "space-kid",
  "moon-flag",
  "mars-rover",
  "pink-princess",
  "magic-princess",
  "mermaid-princess",
  "bird-princess",
  "hibiscus",
  "ginger-lily",
  "blue-pea",
  "ylang-ylang"
];
const BACKGROUNDS = [
  "space-soft.jpg",
  "moon.jpg",
  "saturn.jpg",
  "rainbow-castle.jpg",
  "forest-friends.jpg",
  "spring-meadow.jpg"
];
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./pixel-cards.js",
  "./pixel-mode.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  ...PAGE_IDS.map((id) => `./assets/pages/${id}.png`),
  ...PAGE_IDS.map((id) => `./assets/references/${id}.jpg`),
  ...BACKGROUNDS.map((file) => `./assets/backgrounds/${file}`)
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    /* Evict only this app's old versions (little-color-garden-v*). Several repo
       apps share one origin when published, each with its own worker — deleting
       every cache that is not ours would evict the neighbours' offline caches.
       Foreign cache names are not ours to touch. */
    caches.keys().then((keys) => Promise.all(keys.filter((key) => /^little-color-garden-v/.test(key) && key !== CACHE_NAME).map((key) => caches.delete(key))))
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

const CACHE_NAME = "little-color-garden-v18";
const PAGE_IDS = [
  "solar-system",
  "space-kid",
  "moon-flag",
  "mars-rover",
  "star-astronaut",
  "space-ufo",
  "space-cat",
  "pink-princess",
  "magic-princess",
  "mermaid-princess",
  "mermaid-dolphin",
  "mermaid-flower",
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
  "./blank-page.js",
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
  const request = event.request;
  if (request.method !== "GET") return;

  /* v16 ships this app's first media file (the gallery music bed), and a media
     element asks for it with `Range: bytes=0-`. The server answers 206, and
     `cache.put` REJECTS a partial response -- unhandled, inside the worker, every
     time the bed plays. The pattern below is the one writing-book/service-worker.js
     proves against a Range-honouring server; it is copied deliberately rather than
     invented. It does NOT make the bed available offline: nothing here can cache a
     206, so the bed needs the network. Do not claim otherwise.

     Guard 1 -- anything ranged goes straight to the browser. */
  if (request.headers.has("range")) return;

  /* Guard 2 -- the audio by path, because a no-cors media request does not expose
     its Range header in every engine. */
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/assets/audio/") !== -1) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      /* 200 exactly, not response.ok: ok is every 2xx, and 206 is the one that
         breaks cache.put. This also stops an error page being cached, which would
         pin the failure until the next version bump. */
      if (response && response.status === 200 && response.type === "basic") {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});

const CACHE_NAME = "little-color-garden-v23";
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

/* The 133 rendered voice lines. Listed one per line from voice/lines.json so a
   reviewer can see the set; tools/check-voice-lines.py is what keeps the manifest,
   app.js's registry and this list honest. Added with cache.add PER FILE rather than
   extended into APP_FILES: addAll is all-or-nothing, so one 404 would leave the app
   with no offline cache at all. A clip that fails to cache is a line not heard
   offline, which is the same outcome as a clip that fails to play -- silence, never
   the device voice. */
const VOICE_FILES = [
  "./assets/audio/voice/app.already-clean.m4a",
  "./assets/audio/voice/app.clear-arm.m4a",
  "./assets/audio/voice/app.clear-done.m4a",
  "./assets/audio/voice/app.directions-mosaic.m4a",
  "./assets/audio/voice/app.directions-page.m4a",
  "./assets/audio/voice/app.finish-praise.m4a",
  "./assets/audio/voice/app.load-error.m4a",
  "./assets/audio/voice/app.mode-menu.m4a",
  "./assets/audio/voice/app.mode-menu-repeat.m4a",
  "./assets/audio/voice/app.pick-picture.m4a",
  "./assets/audio/voice/app.reference-on.m4a",
  "./assets/audio/voice/app.undo-restore.m4a",
  "./assets/audio/voice/blank.already-clean.m4a",
  "./assets/audio/voice/blank.clear-arm.m4a",
  "./assets/audio/voice/blank.clear-done.m4a",
  "./assets/audio/voice/blank.directions.m4a",
  "./assets/audio/voice/blank.open.m4a",
  "./assets/audio/voice/mosaic.directions.m4a",
  "./assets/audio/voice/mosaic.gallery.m4a",
  "./assets/audio/voice/page.abstract-bands.m4a",
  "./assets/audio/voice/page.abstract-centerstone.m4a",
  "./assets/audio/voice/page.abstract-crazy-paving.m4a",
  "./assets/audio/voice/page.abstract-pebbles.m4a",
  "./assets/audio/voice/page.abstract-rings.m4a",
  "./assets/audio/voice/page.abstract-shards.m4a",
  "./assets/audio/voice/page.space-planet.m4a",
  "./assets/audio/voice/page.space-rocket.m4a",
  "./assets/audio/voice/page.space-astronaut.m4a",
  "./assets/audio/voice/page.princess-crown.m4a",
  "./assets/audio/voice/page.princess-mermaid.m4a",
  "./assets/audio/voice/page.princess-seashells.m4a",
  "./assets/audio/voice/page.sweet-ice-cream.m4a",
  "./assets/audio/voice/page.sweet-cake.m4a",
  "./assets/audio/voice/page.sweet-cupcake.m4a",
  "./assets/audio/voice/page.abstract-fine-100.m4a",
  "./assets/audio/voice/page.abstract-fine-130.m4a",
  "./assets/audio/voice/page.abstract-fine-160.m4a",
  "./assets/audio/voice/page.abstract-fine-180.m4a",
  "./assets/audio/voice/page.abstract-fine-200.m4a",
  "./assets/audio/voice/page.bird-princess.m4a",
  "./assets/audio/voice/page.blue-pea.m4a",
  "./assets/audio/voice/page.ginger-lily.m4a",
  "./assets/audio/voice/page.happy-rocket.m4a",
  "./assets/audio/voice/page.hibiscus.m4a",
  "./assets/audio/voice/page.magic-princess.m4a",
  "./assets/audio/voice/page.mars-rover.m4a",
  "./assets/audio/voice/page.mermaid-dolphin.m4a",
  "./assets/audio/voice/page.mermaid-flower.m4a",
  "./assets/audio/voice/page.mermaid-princess.m4a",
  "./assets/audio/voice/page.moon-flag.m4a",
  "./assets/audio/voice/page.pink-princess.m4a",
  "./assets/audio/voice/page.sea-turtle.m4a",
  "./assets/audio/voice/page.smiling-sunflower.m4a",
  "./assets/audio/voice/page.solar-system.m4a",
  "./assets/audio/voice/page.space-cat.m4a",
  "./assets/audio/voice/page.space-kid.m4a",
  "./assets/audio/voice/page.space-ufo.m4a",
  "./assets/audio/voice/page.star-astronaut.m4a",
  "./assets/audio/voice/page.ylang-ylang.m4a",
  "./assets/audio/voice/pixel.already-clean.m4a",
  "./assets/audio/voice/pixel.clear-arm.m4a",
  "./assets/audio/voice/pixel.clear-done.m4a",
  "./assets/audio/voice/pixel.color.black.m4a",
  "./assets/audio/voice/pixel.color.blue.m4a",
  "./assets/audio/voice/pixel.color.brown.m4a",
  "./assets/audio/voice/pixel.color.dark-blue.m4a",
  "./assets/audio/voice/pixel.color.dark-brown.m4a",
  "./assets/audio/voice/pixel.color.dark-green.m4a",
  "./assets/audio/voice/pixel.color.dark-lime.m4a",
  "./assets/audio/voice/pixel.color.dark-orange.m4a",
  "./assets/audio/voice/pixel.color.dark-peach.m4a",
  "./assets/audio/voice/pixel.color.dark-pink.m4a",
  "./assets/audio/voice/pixel.color.dark-purple.m4a",
  "./assets/audio/voice/pixel.color.dark-red.m4a",
  "./assets/audio/voice/pixel.color.dark-teal.m4a",
  "./assets/audio/voice/pixel.color.gold.m4a",
  "./assets/audio/voice/pixel.color.green.m4a",
  "./assets/audio/voice/pixel.color.grey.m4a",
  "./assets/audio/voice/pixel.color.light-blue.m4a",
  "./assets/audio/voice/pixel.color.light-green.m4a",
  "./assets/audio/voice/pixel.color.light-grey.m4a",
  "./assets/audio/voice/pixel.color.light-lime.m4a",
  "./assets/audio/voice/pixel.color.light-orange.m4a",
  "./assets/audio/voice/pixel.color.light-peach.m4a",
  "./assets/audio/voice/pixel.color.light-pink.m4a",
  "./assets/audio/voice/pixel.color.light-purple.m4a",
  "./assets/audio/voice/pixel.color.light-red.m4a",
  "./assets/audio/voice/pixel.color.light-teal.m4a",
  "./assets/audio/voice/pixel.color.light-yellow.m4a",
  "./assets/audio/voice/pixel.color.lime.m4a",
  "./assets/audio/voice/pixel.color.orange.m4a",
  "./assets/audio/voice/pixel.color.peach.m4a",
  "./assets/audio/voice/pixel.color.pink.m4a",
  "./assets/audio/voice/pixel.color.purple.m4a",
  "./assets/audio/voice/pixel.color.red.m4a",
  "./assets/audio/voice/pixel.color.turquoise.m4a",
  "./assets/audio/voice/pixel.color.white.m4a",
  "./assets/audio/voice/pixel.color.yellow.m4a",
  "./assets/audio/voice/pixel.eraser.m4a",
  "./assets/audio/voice/pixel.finish-praise.m4a",
  "./assets/audio/voice/pixel.free-board.m4a",
  "./assets/audio/voice/pixel.free-board-directions.m4a",
  "./assets/audio/voice/pixel.gallery-directions.m4a",
  "./assets/audio/voice/pixel.keep-going.m4a",
  "./assets/audio/voice/pixel.level.easy.m4a",
  "./assets/audio/voice/pixel.level.hard.m4a",
  "./assets/audio/voice/pixel.level.medium.m4a",
  "./assets/audio/voice/pixel.matched.apple.m4a",
  "./assets/audio/voice/pixel.matched.car.m4a",
  "./assets/audio/voice/pixel.matched.cat.m4a",
  "./assets/audio/voice/pixel.matched.daisy.m4a",
  "./assets/audio/voice/pixel.matched.fish.m4a",
  "./assets/audio/voice/pixel.matched.heart.m4a",
  "./assets/audio/voice/pixel.matched.rainbow.m4a",
  "./assets/audio/voice/pixel.matched.rocket.m4a",
  "./assets/audio/voice/pixel.matched.smile.m4a",
  "./assets/audio/voice/pixel.matched.strawberry.m4a",
  "./assets/audio/voice/pixel.matched.watermelon.m4a",
  "./assets/audio/voice/pixel.mode-menu.m4a",
  "./assets/audio/voice/pixel.pick-card.m4a",
  "./assets/audio/voice/pixel.prompt.apple.easy.m4a",
  "./assets/audio/voice/pixel.prompt.apple.hard.m4a",
  "./assets/audio/voice/pixel.prompt.apple.medium.m4a",
  "./assets/audio/voice/pixel.prompt.car.easy.m4a",
  "./assets/audio/voice/pixel.prompt.car.hard.m4a",
  "./assets/audio/voice/pixel.prompt.car.medium.m4a",
  "./assets/audio/voice/pixel.prompt.cat.easy.m4a",
  "./assets/audio/voice/pixel.prompt.cat.hard.m4a",
  "./assets/audio/voice/pixel.prompt.cat.medium.m4a",
  "./assets/audio/voice/pixel.prompt.daisy.easy.m4a",
  "./assets/audio/voice/pixel.prompt.daisy.hard.m4a",
  "./assets/audio/voice/pixel.prompt.daisy.medium.m4a",
  "./assets/audio/voice/pixel.prompt.fish.easy.m4a",
  "./assets/audio/voice/pixel.prompt.fish.hard.m4a",
  "./assets/audio/voice/pixel.prompt.fish.medium.m4a",
  "./assets/audio/voice/pixel.prompt.heart.easy.m4a",
  "./assets/audio/voice/pixel.prompt.heart.hard.m4a",
  "./assets/audio/voice/pixel.prompt.heart.medium.m4a",
  "./assets/audio/voice/pixel.prompt.rainbow.easy.m4a",
  "./assets/audio/voice/pixel.prompt.rainbow.hard.m4a",
  "./assets/audio/voice/pixel.prompt.rainbow.medium.m4a",
  "./assets/audio/voice/pixel.prompt.rocket.easy.m4a",
  "./assets/audio/voice/pixel.prompt.rocket.hard.m4a",
  "./assets/audio/voice/pixel.prompt.rocket.medium.m4a",
  "./assets/audio/voice/pixel.prompt.smile.easy.m4a",
  "./assets/audio/voice/pixel.prompt.smile.hard.m4a",
  "./assets/audio/voice/pixel.prompt.smile.medium.m4a",
  "./assets/audio/voice/pixel.prompt.strawberry.easy.m4a",
  "./assets/audio/voice/pixel.prompt.strawberry.hard.m4a",
  "./assets/audio/voice/pixel.prompt.strawberry.medium.m4a",
  "./assets/audio/voice/pixel.prompt.watermelon.easy.m4a",
  "./assets/audio/voice/pixel.prompt.watermelon.hard.m4a",
  "./assets/audio/voice/pixel.prompt.watermelon.medium.m4a",
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
  event.waitUntil(caches.open(CACHE_NAME).then((cache) =>
    cache.addAll(APP_FILES).then(() =>
      Promise.all(VOICE_FILES.map((url) => cache.add(url).catch(() => undefined))))));
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
  /* ...EXCEPT the rendered voice lines. This bypass is why precaching them alone
     would buy nothing: a bypassed request never reaches the cache, so the clips
     would sit in storage and never be served. The bed keeps bypassing -- it is a
     looped media element that fetches with Range, and a 206 throws on cache.put.
     The voice clips are short one-shot Audio srcs: precache fetches send no Range
     header, so they arrive as clean 200s. */
  if (url.pathname.indexOf("/assets/audio/") !== -1
      && url.pathname.indexOf("/assets/audio/voice/") === -1) return;

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

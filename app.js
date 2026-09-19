"use strict";

const PAGES = [
  { id: "solar-system", file: "solar-system.png", voice: "the happy planets", card: "#fff3a8", background: "space-soft.jpg" },
  { id: "space-kid", file: "space-kid.png", voice: "the little astronaut", card: "#c4efff", background: "saturn.jpg" },
  { id: "moon-flag", file: "moon-flag.png", voice: "the moon explorer", card: "#d5ccff", background: "moon.jpg" },
  { id: "mars-rover", file: "mars-rover.png", voice: "the friendly space robot", card: "#ffd0ae", background: "moon.jpg" },
  { id: "star-astronaut", file: "star-astronaut.png", voice: "the star astronaut", card: "#cfe9ff", background: "saturn.jpg" },
  { id: "space-ufo", file: "space-ufo.png", voice: "the friendly spaceship", card: "#d9f7d2", background: "space-soft.jpg" },
  { id: "space-cat", file: "space-cat.png", voice: "the space cat", card: "#ffe0d0", background: "moon.jpg" },
  { id: "pink-princess", file: "pink-princess.png", voice: "the heart princess", card: "#ffd5eb", background: "rainbow-castle.jpg" },
  { id: "magic-princess", file: "magic-princess.png", voice: "the magic princess", card: "#eee0ff", background: "rainbow-castle.jpg" },
  { id: "mermaid-princess", file: "mermaid-princess.png", voice: "the ocean princess", card: "#c7f4ef", background: "rainbow-castle.jpg" },
  { id: "mermaid-dolphin", file: "mermaid-dolphin.png", voice: "the mermaid and the dolphin", card: "#c9f0f7", background: "rainbow-castle.jpg" },
  { id: "mermaid-flower", file: "mermaid-flower.png", voice: "the mermaid with a flower", card: "#ffe2f0", background: "rainbow-castle.jpg" },
  { id: "bird-princess", file: "bird-princess.png", voice: "the bird princess", card: "#ffe6ca", background: "forest-friends.jpg" },
  { id: "hibiscus", file: "hibiscus.png", voice: "the hibiscus flowers", card: "#ffd1d0", background: "spring-meadow.jpg" },
  { id: "ginger-lily", file: "ginger-lily.png", voice: "the white flowers", card: "#ecf7c8", background: "spring-meadow.jpg" },
  { id: "blue-pea", file: "blue-pea.png", voice: "the blue pea flowers", card: "#d4ddff", background: "spring-meadow.jpg" },
  { id: "ylang-ylang", file: "ylang-ylang.png", voice: "the yellow flowers", card: "#fff4b9", background: "spring-meadow.jpg" }
];

// The Coloring palette: 48 colours, 12 hue families across × 4 shades down
// (owner brief, 2026-09-14: "use a richer palette of 48 colors", "organized
// and child-friendly"). The tray is one grid in both orientations -- 12
// columns × 4 rows, light over bright over classic over dark -- so it reads
// exactly like the pixel tray one screen away. The classic row keeps the
// app's original ten colours unchanged; the rows around them lean pastel,
// which is what this UI looks like. Colouring pages also need skin, wood and
// paper tones, so peach and brown are families of their own and the last
// column is the white→grey→black ramp a page of line art cannot do without.
const COLOR_FAMILIES = [
  { hue: "red",    shades: [{ name: "light red", value: "#ffd3cc" }, { name: "bright red", value: "#ff9184" }, { name: "red", value: "#f04455" }, { name: "dark red", value: "#a8203e" }] },
  { hue: "orange", shades: [{ name: "light orange", value: "#ffe3c2" }, { name: "bright orange", value: "#ffb877" }, { name: "orange", value: "#ff8a35" }, { name: "dark orange", value: "#d15f11" }] },
  { hue: "peach",  shades: [{ name: "light peach", value: "#ffeade" }, { name: "soft peach", value: "#ffd3b3" }, { name: "peach", value: "#f0a878" }, { name: "dark peach", value: "#cf7f4e" }] },
  { hue: "yellow", shades: [{ name: "light yellow", value: "#fff8c9" }, { name: "bright yellow", value: "#ffef9e" }, { name: "yellow", value: "#ffd93d" }, { name: "gold", value: "#eab215" }] },
  { hue: "lime",   shades: [{ name: "light lime", value: "#edf9b8" }, { name: "bright lime", value: "#d4f28a" }, { name: "lime", value: "#b0e04f" }, { name: "dark lime", value: "#84b62d" }] },
  { hue: "green",  shades: [{ name: "light green", value: "#cff3d3" }, { name: "bright green", value: "#96e19d" }, { name: "green", value: "#51c86b" }, { name: "dark green", value: "#239a4d" }] },
  { hue: "teal",   shades: [{ name: "light teal", value: "#ccf4ee" }, { name: "bright teal", value: "#93e6da" }, { name: "turquoise", value: "#31c8c6" }, { name: "dark teal", value: "#0f9b93" }] },
  { hue: "blue",   shades: [{ name: "light blue", value: "#cfe3ff" }, { name: "bright blue", value: "#97bdff" }, { name: "blue", value: "#3c83ef" }, { name: "dark blue", value: "#1f4fc4" }] },
  { hue: "purple", shades: [{ name: "light purple", value: "#e7dbff" }, { name: "bright purple", value: "#c1a8f7" }, { name: "purple", value: "#8257df" }, { name: "dark purple", value: "#5930a8" }] },
  { hue: "pink",   shades: [{ name: "light pink", value: "#ffdcec" }, { name: "bright pink", value: "#ffa9d2" }, { name: "pink", value: "#f46eb3" }, { name: "dark pink", value: "#d63d92" }] },
  { hue: "brown",  shades: [{ name: "light brown", value: "#efe0cf" }, { name: "soft brown", value: "#d9b48f" }, { name: "brown", value: "#9b623c" }, { name: "dark brown", value: "#5c3a24" }] },
  { hue: "grey",   shades: [{ name: "white", value: "#ffffff" }, { name: "light grey", value: "#d9dce4" }, { name: "grey", value: "#9a9aa5" }, { name: "black", value: "#30313b" }] }
];

// Flattened shade-band by shade-band (all lights, then all brights...), which
// is the row order the 12-column tray draws: every row is one rainbow.
const COLORS = [];
for (let shade = 0; shade < 4; shade += 1) {
  COLOR_FAMILIES.forEach((family) => COLORS.push(family.shades[shade]));
}

// Both colouring surfaces open on classic red, the middle of its family and
// the colour the app has always started on.
const DEFAULT_COLOR = COLORS.find((color) => color.name === "red") || COLORS[0];

const galleryScreen = document.querySelector("#galleryScreen");
const modeMenuScreen = document.querySelector("#modeMenuScreen");
const coloringScreen = document.querySelector("#coloringScreen");
const pageGallery = document.querySelector("#pageGallery");
const colorPalette = document.querySelector("#colorPalette");
const paintCanvas = document.querySelector("#paintCanvas");
const visibleContext = paintCanvas.getContext("2d", { alpha: false });
const canvasLoader = document.querySelector("#canvasLoader");
const undoButton = document.querySelector("#undoButton");
const clearButton = document.querySelector("#clearButton");
const eraserButton = document.querySelector("#eraserButton");
const peekButton = document.querySelector("#peekButton");
const canvasStage = document.querySelector("#canvasStage");
const referenceImage = document.querySelector("#referenceImage");
// The reference card's landscape home is a second figure down in the studio
// column (portrait draws the stage's own copy beside the paper), so it needs
// its own hooks for the image and the peek state.
const studioReference = document.querySelector("#studioReference");
const studioReferenceImage = document.querySelector("#studioReferenceImage");
const celebration = document.querySelector("#celebration");
const galleryMusicButton = document.querySelector("#galleryMusicButton");
const studioMessage = document.querySelector("#studioMessage");
const gradientStart = document.querySelector("#gradientStart");
const gradientEnd = document.querySelector("#gradientEnd");
const stampSize = document.querySelector("#stampSize");
const stampRotation = document.querySelector("#stampRotation");

const REFERENCE_PREF_KEY = "little-color-garden:show-reference";
const galleryMusic = new Audio("./assets/audio/garden-bed.m4a");
galleryMusic.loop = true;
galleryMusic.volume = 0.26;

const paintLayer = document.createElement("canvas");
const paintContext = paintLayer.getContext("2d");

let activePage = null;
let lineImage = null;
let strokes = [];
let drawing = false;
let activePointerId = null;
let currentStroke = null;
let currentColor = DEFAULT_COLOR.value;
let currentColorName = DEFAULT_COLOR.name;
let currentSize = 26;
let usingEraser = false;
let referenceVisible = false;
let clearArmed = false;
let clearArmTimer = null;
let clearedBackup = null;
let frameRequested = false;
let currentTool = "brush";
let currentStamp = "★";
let linePixels = null;
let lineDrawRect = null;
/* MOSAIC FILL SAFETY (owner report 2026-09-19: "after fill color in, the color is out
   of the area often"). The fill itself never crosses a line -- proven by
   tools/check-mosaic-fill.py over every sheet under this app's own predicate. The
   overflow children actually hit is (a) a tap aimed at an edge cell landing OUTSIDE
   the card border, which used to flood the entire margin ring around the card in one
   shot, cut off straight at the canvas edges; and (b) interstitial white pockets
   (between star points, flame segments) that are technically regions of their own.
   The exterior mask closes (a): everything reachable from the canvas corners without
   crossing a line-pixel is marked and refuses ink. POCKET_MAX closes (b): a region
   at or under it is a pocket, and tapping it paints nothing.
   1815 is measured, not guessed: across all nine sheets the largest pocket is 1,685 px
   (sea-turtle) and the smallest region above it is 1,943 px (also sea-turtle) -- both
   sit ~7% clear of the constant, and tools/check-mosaic-fill.py fails if any region
   ever lands within 5% of it, forcing a re-measure instead of a silent misclassify. */
let exteriorMask = null;
const POCKET_MAX = 1815;

function computeLineDrawRect(image, canvas, mosaic) {
  if (!mosaic) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }
  const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  return {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height
  };
}

function buildExteriorMask() {
  const width = paintLayer.width;
  const height = paintLayer.height;
  const mask = new Uint8Array(width * height);
  const isLine = (index) => {
    const offset = index * 4;
    return linePixels[offset + 3] > 90 && linePixels[offset] + linePixels[offset + 1] + linePixels[offset + 2] < 430;
  };
  const stack = [0, width - 1, width * (height - 1), width * height - 1];
  while (stack.length) {
    const index = stack.pop();
    if (index < 0 || index >= width * height || mask[index] || isLine(index)) continue;
    mask[index] = 1;
    const x = index % width;
    if (x) stack.push(index - 1);
    if (x < width - 1) stack.push(index + 1);
    if (index >= width) stack.push(index - width);
    if (index < width * (height - 1)) stack.push(index + width);
  }
  return mask;
}

function showMessage(message) {
  studioMessage.textContent = message;
  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => { studioMessage.textContent = ""; }, 3200);
}

function updateMusicButton(playing) {
  galleryMusicButton.classList.toggle("music-off", !playing);
  galleryMusicButton.setAttribute("aria-pressed", String(playing));
  galleryMusicButton.setAttribute("aria-label", playing ? "Stop music" : "Play music");
  galleryMusicButton.querySelector("span").textContent = playing ? "♫" : "♪";
}

// Leaving the gallery stops the bed, every way out. `openPage` already did this;
// Pixel Mosaic is the other door and it lives in its own file, so the stop is
// exposed the way this app exposes `speak` and `tinyPop` — a top-level function
// on `window` that the other script picks up if it is there.
function stopGalleryMusic() {
  galleryMusic.pause();
  updateMusicButton(false);
}

async function toggleGalleryMusic() {
  if (!galleryMusic.paused) {
    galleryMusic.pause();
    updateMusicButton(false);
    return;
  }
  try {
    await galleryMusic.play();
    updateMusicButton(true);
  } catch (_) {
    updateMusicButton(false);
  }
}

// Every line this app can ever speak, keyed by the id its rendered clip is
// named by (assets/audio/voice/<id>.m4a). voice/lines.json is the canonical
// manifest -- the renderer's input, and
// what the render is costed from -- and this registry is its in-app copy;
// tools/check-voice-lines.py fails the commit if the two ever differ. No line
// is built at runtime any more: a call site names an id, speak() resolves it,
// and the manifest is the only place text lives. The object is strict JSON on
// purpose so the checker can parse it straight out of this source.
const VOICE_LINES = {
  "app.already-clean": "The picture is already clean.",
  "app.clear-arm": "Tap the broom again to clean the whole picture.",
  "app.clear-done": "All clean! Tap the yellow arrow if you want it back.",
  "app.directions-mosaic": "Pick a color, then tap a shape to fill it.",
  "app.directions-page": "Pick a color, then draw with your finger. Tap the little picture button to see the finished picture next to yours.",
  "app.finish-praise": "Wow! Your picture is beautiful!",
  "app.load-error": "Oops. This picture needs a little help loading.",
  "app.mode-menu": "Pixel, Coloring, or Mosaic? Pick one!",
  "app.mode-menu-repeat": "Pixel, Coloring, or Mosaic? Pick one to play.",
  "app.pick-picture": "Pick a picture to color.",
  "app.reference-on": "Here is one way it can look. You can color it your own way!",
  "app.undo-restore": "Here it is again!",
  "blank.already-clean": "The page is already clean.",
  "blank.clear-arm": "Tap the broom again to clean the whole page.",
  "blank.clear-done": "All clean! Draw anything you like.",
  "blank.directions": "This is your own page. Pick a color, then draw anything you like!",
  "blank.open": "A blank page! Pick a color, then draw anything you like.",
  "mosaic.directions": "Pick a mosaic picture to color. Tap one to start filling its shapes.",
  "mosaic.gallery": "Pick a mosaic picture to color.",
  "page.abstract-bands": "Let's color the rainbow bands! Pick a color, then tap a shape to fill it.",
  "page.abstract-centerstone": "Let's color the magic gem! Pick a color, then tap a shape to fill it.",
  "page.abstract-crazy-paving": "Let's color the puzzle stones! Pick a color, then tap a shape to fill it.",
  "page.abstract-pebbles": "Let's color the pebbles! Pick a color, then tap a shape to fill it.",
  "page.abstract-rings": "Let's color the rainbow rings! Pick a color, then tap a shape to fill it.",
  "page.abstract-shards": "Let's color the crystal pieces! Pick a color, then tap a shape to fill it.",
  "page.space-planet": "Let's color the planet! Pick a color, then tap a shape to fill it.",
  "page.space-rocket": "Let's color the rocket! Pick a color, then tap a shape to fill it.",
  "page.space-astronaut": "Let's color the astronaut! Pick a color, then tap a shape to fill it.",
  "page.princess-crown": "Let's color the princess crown! Pick a color, then tap a shape to fill it.",
  "page.princess-mermaid": "Let's color the mermaid! Pick a color, then tap a shape to fill it.",
  "page.princess-seashells": "Let's color the seashells! Pick a color, then tap a shape to fill it.",
  "page.sweet-ice-cream": "Let's color the ice cream! Pick a color, then tap a shape to fill it.",
  "page.sweet-cake": "Let's color the cake! Pick a color, then tap a shape to fill it.",
  "page.sweet-cupcake": "Let's color the cupcake! Pick a color, then tap a shape to fill it.",
  "page.abstract-fine-100": "Let's color Little Pieces! Pick a color, then tap a shape to fill it.",
  "page.abstract-fine-130": "Let's color More Pieces! Pick a color, then tap a shape to fill it.",
  "page.abstract-fine-160": "Let's color Tiny Pieces! Pick a color, then tap a shape to fill it.",
  "page.abstract-fine-180": "Let's color Super Tiny Pieces! Pick a color, then tap a shape to fill it.",
  "page.abstract-fine-200": "Let's color Mosaic Challenge! Pick a color, then tap a shape to fill it.",
  "page.bird-princess": "Let's color the bird princess! Pick a color, then draw with your finger.",
  "page.blue-pea": "Let's color the blue pea flowers! Pick a color, then draw with your finger.",
  "page.ginger-lily": "Let's color the white flowers! Pick a color, then draw with your finger.",
  "page.happy-rocket": "Let's color the happy rocket! Pick a color, then tap a shape to fill it.",
  "page.hibiscus": "Let's color the hibiscus flowers! Pick a color, then draw with your finger.",
  "page.magic-princess": "Let's color the magic princess! Pick a color, then draw with your finger.",
  "page.mars-rover": "Let's color the friendly space robot! Pick a color, then draw with your finger.",
  "page.mermaid-dolphin": "Let's color the mermaid and the dolphin! Pick a color, then draw with your finger.",
  "page.mermaid-flower": "Let's color the mermaid with a flower! Pick a color, then draw with your finger.",
  "page.mermaid-princess": "Let's color the ocean princess! Pick a color, then draw with your finger.",
  "page.moon-flag": "Let's color the moon explorer! Pick a color, then draw with your finger.",
  "page.pink-princess": "Let's color the heart princess! Pick a color, then draw with your finger.",
  "page.sea-turtle": "Let's color the sea turtle! Pick a color, then tap a shape to fill it.",
  "page.smiling-sunflower": "Let's color the smiling sunflower! Pick a color, then tap a shape to fill it.",
  "page.solar-system": "Let's color the happy planets! Pick a color, then draw with your finger.",
  "page.space-cat": "Let's color the space cat! Pick a color, then draw with your finger.",
  "page.space-kid": "Let's color the little astronaut! Pick a color, then draw with your finger.",
  "page.space-ufo": "Let's color the friendly spaceship! Pick a color, then draw with your finger.",
  "page.star-astronaut": "Let's color the star astronaut! Pick a color, then draw with your finger.",
  "page.ylang-ylang": "Let's color the yellow flowers! Pick a color, then draw with your finger.",
  "pixel.already-clean": "The board is already clean.",
  "pixel.clear-arm": "Tap the broom again to clean the whole board.",
  "pixel.clear-done": "All clean!",
  "pixel.color.black": "black",
  "pixel.color.blue": "blue",
  "pixel.color.brown": "brown",
  "pixel.color.dark-blue": "dark blue",
  "pixel.color.dark-brown": "dark brown",
  "pixel.color.dark-green": "dark green",
  "pixel.color.dark-lime": "dark lime",
  "pixel.color.dark-orange": "dark orange",
  "pixel.color.dark-peach": "dark peach",
  "pixel.color.dark-pink": "dark pink",
  "pixel.color.dark-purple": "dark purple",
  "pixel.color.dark-red": "dark red",
  "pixel.color.dark-teal": "dark teal",
  "pixel.color.gold": "gold",
  "pixel.color.green": "green",
  "pixel.color.grey": "grey",
  "pixel.color.light-blue": "light blue",
  "pixel.color.light-green": "light green",
  "pixel.color.light-grey": "light grey",
  "pixel.color.light-lime": "light lime",
  "pixel.color.light-orange": "light orange",
  "pixel.color.light-peach": "light peach",
  "pixel.color.light-pink": "light pink",
  "pixel.color.light-purple": "light purple",
  "pixel.color.light-red": "light red",
  "pixel.color.light-teal": "light teal",
  "pixel.color.light-yellow": "light yellow",
  "pixel.color.lime": "lime",
  "pixel.color.orange": "orange",
  "pixel.color.peach": "peach",
  "pixel.color.pink": "pink",
  "pixel.color.purple": "purple",
  "pixel.color.red": "red",
  "pixel.color.turquoise": "turquoise",
  "pixel.color.white": "white",
  "pixel.color.yellow": "yellow",
  "pixel.eraser": "Eraser",
  "pixel.finish-praise": "Wow! Your mosaic is beautiful!",
  "pixel.free-board": "Make your own picture! Tap a color, then fill the little squares.",
  "pixel.free-board-directions": "Tap a color, then fill the squares. Make anything you like!",
  "pixel.gallery-directions": "Pick how much help you want at the top, then pick a picture to copy!",
  "pixel.keep-going": "Look at the little card and keep going!",
  "pixel.level.easy": "Easy. The shaded squares show the colors, and only they take a tile.",
  "pixel.level.hard": "Hard! No shape. Look at the little card and copy it.",
  "pixel.level.medium": "Medium. The shaded squares show the colors. Every square can take a tile.",
  "pixel.matched.apple": "You made the apple! It matches the card!",
  "pixel.matched.car": "You made the car! It matches the card!",
  "pixel.matched.cat": "You made the cat! It matches the card!",
  "pixel.matched.daisy": "You made the daisy! It matches the card!",
  "pixel.matched.fish": "You made the fish! It matches the card!",
  "pixel.matched.heart": "You made the heart! It matches the card!",
  "pixel.matched.rainbow": "You made the rainbow! It matches the card!",
  "pixel.matched.rocket": "You made the rocket! It matches the card!",
  "pixel.matched.smile": "You made the smile! It matches the card!",
  "pixel.matched.strawberry": "You made the strawberry! It matches the card!",
  "pixel.matched.watermelon": "You made the watermelon! It matches the card!",
  "pixel.mode-menu": "Pixel or Coloring? Pick one!",
  "pixel.pick-card": "Pick a picture to copy.",
  "pixel.prompt.apple.easy": "Copy the apple! The shaded squares show which color goes where. The rest of the board is closed.",
  "pixel.prompt.apple.hard": "Copy the apple! Nothing is shown. Look at the little card and copy it.",
  "pixel.prompt.apple.medium": "Copy the apple! The shaded squares show which color goes where.",
  "pixel.prompt.car.easy": "Copy the car! The shaded squares show which color goes where. The rest of the board is closed.",
  "pixel.prompt.car.hard": "Copy the car! Nothing is shown. Look at the little card and copy it.",
  "pixel.prompt.car.medium": "Copy the car! The shaded squares show which color goes where.",
  "pixel.prompt.cat.easy": "Copy the cat! The shaded squares show which color goes where. The rest of the board is closed.",
  "pixel.prompt.cat.hard": "Copy the cat! Nothing is shown. Look at the little card and copy it.",
  "pixel.prompt.cat.medium": "Copy the cat! The shaded squares show which color goes where.",
  "pixel.prompt.daisy.easy": "Copy the daisy! The shaded squares show which color goes where. The rest of the board is closed.",
  "pixel.prompt.daisy.hard": "Copy the daisy! Nothing is shown. Look at the little card and copy it.",
  "pixel.prompt.daisy.medium": "Copy the daisy! The shaded squares show which color goes where.",
  "pixel.prompt.fish.easy": "Copy the fish! The shaded squares show which color goes where. The rest of the board is closed.",
  "pixel.prompt.fish.hard": "Copy the fish! Nothing is shown. Look at the little card and copy it.",
  "pixel.prompt.fish.medium": "Copy the fish! The shaded squares show which color goes where.",
  "pixel.prompt.heart.easy": "Copy the heart! The shaded squares show which color goes where. The rest of the board is closed.",
  "pixel.prompt.heart.hard": "Copy the heart! Nothing is shown. Look at the little card and copy it.",
  "pixel.prompt.heart.medium": "Copy the heart! The shaded squares show which color goes where.",
  "pixel.prompt.rainbow.easy": "Copy the rainbow! The shaded squares show which color goes where. The rest of the board is closed.",
  "pixel.prompt.rainbow.hard": "Copy the rainbow! Nothing is shown. Look at the little card and copy it.",
  "pixel.prompt.rainbow.medium": "Copy the rainbow! The shaded squares show which color goes where.",
  "pixel.prompt.rocket.easy": "Copy the rocket! The shaded squares show which color goes where. The rest of the board is closed.",
  "pixel.prompt.rocket.hard": "Copy the rocket! Nothing is shown. Look at the little card and copy it.",
  "pixel.prompt.rocket.medium": "Copy the rocket! The shaded squares show which color goes where.",
  "pixel.prompt.smile.easy": "Copy the smile! The shaded squares show which color goes where. The rest of the board is closed.",
  "pixel.prompt.smile.hard": "Copy the smile! Nothing is shown. Look at the little card and copy it.",
  "pixel.prompt.smile.medium": "Copy the smile! The shaded squares show which color goes where.",
  "pixel.prompt.strawberry.easy": "Copy the strawberry! The shaded squares show which color goes where. The rest of the board is closed.",
  "pixel.prompt.strawberry.hard": "Copy the strawberry! Nothing is shown. Look at the little card and copy it.",
  "pixel.prompt.strawberry.medium": "Copy the strawberry! The shaded squares show which color goes where.",
  "pixel.prompt.watermelon.easy": "Copy the watermelon! The shaded squares show which color goes where. The rest of the board is closed.",
  "pixel.prompt.watermelon.hard": "Copy the watermelon! Nothing is shown. Look at the little card and copy it.",
  "pixel.prompt.watermelon.medium": "Copy the watermelon! The shaded squares show which color goes where."
};

// speak() is a resolver, not a sentence builder: it takes a voice-line id and
// never a string of prose. Every id it can be given names a record in
// voice/lines.json and a rendered clip on disk, assets/audio/voice/<id>.m4a --
// tools/check-voice-lines.py enforces both directions, because a missing
// record would ship silence and an unused one wastes render credits.
//
// The clip is the cast narrator (AUDIO-DIRECTION.md decision 1: every shipped
// spoken line is AI-generated rendered audio; the device's own voice was only
// ever scaffolding and is gone). A clip that cannot load or play is a line
// simply not heard -- no OS-voice fallback, under any name, and the play()
// rejection is swallowed rather than retried.
//
// One Audio element is reused, and pausing it is the whole cancel story: the
// outgoing line stops the moment a new one is asked for, so a child tapping
// quickly hears the newest line, never a queue. The element is created on the
// first speak() and play() is called synchronously inside the tap every call
// site already sits in -- iOS unlocks media only inside a user gesture, and a
// first play deferred behind a timer or a promise chain is the silent-iPad
// bug this repo has shipped in the math app.
let voiceClip = null;

function speak(id) {
  if (VOICE_LINES[id] === undefined) {
    // Unreachable while check-voice-lines.py passes; loud for a dev when not.
    console.warn(`speak(): unknown voice line "${id}"`);
    return;
  }
  try {
    if (!voiceClip) voiceClip = new Audio();
    voiceClip.pause();
    voiceClip.src = `./assets/audio/voice/${id}.m4a`;
    const played = voiceClip.play();
    if (played && played.catch) played.catch(() => {});
  } catch (_) {
    // Sound is a bonus; coloring remains fully usable without audio permission.
  }
}

function tinyPop(frequency = 520, duration = 0.055) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = tinyPop.context || (tinyPop.context = new AudioContextClass());
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.3, audio.currentTime + duration);
    gain.gain.setValueAtTime(0.05, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  } catch (_) {
    // Sound is a bonus; coloring remains fully usable without audio permission.
  }
}

function buildGallery() {
  const fragment = document.createDocumentFragment();
  PAGES.forEach((page, index) => {
    const button = document.createElement("button");
    button.className = "page-card";
    button.type = "button";
    button.setAttribute("aria-label", `Color ${page.voice}`);
    button.style.setProperty("--card-color", page.card);

    const image = document.createElement("img");
    image.src = `./assets/pages/${page.file}`;
    image.alt = "";
    image.draggable = false;
    if (index > 3) image.loading = "lazy";
    button.appendChild(image);
    button.addEventListener("click", () => openPage(page));
    fragment.appendChild(button);
  });
  pageGallery.appendChild(fragment);
}

// Blank Page is the first card of the Coloring gallery (owner brief,
// 2026-09-14). Its art is drawn here rather than shipped: a white page with a
// few soft pastel strokes, so it reads as "a page you draw on yourself" next
// to the printed line-art pages. blank-page.js owns the screen itself; it
// loads after this file, so the card only opens it once it is there.
function buildBlankCard() {
  const button = document.createElement("button");
  button.className = "page-card page-card--blank";
  button.type = "button";
  button.setAttribute("aria-label", "Blank page. Draw your own picture.");
  button.style.setProperty("--card-color", "#ffffff");

  const canvas = document.createElement("canvas");
  canvas.width = 290;
  canvas.height = 362;
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const strokes = [
    { color: "#f9a8c9", from: [58, 92], bend: [104, 64], to: [158, 138] },
    { color: "#7fd4e8", from: [96, 258], bend: [152, 280], to: [226, 306] },
    { color: "#ffd93d", from: [186, 92], bend: [224, 122], to: [212, 168] },
    { color: "#b8a6ef", from: [64, 300], bend: [92, 310], to: [118, 334] }
  ];
  strokes.forEach((stroke) => {
    context.strokeStyle = stroke.color;
    context.lineWidth = 16;
    context.lineCap = "round";
    context.globalAlpha = 0.9;
    context.beginPath();
    context.moveTo(stroke.from[0], stroke.from[1]);
    context.quadraticCurveTo(stroke.bend[0], stroke.bend[1], stroke.to[0], stroke.to[1]);
    context.stroke();
  });
  button.appendChild(canvas);
  button.addEventListener("click", () => {
    if (typeof window.openBlankPage === "function") window.openBlankPage();
  });
  pageGallery.appendChild(button);
}

// One palette builder serves both colouring surfaces (the page screen and
// Blank Page). Selection state is scoped to the container it builds into:
// two palettes live in the document at once, and a tap on one must never
// move the other's ring.
function buildColorPalette(container, onSelect) {
  const initialIndex = COLORS.indexOf(DEFAULT_COLOR);
  const api = {};
  COLORS.forEach((color, index) => {
    const button = document.createElement("button");
    button.className = `color-button${index === initialIndex ? " is-selected" : ""}`;
    button.type = "button";
    button.style.setProperty("--swatch", color.value);
    button.setAttribute("aria-label", color.name);
    button.dataset.color = color.value;
    button.dataset.name = color.name;
    button.addEventListener("click", () => api.select(button));
    container.appendChild(button);
  });
  api.select = (button) => {
    container.querySelectorAll(".color-button").forEach((item) => item.classList.toggle("is-selected", item === button));
    onSelect(button);
  };
  api.clearSelection = () => {
    container.querySelectorAll(".color-button").forEach((item) => item.classList.remove("is-selected"));
  };
  // Bringing a tool back after the eraser must restore the ring the eraser
  // cleared (owner: "selected color must be visually obvious"). Silent, and
  // deliberately not api.select: restoring state is not a tap, so it plays
  // no tone and announces nothing.
  api.markSelected = (value) => {
    container.querySelectorAll(".color-button").forEach((item) => item.classList.toggle("is-selected", item.dataset.color === value));
  };
  return api;
}

// The tap tone rises across the tray's columns and deepens down its rows, the
// same shape of mapping the pixel tray uses, kept inside a child-friendly
// band now that there are 48 positions.
function swatchTone(color) {
  const index = COLORS.findIndex((item) => item.value === color);
  const column = index < 0 ? 0 : index % 12;
  const row = index < 0 ? 0 : Math.floor(index / 12);
  return 440 + column * 26 + row * 55;
}

// Mosaic (card 3 of the hub, CG-093) enters through this same door: its pages
// carry kind "mosaic" and folder "mosaic", and each genuine difference keeps
// one guarded branch below — the art folder, the absent scene background and
// references, the fill-only tool row. A coloring page takes the exact path it
// always did, because every branch defaults to that path.
function openPage(page) {
  stopGalleryMusic();
  const mosaic = page.kind === "mosaic";
  activePage = page;
  galleryScreen.hidden = true;
  coloringScreen.hidden = false;
  canvasLoader.hidden = false;
  coloringScreen.classList.toggle("is-mosaic", mosaic);
  if (page.background) {
    coloringScreen.style.setProperty("--game-bg", `url("./assets/backgrounds/${page.background}")`);
  } else {
    // Mosaic ships no scene background; drop any inline --game-bg a previous
    // coloring page left so the screen's own mosaic gradient applies.
    coloringScreen.style.removeProperty("--game-bg");
  }
  document.body.style.background = page.card;
  disarmClear();
  clearedBackup = null;
  // No finished-picture references exist for the mosaic sheets, so there is
  // nothing to peek at: the button is hidden (styles.css) and the state stays off.
  referenceVisible = mosaic ? false : loadReferencePref();
  applyReferenceState();
  if (!mosaic) {
    referenceImage.src = `./assets/references/${page.id}.jpg`;
    studioReferenceImage.src = referenceImage.src;
  }
  strokes = loadStrokes(page.id);
  lineImage = new Image();
  lineImage.onload = () => {
    if (mosaic) {
      // Mosaic art is ~745x964, wider than the page box's 724x1086, and the
      // paper frame's aspect is what the stage arithmetic was validated on —
      // so the art is letterboxed into the standard page box rather than
      // reshaping the paper. canvasPoint stays exact: the bitmap still fills
      // the canvas element edge to edge.
      paintCanvas.width = 724;
      paintCanvas.height = 1086;
    } else {
      paintCanvas.width = lineImage.naturalWidth;
      paintCanvas.height = lineImage.naturalHeight;
    }
    paintLayer.width = paintCanvas.width;
    paintLayer.height = paintCanvas.height;
    // One page-load transform owns every line-art consumer. For mosaics this is
    // the calibrated, centred letterbox; for regular pages it is the identity
    // rectangle because their canvas already has the art's natural dimensions.
    lineDrawRect = computeLineDrawRect(lineImage, paintCanvas, mosaic);
    const lineCanvas = document.createElement("canvas");
    lineCanvas.width = paintCanvas.width;
    lineCanvas.height = paintCanvas.height;
    const lineContext = lineCanvas.getContext("2d", { willReadFrequently: true });
    lineContext.drawImage(lineImage, lineDrawRect.x, lineDrawRect.y, lineDrawRect.width, lineDrawRect.height);
    linePixels = lineContext.getImageData(0, 0, paintCanvas.width, paintCanvas.height).data;
    /* Mosaic only: a regular coloring page fills its whole canvas and its background
       is fillable by design; the mask exists for the letterboxed mosaic card, whose
       margin ring is where an edge-aimed tap used to flood. Computed once per load,
       from the same predicate the fill uses -- the harness checks the two never drift
       apart in effect. */
    exteriorMask = mosaic ? buildExteriorMask() : null;
    rebuildPaintLayer();
    composeCanvas();
    canvasLoader.hidden = true;
    undoButton.disabled = strokes.length === 0;
    if (mosaic) selectTool("fill");
    // The greeting is the page's own manifest record: a mosaic sheet says
    // "tap a shape", a coloring page says "draw with your finger", and the
    // record for this page id already holds the right one -- resolved in
    // voice/lines.json, never built here.
    speak(`page.${page.id}`);
  };
  lineImage.onerror = () => {
    canvasLoader.hidden = true;
    speak("app.load-error");
  };
  lineImage.src = `./assets/${page.folder || "pages"}/${page.file}`;
}

function goHome() {
  saveStrokes();
  disarmClear();
  clearedBackup = null;
  const mosaic = Boolean(activePage && activePage.kind === "mosaic");
  activePage = null;
  lineImage = null;
  lineDrawRect = null;
  exteriorMask = null;
  strokes = [];
  coloringScreen.hidden = true;
  coloringScreen.classList.remove("is-mosaic");
  // A mosaic page returns to the mosaic gallery; mosaic-mode.js publishes that
  // door the way pixel-mode.js publishes its own, and the coloring gallery is
  // the fallback if it has not loaded.
  if (mosaic && typeof window.showMosaicGallery === "function") {
    window.showMosaicGallery();
    return;
  }
  showColoringGallery();
}

// --- the level above the galleries -------------------------------------
// The mode menu is the app's first screen now (owner brief, 2026-09-14).
// Every screen's back arrow climbs exactly one level, and the hub arrow that
// used to live on the coloring gallery moved up with the menu, unchanged.

function showColoringGallery() {
  modeMenuScreen.hidden = true;
  galleryScreen.hidden = false;
  document.body.style.background = "#8a6bea";
  speak("app.pick-picture");
}

function showModeMenu() {
  // Leaving the gallery stops the bed, every way out -- this is now one of them.
  stopGalleryMusic();
  galleryScreen.hidden = true;
  modeMenuScreen.hidden = false;
  document.body.style.background = "#6f52d6";
  speak("app.mode-menu");
}

function canvasPoint(event) {
  const rect = paintCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (paintCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (paintCanvas.height / rect.height)
  };
}

function beginStroke(event) {
  if (!lineImage || drawing) return;
  if (clearArmed) disarmClear();
  event.preventDefault();
  drawing = true;
  activePointerId = event.pointerId;
  paintCanvas.setPointerCapture(event.pointerId);
  const point = canvasPoint(event);
  if (currentTool === "fill") {
    const action = { type: "fill", color: currentColor, point };
    /* Record only what painted. A tap on the mosaic's exterior or on a pocket fills
       nothing, so it must not live in the undo stack either -- Undo should never
       step through no-ops a child never saw. */
    if (applyAction(action) > 0) strokes.push(action);
    finishInstantAction();
    return;
  }
  if (currentTool === "stamp") {
    const action = { type: "stamp", color: currentColor, point, stamp: currentStamp, size: Number(stampSize.value), rotation: Number(stampRotation.value) };
    strokes.push(action);
    applyAction(action);
    finishInstantAction();
    return;
  }
  currentStroke = {
    type: currentTool,
    color: currentColor,
    size: currentSize,
    erase: usingEraser,
    points: [point]
  };
  if (currentTool === "brush") drawSegment(currentStroke, point, point);
  requestCompose();
}

function continueStroke(event) {
  if (!drawing || event.pointerId !== activePointerId || !currentStroke) return;
  event.preventDefault();
  const point = canvasPoint(event);
  const previous = currentStroke.points[currentStroke.points.length - 1];
  const dx = point.x - previous.x;
  const dy = point.y - previous.y;
  if (dx * dx + dy * dy < 2.5) return;
  currentStroke.points.push(point);
  if (currentTool === "brush") drawSegment(currentStroke, previous, point);
  requestCompose();
}

function endStroke(event) {
  if (!drawing || event.pointerId !== activePointerId || !currentStroke) return;
  event.preventDefault();
  if (currentStroke.type === "gradient") {
    currentStroke.end = currentStroke.points[currentStroke.points.length - 1];
    currentStroke.start = currentStroke.points[0];
    if (currentStroke.start.x === currentStroke.end.x && currentStroke.start.y === currentStroke.end.y) {
      currentStroke.end = { x: currentStroke.start.x + 1, y: currentStroke.start.y };
    }
    currentStroke.color = gradientStart.value;
    currentStroke.endColor = gradientEnd.value;
    currentStroke.points = undefined;
    applyAction(currentStroke);
  }
  strokes.push(currentStroke);
  currentStroke = null;
  drawing = false;
  activePointerId = null;
  clearedBackup = null;
  undoButton.disabled = false;
  saveStrokes();
  requestCompose();
}

function finishInstantAction() {
  drawing = false;
  activePointerId = null;
  currentStroke = null;
  clearedBackup = null;
  undoButton.disabled = false;
  saveStrokes();
  requestCompose();
}

function drawSegment(stroke, from, to) {
  paintContext.save();
  paintContext.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
  paintContext.strokeStyle = stroke.color;
  paintContext.fillStyle = stroke.color;
  paintContext.lineWidth = stroke.size;
  paintContext.lineCap = "round";
  paintContext.lineJoin = "round";
  paintContext.beginPath();
  paintContext.moveTo(from.x, from.y);
  paintContext.lineTo(to.x, to.y);
  paintContext.stroke();
  if (from.x === to.x && from.y === to.y) {
    paintContext.beginPath();
    paintContext.arc(from.x, from.y, stroke.size / 2, 0, Math.PI * 2);
    paintContext.fill();
  }
  paintContext.restore();
}

function rebuildPaintLayer() {
  paintContext.clearRect(0, 0, paintLayer.width, paintLayer.height);
  strokes.forEach(applyAction);
}

function applyAction(stroke) {
    if (stroke.type === "fill") {
      return floodFill(stroke.point, stroke.color);
    }
    if (stroke.type === "gradient") {
      const gradient = paintContext.createLinearGradient(stroke.start.x, stroke.start.y, stroke.end.x, stroke.end.y);
      gradient.addColorStop(0, stroke.color);
      gradient.addColorStop(1, stroke.endColor);
      paintContext.save();
      paintContext.fillStyle = gradient;
      paintContext.fillRect(0, 0, paintLayer.width, paintLayer.height);
      paintContext.restore();
      return;
    }
    if (stroke.type === "stamp") {
      paintContext.save();
      paintContext.translate(stroke.point.x, stroke.point.y);
      paintContext.rotate(stroke.rotation * Math.PI / 180);
      paintContext.fillStyle = stroke.color;
      paintContext.font = `900 ${stroke.size}px Arial, sans-serif`;
      paintContext.textAlign = "center";
      paintContext.textBaseline = "middle";
      paintContext.fillText(stroke.stamp, 0, 0);
      paintContext.restore();
      return;
    }
    if (stroke.points.length === 1) {
      drawSegment(stroke, stroke.points[0], stroke.points[0]);
      return;
    }
    stroke.points.forEach((point, index) => {
      if (index) drawSegment(stroke, stroke.points[index - 1], point);
    });
}

/* Returns how many pixels were painted. Three ways to paint none: nothing loaded, the
   tap landed in the mosaic's non-fillable exterior (mask), or the region is a pocket
   (at or under POCKET_MAX) -- in every case the canvas is left untouched, so the
   caller can leave the tap out of the undo stack. Pixels are only written after the
   whole region is known; nothing is painted to decide it. */
function floodFill(point, color) {
  if (!linePixels) return 0;
  const width = paintLayer.width;
  const height = paintLayer.height;
  const startX = Math.max(0, Math.min(width - 1, Math.round(point.x)));
  const startY = Math.max(0, Math.min(height - 1, Math.round(point.y)));
  const rgba = color.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16));
  const visited = new Uint8Array(width * height);
  const indices = [];
  const stack = [startY * width + startX];
  const isBoundary = (index) => {
    if (exteriorMask && exteriorMask[index]) return true;
    const offset = index * 4;
    return linePixels[offset + 3] > 90 && linePixels[offset] + linePixels[offset + 1] + linePixels[offset + 2] < 430;
  };
  while (stack.length) {
    const index = stack.pop();
    if (index < 0 || index >= visited.length || visited[index] || isBoundary(index)) continue;
    visited[index] = 1;
    indices.push(index);
    const x = index % width;
    if (x) stack.push(index - 1);
    if (x < width - 1) stack.push(index + 1);
    if (index >= width) stack.push(index - width);
    if (index < width * (height - 1)) stack.push(index + width);
  }
  if (!indices.length || indices.length <= POCKET_MAX) return 0;
  const output = paintContext.getImageData(0, 0, width, height);
  for (const index of indices) {
    const offset = index * 4;
    output.data[offset] = rgba[0]; output.data[offset + 1] = rgba[1]; output.data[offset + 2] = rgba[2]; output.data[offset + 3] = 255;
  }
  paintContext.putImageData(output, 0, 0);
  return indices.length;
}

function composeCanvas() {
  if (!lineImage || !lineDrawRect) return;
  visibleContext.save();
  visibleContext.globalCompositeOperation = "source-over";
  visibleContext.fillStyle = "#fff";
  visibleContext.fillRect(0, 0, paintCanvas.width, paintCanvas.height);
  visibleContext.drawImage(paintLayer, 0, 0);
  visibleContext.globalCompositeOperation = "multiply";
  visibleContext.drawImage(lineImage, lineDrawRect.x, lineDrawRect.y, lineDrawRect.width, lineDrawRect.height);
  visibleContext.restore();
}

function requestCompose() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(() => {
    composeCanvas();
    frameRequested = false;
  });
}

function undoLastStroke() {
  if (!strokes.length && clearedBackup && clearedBackup.length) {
    strokes = clearedBackup;
    clearedBackup = null;
    rebuildPaintLayer();
    composeCanvas();
    undoButton.disabled = strokes.length === 0;
    saveStrokes();
    tinyPop(560, 0.09);
    speak("app.undo-restore");
    return;
  }
  if (!strokes.length) return;
  strokes.pop();
  clearedBackup = null;
  rebuildPaintLayer();
  composeCanvas();
  undoButton.disabled = strokes.length === 0;
  saveStrokes();
  tinyPop(300, 0.08);
}

function clearPicture() {
  clearedBackup = strokes.length ? strokes : clearedBackup;
  strokes = [];
  rebuildPaintLayer();
  composeCanvas();
  undoButton.disabled = !(clearedBackup && clearedBackup.length);
  saveStrokes();
  celebrateClearSound();
  speak("app.clear-done");
}

function celebrateClearSound() {
  tinyPop(320, 0.07);
  window.setTimeout(() => tinyPop(240, 0.09), 90);
}

function armClear() {
  clearArmed = true;
  clearButton.classList.add("is-armed");
  if (clearArmTimer) window.clearTimeout(clearArmTimer);
  clearArmTimer = window.setTimeout(disarmClear, 6000);
  tinyPop(360);
  speak("app.clear-arm");
}

function disarmClear() {
  clearArmed = false;
  clearButton.classList.remove("is-armed");
  if (clearArmTimer) {
    window.clearTimeout(clearArmTimer);
    clearArmTimer = null;
  }
}

function handleClearTap() {
  if (!strokes.length) {
    disarmClear();
    speak("app.already-clean");
    return;
  }
  if (clearArmed) {
    disarmClear();
    clearPicture();
  } else {
    armClear();
  }
}

function celebrate() {
  celebration.replaceChildren();
  // The classic row of the 48 (shade band 2 of 4) -- confetti wants the loud
  // versions, not the pastels the palette now opens with.
  const colors = COLORS.filter((_, index) => index % 4 === 2).map((item) => item.value);
  for (let index = 0; index < 72; index += 1) {
    const piece = document.createElement("i");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty("--fall-time", `${1.8 + Math.random() * 1.6}s`);
    piece.style.setProperty("--spin", `${Math.random() * 180}deg`);
    piece.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
    piece.style.animationDelay = `${Math.random() * 0.55}s`;
    celebration.appendChild(piece);
  }
  [523, 659, 784].forEach((frequency, index) => window.setTimeout(() => tinyPop(frequency, 0.18), index * 130));
  speak("app.finish-praise");
  window.setTimeout(() => celebration.replaceChildren(), 3900);
}

function applyReferenceState() {
  canvasStage.classList.toggle("is-split", referenceVisible);
  // is-split splits the portrait stage; the studio card is the same state
  // showing through landscape's copy of the figure.
  studioReference.hidden = !referenceVisible;
  peekButton.classList.toggle("is-on", referenceVisible);
  peekButton.setAttribute("aria-pressed", String(referenceVisible));
}

function setReferenceVisible(visible, announce = false) {
  referenceVisible = visible;
  applyReferenceState();
  try {
    localStorage.setItem(REFERENCE_PREF_KEY, visible ? "1" : "0");
  } catch (_) {
    // Storage may be disabled; the toggle still works for this session.
  }
  if (!announce) return;
  if (visible) {
    tinyPop(620, 0.06);
    speak("app.reference-on");
  } else {
    tinyPop(420, 0.06);
  }
}

function loadReferencePref() {
  try {
    const savedPreference = localStorage.getItem(REFERENCE_PREF_KEY);
    return savedPreference === null ? true : savedPreference === "1";
  } catch (_) {
    return true;
  }
}

function toggleReference() {
  if (!activePage) return;
  setReferenceVisible(!referenceVisible, true);
}

function storageKey() {
  return activePage ? `little-color-garden:${activePage.id}` : "";
}

function saveStrokes() {
  if (!activePage) return;
  try {
    const trimmed = strokes.slice(-180).map((stroke) => {
      const saved = { ...stroke };
      if (stroke.points) saved.points = stroke.points.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }));
      if (stroke.point) saved.point = { x: Math.round(stroke.point.x), y: Math.round(stroke.point.y) };
      if (stroke.start) saved.start = { x: Math.round(stroke.start.x), y: Math.round(stroke.start.y) };
      if (stroke.end) saved.end = { x: Math.round(stroke.end.x), y: Math.round(stroke.end.y) };
      return saved;
    });
    localStorage.setItem(storageKey(), JSON.stringify(trimmed));
  } catch (_) {
    // Storage may be disabled; the current session still works.
  }
}

function loadStrokes(pageId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`little-color-garden:${pageId}`) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (_) {
    return [];
  }
}

galleryMusicButton.addEventListener("click", toggleGalleryMusic);
document.querySelector("#voiceButton").addEventListener("click", () => {
  // The shared board's own directions; a mosaic page has no brush and no
  // finished picture to peek at, so its sentence is its own.
  if (activePage && activePage.kind === "mosaic") {
    speak("app.directions-mosaic");
    return;
  }
  speak("app.directions-page");
});
document.querySelector("#homeButton").addEventListener("click", goHome);
document.querySelector("#finishButton").addEventListener("click", celebrate);
undoButton.addEventListener("click", undoLastStroke);
clearButton.addEventListener("click", handleClearTap);

peekButton.addEventListener("click", toggleReference);

const galleryPalette = buildColorPalette(colorPalette, (button) => {
  currentColor = button.dataset.color;
  currentColorName = button.dataset.name;
  usingEraser = false;
  eraserButton.classList.remove("is-selected");
  tinyPop(swatchTone(currentColor));
  showMessage(currentColorName[0].toUpperCase() + currentColorName.slice(1));
});

eraserButton.addEventListener("click", () => {
  selectTool("brush");
  usingEraser = true;
  galleryPalette.clearSelection();
  eraserButton.classList.add("is-selected");
  tinyPop(340);
  showMessage("Eraser");
});

document.querySelector("#galleryBackButton").addEventListener("click", showModeMenu);
document.querySelector("#modeColoring").addEventListener("click", showColoringGallery);
document.querySelector("#modePixel").addEventListener("click", () => {
  // pixel-mode.js owns the pixel screens and the renderer that drew this
  // card's art; it publishes the door once it has loaded.
  if (typeof window.openPixelGallery === "function") window.openPixelGallery();
});
document.querySelector("#modeMosaic").addEventListener("click", () => {
  // mosaic-mode.js owns the mosaic gallery the same way; the board beyond it
  // is this file's own coloring screen opened on a mosaic page.
  if (typeof window.openMosaicGallery === "function") window.openMosaicGallery();
});
document.querySelector("#modeMenuVoice").addEventListener("click", () => speak("app.mode-menu-repeat"));

function selectTool(tool) {
  currentTool = tool;
  document.querySelectorAll(".primary-tool[data-tool]").forEach((button) => button.classList.toggle("is-selected", button.dataset.tool === tool));
  document.querySelectorAll(".tool-options").forEach((options) => { options.hidden = options.dataset.options !== tool; });
  colorPalette.hidden = false;
  if (tool !== "brush") usingEraser = false;
  // Every tool paints with currentColor, so leaving the eraser for any of
  // them brings the ring back on it. The eraser's own handler calls this
  // first and clears after, so erasing still leaves the palette unmarked.
  galleryPalette.markSelected(currentColor);
  const directions = { brush: "Draw with your finger.", fill: "Tap a space to fill it.", gradient: "Drag across the picture to blend two colors.", stamp: "Tap the picture to add a stamp." };
  showMessage(directions[tool]);
  tinyPop(430 + ["brush", "fill", "gradient", "stamp"].indexOf(tool) * 60);
}

document.querySelectorAll(".primary-tool[data-tool]").forEach((button) => button.addEventListener("click", () => selectTool(button.dataset.tool)));
document.querySelectorAll(".stamp-choice").forEach((button) => button.addEventListener("click", () => {
  currentStamp = button.dataset.stamp;
  document.querySelectorAll(".stamp-choice").forEach((item) => item.classList.toggle("is-selected", item === button));
}));

document.querySelectorAll(".size-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".size-button").forEach((item) => item.classList.toggle("is-selected", item === button));
    currentSize = Number(button.dataset.size);
    tinyPop(400 + currentSize * 4);
  });
});

paintCanvas.addEventListener("pointerdown", beginStroke);
paintCanvas.addEventListener("pointermove", continueStroke);
paintCanvas.addEventListener("pointerup", endStroke);
paintCanvas.addEventListener("pointercancel", endStroke);
paintCanvas.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("beforeunload", saveStrokes);
window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoLastStroke();
  }
  if (event.key === "Escape" && !coloringScreen.hidden) {
    if (referenceVisible) setReferenceVisible(false);
    else if (clearArmed) disarmClear();
    else goHome();
  }
});

buildBlankCard();
buildGallery();
updateMusicButton(false);

if (
  "serviceWorker" in navigator &&
  location.protocol !== "file:" &&
  !["localhost", "127.0.0.1"].includes(location.hostname)
) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

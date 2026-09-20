#!/usr/bin/env node
"use strict";

// Integrity check for the Pixel Mosaic mode's palette + card system.
//
// The owner's constraint: every challenge card uses only colors available in
// the 30-color palette — no hidden extra colors, no shade a card needs that the
// child cannot pick. Cards are authored *in palette indices*, so this holds by
// construction; this script proves it anyway, because a promise only a comment
// makes is a promise the next edit can silently break.
//
// Run: node tools/check-pixel-cards.js   (from coloring-app/, any Node >= 12)

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const appDir = process.env.COLORING_APP_DIR || path.join(__dirname, "..");
const source = fs.readFileSync(path.join(appDir, "pixel-cards.js"), "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const data = sandbox.window.PIXEL_CARDS;
if (!data) {
  console.error("FAIL: pixel-cards.js did not define window.PIXEL_CARDS");
  process.exit(1);
}

const problems = [];
const palette = data.palette;
const cards = data.cards;
const W = data.boardWidth;
const H = data.boardHeight;
const validCell = new Set([".", ...Array.from({ length: 36 }, (_, i) => i.toString(36))]);

// --- palette ---
if (palette.length !== 36) problems.push(`palette has ${palette.length} colors, expected 36`);
palette.forEach((color, index) => {
  if (!/^#[0-9a-f]{6}$/i.test(color.value)) problems.push(`palette ${index} has non-hex value ${color.value}`);
  if (typeof color.name !== "string" || !color.name) problems.push(`palette ${index} has no name`);
});
const values = new Set(palette.map((color) => color.value.toLowerCase()));
if (values.size !== palette.length) problems.push("palette contains duplicate color values");

// --- board + cards ---
if (W !== 20 || H !== 15) problems.push(`board is ${W}x${H}, expected 20x15`);
const ids = new Set();
cards.forEach((card) => {
  const label = card.id || "(no id)";
  if (ids.has(card.id)) problems.push(`duplicate card id ${card.id}`);
  ids.add(card.id);
  if (!Array.isArray(card.rows) || card.rows.length !== H) {
    problems.push(`${label}: has ${card.rows ? card.rows.length : 0} rows, expected ${H}`);
    return;
  }
  const used = new Set();
  card.rows.forEach((row, rowIndex) => {
    if (row.length !== W) problems.push(`${label} row ${rowIndex}: ${row.length} cells, expected ${W}`);
    for (const ch of row) {
      if (!validCell.has(ch)) problems.push(`${label} row ${rowIndex}: unknown cell "${ch}"`);
      else if (ch !== ".") {
        const index = parseInt(ch, 36);
        used.add(index);
        if (index >= palette.length) problems.push(`${label} row ${rowIndex}: index ${index} outside the palette`);
      }
    }
  });
  if (used.size < 2) problems.push(`${label}: uses fewer than 2 colors — likely a stub`);
  const swatches = [...used].sort((a, b) => a - b).map((i) => `${i.toString(36)}=${palette[i] && palette[i].name}`).join(" ");
  console.log(`${card.id.padEnd(12)} ${String(card.rows.join("").replace(/\./g, "").length).padStart(3)} cells  colors: ${swatches}`);
});

if (problems.length) {
  console.error(`\nFAIL: ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(`\nOK: ${palette.length} colors, ${cards.length} cards, every cell a palette index or empty.`);

// The Mosaic card is a whole child-selectable mode, not merely an image corpus.
// Its pixel harness proves the sheets fill safely, but that cannot notice the
// doorway failing before a sheet reaches the shared colouring surface. Execute
// the real mode module over the smallest DOM it needs, mount every gallery card,
// and take the first card through its real click handler.
function element(id) {
  const node = {
    id,
    hidden: id !== "modeMenuScreen",
    children: [],
    listeners: {},
    dataset: {},
    style: {
      values: {},
      setProperty(name, value) { this.values[name] = value; },
    },
    setAttribute(name, value) { this[name] = String(value); },
    appendChild(child) {
      if (child && child.isFragment) this.children.push(...child.children);
      else this.children.push(child);
    },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    click() { if (this.listeners.click) this.listeners.click({ type: "click" }); },
    replaceChildren(...children) { this.children = children; },
    querySelectorAll(selector) {
      const matches = [];
      const visit = (child) => {
        const classes = String(child.className || "").split(/\s+/);
        if (selector === ".px-level" && classes.includes("px-level")) matches.push(child);
        if (selector === ".px-swatch" && classes.includes("px-swatch")) matches.push(child);
        if (selector === ".color-button" && classes.includes("color-button")) matches.push(child);
        if (selector === ".px-card[data-card]" && classes.includes("px-card") && child.dataset.card) matches.push(child);
        (child.children || []).forEach(visit);
      };
      this.children.forEach(visit);
      return matches;
    },
  };
  node.classList = {
    add(name) {
      const classes = new Set(String(node.className || "").split(/\s+/).filter(Boolean));
      classes.add(name);
      node.className = [...classes].join(" ");
    },
    remove(name) {
      node.className = String(node.className || "").split(/\s+/).filter((item) => item && item !== name).join(" ");
    },
    toggle(name, force) {
      if (force === undefined ? !String(node.className || "").split(/\s+/).includes(name) : force) this.add(name);
      else this.remove(name);
    },
  };
  return node;
}

function canvasContext() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, name) {
      if (name === "createLinearGradient") return () => gradient;
      if (!(name in target)) target[name] = () => {};
      return target[name];
    },
    set(target, name, value) { target[name] = value; return true; },
  });
}

function domElement(tagOrId) {
  const node = element(tagOrId);
  if (tagOrId === "canvas" || /Canvas$|Art$/.test(tagOrId) || ["pixelBoard", "blankCanvas"].includes(tagOrId)) {
    const context = canvasContext();
    node.getContext = () => context;
    node.getBoundingClientRect = () => ({ left: 0, top: 0, width: node.width || 1, height: node.height || 1 });
    node.setPointerCapture = () => {};
  }
  return node;
}

const nodes = Object.fromEntries([
  "modeMenuScreen", "mosaicGalleryScreen", "mosaicGallery",
  "mosaicGalleryBack", "mosaicGalleryVoice",
].map((id) => [id, element(id)]));
const spoken = [];
const opened = [];
let menuReturns = 0;
const mosaicWindow = {
  speak: (line) => spoken.push(line),
  tinyPop() {},
  stopGalleryMusic() {},
  openPage: (page) => opened.push(page),
  showModeMenu: () => { menuReturns += 1; nodes.modeMenuScreen.hidden = false; },
  addEventListener() {},
};
const mosaicDocument = {
  body: { style: {} },
  querySelector: (selector) => nodes[selector.replace(/^#/, "")] || null,
  createElement: () => element(""),
  createDocumentFragment: () => ({ isFragment: true, children: [], appendChild(child) { this.children.push(child); } }),
};
const mosaicSource = fs.readFileSync(path.join(appDir, "mosaic-mode.js"), "utf8");
vm.runInNewContext(mosaicSource, {
  window: mosaicWindow,
  document: mosaicDocument,
  console,
}, { filename: "mosaic-mode.js" });

const mosaicCards = nodes.mosaicGallery.children;
if (mosaicCards.length !== 23) problems.push(`Mosaic cold-mount built ${mosaicCards.length} cards, expected 23`);
if (typeof mosaicWindow.openMosaicGallery !== "function") problems.push("Mosaic cold-mount did not publish its menu doorway");
else {
  mosaicWindow.openMosaicGallery();
  if (nodes.modeMenuScreen.hidden !== true || nodes.mosaicGalleryScreen.hidden !== false) {
    problems.push("Mosaic doorway did not replace the mode menu with its gallery");
  }
  if (!spoken.includes("mosaic.gallery")) problems.push("Mosaic doorway did not announce its gallery");
}
if (mosaicCards[0]) mosaicCards[0].click();
if (opened.length !== 1 || opened[0].id !== "happy-rocket" || opened[0].kind !== "mosaic") {
  problems.push("Mosaic card did not open happy-rocket through the shared surface as kind=mosaic");
}
if (nodes.mosaicGalleryScreen.hidden !== true) problems.push("Mosaic card left its gallery visible over the opened page");
nodes.mosaicGalleryBack.click();
if (menuReturns !== 1 || nodes.mosaicGalleryScreen.hidden !== true) problems.push("Mosaic back did not return one level to the mode menu");

if (problems.length) {
  console.error(`\nFAIL: ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log("PASS  Mosaic cold-mount: 23 cards; doorway, card launch, and back path work.");

// The regular Colouring card is the app's namesake doorway. Exercise the real
// gallery builder and doorway function, rather than inferring either from the
// presence of its 17 page records.
const appSource = fs.readFileSync(path.join(appDir, "app.js"), "utf8");
function sourceBlock(start, end) {
  const from = appSource.indexOf(start);
  const to = appSource.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`could not extract ${start}`);
  return appSource.slice(from, to);
}
const coloringNodes = {
  modeMenuScreen: element("modeMenuScreen"),
  galleryScreen: element("galleryScreen"),
  pageGallery: element("pageGallery"),
};
coloringNodes.modeMenuScreen.hidden = false;
coloringNodes.galleryScreen.hidden = true;
const coloringSpoken = [];
const coloringOpened = [];
const coloringDocument = {
  body: { style: {} },
  createElement: (tag) => {
    const node = element(tag);
    if (tag === "img") node.draggable = true;
    return node;
  },
  createDocumentFragment: () => ({ isFragment: true, children: [], appendChild(child) { this.children.push(child); } }),
};
const coloringProgram = [
  sourceBlock("const PAGES = [", "// The Coloring palette"),
  sourceBlock("function buildGallery()", "// Blank Page is the first card"),
  sourceBlock("function showColoringGallery()", "function showModeMenu()"),
  "buildGallery(); showColoringGallery(); globalThis.__PAGES = PAGES;",
].join("\n");
vm.runInNewContext(coloringProgram, {
  document: coloringDocument,
  pageGallery: coloringNodes.pageGallery,
  modeMenuScreen: coloringNodes.modeMenuScreen,
  galleryScreen: coloringNodes.galleryScreen,
  openPage: (page) => coloringOpened.push(page),
  speak: (line) => coloringSpoken.push(line),
}, { filename: "app.js#colouring-doorway" });

const coloringCards = coloringNodes.pageGallery.children;
if (coloringCards.length !== 17) problems.push(`Colouring cold-mount built ${coloringCards.length} cards, expected 17`);
if (coloringNodes.modeMenuScreen.hidden !== true || coloringNodes.galleryScreen.hidden !== false) {
  problems.push("Colouring doorway did not replace the mode menu with its gallery");
}
if (!coloringSpoken.includes("app.pick-picture")) problems.push("Colouring doorway did not announce its gallery");
if (coloringCards[0]) coloringCards[0].click();
if (coloringOpened.length !== 1 || coloringOpened[0].id !== "solar-system") {
  problems.push("Colouring gallery's first card did not open the solar-system page");
}

if (problems.length) {
  console.error(`\nFAIL: ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log("PASS  Colouring cold-mount: 17 cards; doorway, announcement, and card launch work.");

// Pixel is a child-selectable mode, not just the 11 card records checked
// above. Execute the real module, prove its gallery includes the free board
// plus every challenge, then take a real challenge-card click to the board.
const pixelIds = [
  "modeMenuScreen", "pixelGalleryScreen", "pixelBoardScreen", "pixelCards",
  "pixelLevels", "pixelBoard", "pixelBoardFrame", "pixelPalette", "pixelEraser",
  "pixelUndo", "pixelClear", "pixelFinish", "pixelHome", "pixelVoice",
  "pixelGalleryVoice", "pixelGalleryBack", "pixelThumb", "pixelThumbCanvas",
  "pixelCardOverlay", "pixelCardOverlayCanvas", "pixelCelebration", "modePixelArt",
];
const pixelNodes = Object.fromEntries(pixelIds.map((id) => [id, domElement(id)]));
pixelNodes.modeMenuScreen.hidden = false;
const pixelSpoken = [];
const pixelStorage = new Map();
const pixelWindow = {
  PIXEL_CARDS: data,
  speak: (line) => pixelSpoken.push(line),
  tinyPop() {},
  stopGalleryMusic() {},
  addEventListener() {},
  setTimeout() { return 1; },
  clearTimeout() {},
};
const pixelDocument = {
  body: { style: {} },
  querySelector: (selector) => pixelNodes[selector.replace(/^#/, "")] || null,
  createElement: (tag) => domElement(tag),
};
const pixelSandbox = {
  window: pixelWindow,
  document: pixelDocument,
  localStorage: {
    getItem: (key) => pixelStorage.get(key) || null,
    setItem: (key, value) => pixelStorage.set(key, String(value)),
  },
  requestAnimationFrame: (fn) => fn(),
  performance: { now: () => 1 },
  console,
};
vm.runInNewContext(fs.readFileSync(path.join(appDir, "pixel-mode.js"), "utf8"), pixelSandbox, { filename: "pixel-mode.js" });

const pixelCards = pixelNodes.pixelCards.children;
if (pixelCards.length !== 12) problems.push(`Pixel cold-mount built ${pixelCards.length} cards, expected 12 (free board plus 11 challenges)`);
if (typeof pixelWindow.openPixelGallery !== "function") problems.push("Pixel cold-mount did not publish its menu doorway");
else {
  pixelWindow.openPixelGallery();
  if (pixelNodes.modeMenuScreen.hidden !== true || pixelNodes.pixelGalleryScreen.hidden !== false) {
    problems.push("Pixel doorway did not replace the mode menu with its gallery");
  }
}
if (pixelCards[1]) pixelCards[1].click();
if (pixelNodes.pixelGalleryScreen.hidden !== true || pixelNodes.pixelBoardScreen.hidden !== false) {
  problems.push("Pixel challenge card did not replace its gallery with the board");
}
if (!pixelSpoken.includes("pixel.prompt.apple.medium")) problems.push(`Pixel challenge card did not open the apple board at the selected level (heard: ${pixelSpoken.join(", ")})`);

if (problems.length) {
  console.error(`\nFAIL: ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log("PASS  Pixel cold-mount: 12 cards (free + 11 challenges); doorway and challenge-card board launch work.");

// Blank Page is not a separate menu mode: it must be the first card children
// meet inside Coloring. Execute its real module and the real gallery builders,
// then click that first card and inspect the drawing surface it opens.
const blankIds = [
  "galleryScreen", "blankScreen", "blankCanvas", "blankMessage", "blankBrush",
  "blankEraser", "blankClear", "blankPalette", "blankHome", "blankVoice",
];
const blankNodes = Object.fromEntries(blankIds.map((id) => [id, domElement(id)]));
blankNodes.galleryScreen.hidden = false;
blankNodes.blankScreen.hidden = true;
blankNodes.blankCanvas.width = 724;
blankNodes.blankCanvas.height = 1086;
const blankSpoken = [];
const blankStorage = new Map();
const blankWindow = {
  speak: (line) => blankSpoken.push(line),
  tinyPop() {},
  stopGalleryMusic() {},
  showColoringGallery() {},
  addEventListener() {},
  setTimeout() { return 1; },
  clearTimeout() {},
};
const blankDocument = {
  querySelector(selector) {
    if (selector === "#blankPalette .color-button.is-selected") {
      return blankNodes.blankPalette.children.find((node) => String(node.className).includes("is-selected")) || null;
    }
    return blankNodes[selector.replace(/^#/, "")] || null;
  },
  createElement: (tag) => domElement(tag),
};
const blankPaletteProgram = [
  sourceBlock("const COLOR_FAMILIES = [", "const galleryScreen"),
  sourceBlock("function buildColorPalette", "// The tap tone rises"),
  "window.buildColorPalette = buildColorPalette;",
].join("\n");
vm.runInNewContext(blankPaletteProgram, {
  window: blankWindow,
  document: blankDocument,
}, { filename: "app.js#blank-palette" });
vm.runInNewContext(fs.readFileSync(path.join(appDir, "blank-page.js"), "utf8"), {
  window: blankWindow,
  document: blankDocument,
  localStorage: {
    getItem: (key) => blankStorage.get(key) || null,
    setItem: (key, value) => blankStorage.set(key, String(value)),
  },
  requestAnimationFrame: (fn) => fn(),
  console,
}, { filename: "blank-page.js" });

const blankGallery = domElement("pageGallery");
const blankGalleryDocument = {
  createElement: (tag) => domElement(tag),
  createDocumentFragment: () => ({ isFragment: true, children: [], appendChild(child) { this.children.push(child); } }),
};
const blankGalleryProgram = [
  sourceBlock("const PAGES = [", "// The Coloring palette"),
  sourceBlock("function buildGallery()", "// Blank Page is the first card"),
  sourceBlock("function buildBlankCard()", "// One palette builder"),
  "buildBlankCard(); buildGallery();",
].join("\n");
vm.runInNewContext(blankGalleryProgram, {
  window: blankWindow,
  document: blankGalleryDocument,
  pageGallery: blankGallery,
  openPage() {},
  console,
}, { filename: "app.js#blank-card" });

if (blankGallery.children.length !== 18) problems.push(`Coloring gallery with Blank Page built ${blankGallery.children.length} cards, expected 18`);
if (!String((blankGallery.children[0] || {}).className).includes("page-card--blank")) problems.push("Blank Page is not the first card of the Coloring gallery");
if (blankGallery.children[0]) blankGallery.children[0].click();
if (blankNodes.galleryScreen.hidden !== true || blankNodes.blankScreen.hidden !== false) problems.push("Blank Page card did not open its drawing surface");
if (blankNodes.blankCanvas.width !== 724 || blankNodes.blankCanvas.height !== 1086) problems.push("Blank Page did not provide its 724x1086 drawing surface");
if (blankNodes.blankPalette.children.length !== 48) problems.push(`Blank Page mounted ${blankNodes.blankPalette.children.length} colors, expected 48`);
if (!["pointerdown", "pointermove", "pointerup", "pointercancel"].every((type) => typeof blankNodes.blankCanvas.listeners[type] === "function")) {
  problems.push("Blank Page drawing surface is missing pointer drawing handlers");
}
if (!blankSpoken.includes("blank.open")) problems.push("Blank Page card did not announce the open drawing surface");

if (problems.length) {
  console.error(`\nFAIL: ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log("PASS  Blank Page cold-mount: first of 18 Coloring cards; 724x1086 surface, 48 colors, and drawing handlers work.");

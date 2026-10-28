"use strict";

// ---- Magic brushes (owner brief, 2026-10-28: "this magic one -> can we have
// more to select? not only rainbow?") --------------------------------------
// The Magic tool is a picker of brushes, not one rainbow. This kit holds the
// brush list, the by-distance stamp spacing and every brush's drawing as plain
// 2D canvas calls -- no DOM, no page state -- so the page IIFE below feeds its
// live context and the chosen colour in, and tools/test-magic-brushes.mjs can
// load this same section in plain node. The picker tray paints each choice's
// preview with these very functions, so what a child picks is what lands on
// the paper. Rainbow stays first and the default; its stripes and its star
// draw exactly as before, only the star's placing joined the distance spacing,
// so every trail looks the same however fast the finger moves.
const cgMagicBrushKit = (() => {
  const BRIGHT = ["#ff5f87", "#ff9f43", "#ffe04d", "#49cf7d", "#52b7ff", "#9667ed"];
  const PINKS = ["#ff8fb4", "#f04455", "#ff5f87", "#ffb3c9"];

  // Trail evenness (owner brief): stamps are placed by distance travelled, not
  // by event count, so a slow finger and a fast finger lay the same trail.
  // `carry` is the distance walked since the last stamp; the leftover comes
  // back out and is fed into the next segment.
  function stampsAlong(from, to, spacing, carry = 0) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (!(length > 0) || !(spacing > 0)) return { points: [], carry };
    const walked = carry + length;
    const points = [];
    for (let d = Math.floor(carry / spacing) * spacing + spacing; d <= walked; d += spacing) {
      const share = (d - carry) / length;
      points.push({ x: from.x + dx * share, y: from.y + dy * share });
    }
    return { points, carry: walked - Math.floor(walked / spacing) * spacing };
  }

  function segment(ctx, from, to) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  // A filled star of any point count; `inner` is the waist as a share of the
  // radius, so four-point sparkles and five-point stars share one helper.
  function starPath(ctx, x, y, radius, rotation, points, inner) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
      const angle = rotation - Math.PI / 2 + i * Math.PI / points;
      const arm = i % 2 ? radius * inner : radius;
      const px = x + Math.cos(angle) * arm;
      const py = y + Math.sin(angle) * arm;
      if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function heartPath(ctx, x, y, size) {
    ctx.beginPath();
    for (let i = 0; i <= 20; i += 1) {
      const t = i * Math.PI * 2 / 20;
      const px = x + size * Math.sin(t) ** 3;
      const py = y - size * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 13;
      if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // The rainbow's own two drawings, kept as they always were.
  function rainbowStripes(ctx, from, to) {
    ctx.save();
    ctx.lineCap = "round";
    BRIGHT.forEach((stripe, index) => {
      ctx.strokeStyle = stripe;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y + (index - 2.5) * 7);
      ctx.lineTo(to.x, to.y + (index - 2.5) * 7);
      ctx.stroke();
    });
    ctx.restore();
  }

  function rainbowStar(ctx, point) {
    ctx.save();
    ctx.fillStyle = "#fff7a8";
    ctx.strokeStyle = "#7b5bd6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / 4;
      const radius = i % 2 ? 5 : 13;
      const x = point.x + Math.cos(angle) * radius;
      const y = point.y + Math.sin(angle) * radius;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // A soft glowing line in the chosen colour (Sparkle's base).
  function sparkleLine(ctx, from, to, env) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = env.color;
    ctx.globalAlpha = .25; ctx.lineWidth = 16; segment(ctx, from, to);
    ctx.globalAlpha = .95; ctx.lineWidth = 6; segment(ctx, from, to);
    ctx.restore();
  }

  function twinkle(ctx, point, env) {
    const radius = 4 + env.random() * 6;
    const x = point.x + (env.random() - .5) * 14;
    const y = point.y + (env.random() - .5) * 14;
    ctx.save();
    ctx.fillStyle = "#fffbe0";
    ctx.strokeStyle = "#ffd23f"; // a pale gold rim, so a twinkle shows on white paper too
    ctx.lineWidth = 2;
    starPath(ctx, x, y, radius, env.random() * Math.PI, 4, .3);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function starStamp(ctx, point, env) {
    ctx.save();
    ctx.fillStyle = BRIGHT[Math.floor(env.random() * BRIGHT.length)];
    ctx.strokeStyle = "rgba(74,49,115,.35)";
    ctx.lineWidth = 3;
    starPath(ctx, point.x, point.y, 9 + env.random() * 6, (env.random() - .5) * 1.4, 5, .45);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function heartStamp(ctx, point, env) {
    const size = 10 + env.random() * 5;
    ctx.save();
    ctx.translate(point.x, point.y - size * .45);
    ctx.rotate((env.random() - .5) * .7);
    ctx.fillStyle = PINKS[Math.floor(env.random() * PINKS.length)];
    ctx.strokeStyle = "rgba(74,49,115,.3)";
    ctx.lineWidth = 2.5;
    heartPath(ctx, 0, 0, size);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function bubbleStamp(ctx, point, env) {
    const radius = 6 + env.random() * 7;
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(160,205,255,.16)"; // see-through: a skin of bubble, never a blob
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = "rgba(88,158,255,.9)";
    ctx.stroke();
    ctx.beginPath(); // the shine dot, up and to the left like a lit bubble
    ctx.arc(point.x - radius * .38, point.y - radius * .38, Math.max(1.6, radius * .2), 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
  }

  // A neon tube in the chosen colour: a soft wide halo, a bright core, a
  // white-hot centre.
  function glowLine(ctx, from, to, env) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = env.color;
    ctx.globalAlpha = .3; ctx.lineWidth = 24; segment(ctx, from, to);
    ctx.globalAlpha = 1; ctx.lineWidth = 9; segment(ctx, from, to);
    ctx.strokeStyle = "#fff";
    ctx.globalAlpha = .85; ctx.lineWidth = 3; segment(ctx, from, to);
    ctx.restore();
  }

  function confettiStamp(ctx, point, env) {
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i += 1) {
      ctx.save();
      ctx.translate(point.x + (env.random() - .5) * 34, point.y + (env.random() - .5) * 34);
      ctx.rotate(env.random() * Math.PI);
      const tone = BRIGHT[Math.floor(env.random() * BRIGHT.length)];
      if (env.random() < .55) { // a dot...
        ctx.fillStyle = tone;
        ctx.beginPath();
        ctx.arc(0, 0, 2 + env.random() * 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else { // ...or a short dash
        ctx.strokeStyle = tone;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(-4 - env.random() * 3, 0);
        ctx.lineTo(4 + env.random() * 3, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function flowerStamp(ctx, point, env) {
    const petal = 7 + env.random() * 2.5;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(env.random() * Math.PI);
    ctx.fillStyle = env.color;
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const angle = i * Math.PI * 2 / 5;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * petal * .95, Math.sin(angle) * petal * .95, petal * .78, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, petal * .5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd23f"; // the yellow centre
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#e8960c";
    ctx.stroke();
    ctx.restore();
  }

  // White flakes need their light blue outline to show on white paper: each
  // flake is drawn wide in blue, then overdrawn thin in white.
  function snowStamp(ctx, point, env) {
    const reach = 8 + env.random() * 4;
    const spin = env.random() * Math.PI;
    const flake = (colour, width) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = spin + i * Math.PI / 3;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(point.x + cos * reach, point.y + sin * reach);
        [-1, 1].forEach((side) => {
          const at = reach * .58;
          const branch = angle + side * Math.PI / 3.2;
          ctx.moveTo(point.x + cos * at, point.y + sin * at);
          ctx.lineTo(point.x + cos * at + Math.cos(branch) * reach * .38, point.y + sin * at + Math.sin(branch) * reach * .38);
        });
      }
      ctx.stroke();
    };
    ctx.save();
    flake("#a9d7ff", 4);
    flake("#ffffff", 1.8);
    ctx.restore();
  }

  const brushes = [
    { id: "rainbow", label: "Rainbow", message: "Rainbow magic!", spacing: 42, stroke: rainbowStripes, stamp: rainbowStar },
    { id: "sparkle", label: "Sparkle", message: "Sparkle magic!", spacing: 30, stroke: sparkleLine, stamp: twinkle },
    { id: "stars", label: "Stars", message: "Star magic!", spacing: 40, stamp: starStamp },
    { id: "hearts", label: "Hearts", message: "Heart magic!", spacing: 42, stamp: heartStamp },
    { id: "bubbles", label: "Bubbles", message: "Bubble magic!", spacing: 30, stamp: bubbleStamp },
    { id: "glow", label: "Glow", message: "Glow magic!", stroke: glowLine },
    { id: "confetti", label: "Confetti", message: "Confetti magic!", spacing: 30, stamp: confettiStamp },
    { id: "flowers", label: "Flowers", message: "Flower magic!", spacing: 46, stamp: flowerStamp },
    { id: "snow", label: "Snow", message: "Snow magic!", spacing: 36, stamp: snowStamp },
  ];

  return { brushes, stampsAlong, defaultId: "rainbow" };
})();

// tools/test-magic-brushes.mjs reads the kit back through window after loading
// this file in plain node; the page IIFE below uses the binding directly.
if (typeof window !== "undefined" && window) window.cgMagicBrushKit = cgMagicBrushKit;

// Blank Coloring Page: a small, child-first drawing toy. Every canvas mutation
// is one history action; stamps and shapes repeat-place until another choice is
// made. There are deliberately no layers, selections, transforms, or text input
// on the PAPER itself — but placed stickers (owner brief, 2026-10-05) are live
// objects on their own layer above the bitmap: they stay draggable, can be
// pinched or handle-resized between 0.4x and 3x of the default size, and the
// selected one can be deleted. History carries the bitmap AND the stickers as
// one page state, so Undo/Clear/Save always mean the whole page.
(() => {
  const screen = document.querySelector("#blankScreen");
  if (!screen) return;

  const canvas = document.querySelector("#blankCanvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const stickerLayer = document.querySelector("#blankStickers");
  const message = document.querySelector("#blankMessage");
  const paletteRoot = document.querySelector("#blankPalette");
  const shapeTray = document.querySelector("#blankShapeTray");
  const magicTray = document.querySelector("#blankMagicTray");
  const stampPanel = document.querySelector("#blankStampPanel");
  const stampTray = document.querySelector("#blankStampTray");
  const categoryTray = document.querySelector("#blankStampCategories");
  const clearButton = document.querySelector("#blankClear");
  const undoButton = document.querySelector("#blankUndo");
  const redoButton = document.querySelector("#blankRedo");
  const selectAll = (root, selector) => root && typeof root.querySelectorAll === "function" ? [...root.querySelectorAll(selector)] : [];
  const toolButtons = selectAll(document, "[data-blank-tool]");
  const speak = window.speak || (() => {});
  const pop = window.tinyPop || (() => {});
  const STORAGE_KEY = "little-color-garden:blank-page-v2";
  const BRUSH_SIZE = 26;
  const ERASER_SIZE = 54;
  const MAX_HISTORY = 30;
  const DEFAULT_STAMP_SHARE = .20;
  // A placed sticker's size is a multiple of the default share; the pinch and
  // the corner handle clamp inside this range (owner brief: roughly 0.4x-3x).
  const STICKER_MIN_SCALE = .4;
  const STICKER_MAX_SCALE = 3;
  // Owner rule, 2026-10-20: no emoji in the UI -- the sticker delete control
  // is a drawn bin (lid + body) in the app's own rounded style, not an emoji.
  const BIN_ICON =
    '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4.5 6.5h15"/><path d="M9.5 6.3V4.9a1.4 1.4 0 0 1 1.4-1.4h2.2a1.4 1.4 0 0 1 1.4 1.4v1.4"/>' +
    '<path d="M6.4 6.5l.8 11.7a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9l.8-11.7"/>' +
    '<path d="M10.2 10.4v5.7M13.8 10.4v5.7"/></svg>';

  // The packs are shared with Stamping (sticker-kit.js), so the list lives once.
  const THEMED_STAMPS = window.cgStickerPacks;
  const turn = window.cgTurn;
  const holdTurn = window.cgHoldTurn;
  const tileArt = window.cgTileArt;
  const stickerActions = document.querySelector("#blankStickerActions");
  const categoryLabels = { space: "Space", princess: "Princess", mermaid: "Mermaid", castle: "Magic Castle", animals: "Animals & Pets", ocean: "Ocean", food: "Sweets", fruit: "Fruit", veg: "Vegetables", meals: "Meals", dishes: "Dishes", vehicles: "Vehicles", home: "Home & Tea Party", baby: "Baby", dinosaurs: "Dinosaurs", effects: "Magic Effects", abc: "ABC", numbers: "123" };
  const stampImages = new Map();
  let tool = "brush";
  let color = "#f04455";
  let selectedShape = "circle";
  let selectedStamp = { kind: "image", theme: "space", value: "ringed-planet" };
  let drawing = false;
  let pointerId = null;
  let previousPoint = null;
  // The chosen magic brush is remembered for as long as the page is open
  // (owner brief, 2026-10-28); `magicCarry` is the distance walked since the
  // last trail stamp, reset at every touch so strokes never share leftovers.
  let magicCarry = 0;
  let selectedMagic = cgMagicBrushKit.defaultId;
  let beforeGesture = null;
  let undoStack = [];
  let redoStack = [];
  let historyBusy = false;
  let clearArmed = false;
  let clearTimer = null;

  // ---- Placed stickers (owner brief, 2026-10-05, section 1) ----------------
  // Each sticker: { id, kind: "image"|"tile", theme?, value, x, y, scale }.
  // x/y are the centre as a fraction of the canvas (so a page resize keeps the
  // sticker where the child put it); scale multiplies the default share.
  let stickers = [];
  let stickerSeq = 1;
  let selectedStickerId = null;
  const stickerElements = new Map(); // sticker.id -> its live element
  let stickerGesture = null; // { id, mode: "drag"|"pinch"|"handle"|"turn", ... }
  const stickerPointers = new Map(); // pointerId -> { x, y } during a gesture
  const clampScale = (scale) => Math.min(STICKER_MAX_SCALE, Math.max(STICKER_MIN_SCALE, scale));

  const magicBrushes = cgMagicBrushKit.brushes;
  const magicBrushById = new Map(magicBrushes.map((brush) => [brush.id, brush]));
  const magicBrush = () => magicBrushById.get(selectedMagic);

  function showMessage(text) {
    message.textContent = text;
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => { message.textContent = ""; }, 2600);
  }

  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }

  function snapshot() { return canvas.toDataURL("image/png"); }

  function stickerSnapshot() { return JSON.stringify(stickers); }

  // One undo entry is the whole page: the paper bitmap plus every sticker,
  // and the paper's own size, so a step back restores the page's shape too.
  function captureState() { return { image: snapshot(), stickers: stickerSnapshot(), w: canvas.width, h: canvas.height }; }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ image: snapshot(), stickers, w: canvas.width, h: canvas.height })); } catch (_) {}
  }

  function updateHistoryButtons() {
    undoButton.disabled = historyBusy || !undoStack.length;
    redoButton.disabled = historyBusy || !redoStack.length;
  }

  function commit(before) {
    // Callers that only touch the paper pass a bare image; the stickers ride
    // along unchanged. Sticker gestures pass a full captureState().
    undoStack.push(typeof before === "string" ? { image: before, stickers: stickerSnapshot(), w: canvas.width, h: canvas.height } : before);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
    updateHistoryButtons();
    saveState();
  }

  async function undo() {
    if (historyBusy || !undoStack.length) return;
    historyBusy = true;
    redoStack.push(captureState());
    const entry = undoStack.pop();
    // The page's shape first, so the stickers are laid out on the right paper.
    setPaperShape(entry.w, entry.h);
    // The sticker half of the page state is synchronous. Apply it at the
    // history transition, before the bitmap's Image decode yields, so no old
    // restore can leave or re-add live DOM objects after the click handler.
    setStickers(entry.stickers);
    updateHistoryButtons();
    await restore(entry.image);
    historyBusy = false;
    updateHistoryButtons();
    saveState();
    pop(300, 0.06);
  }

  async function redo() {
    if (historyBusy || !redoStack.length) return;
    historyBusy = true;
    undoStack.push(captureState());
    const entry = redoStack.pop();
    setPaperShape(entry.w, entry.h);
    setStickers(entry.stickers);
    updateHistoryButtons();
    await restore(entry.image);
    historyBusy = false;
    updateHistoryButtons();
    saveState();
    pop(440, 0.06);
  }

  // ---- The paper keeps its shape (owner report 2026-10-26: "after draw
  // things and turn ipad (like from portrait to landscape) the proportions
  // changed. Ruin.") -------------------------------------------------------
  // The page used to follow the screen: on every turn of the iPad the bitmap
  // was redrawn into a box of the other shape, so a circle became an oval and
  // a turn back blurred it again. Now the bitmap IS the paper. Its pixel size
  // never changes while it holds a drawing or a sticker; turning the iPad only
  // scales the whole paper to fit, the same in both directions, so nothing
  // stretches. A paper with nothing on it takes the shape of the screen, so a
  // new page, or one just cleared, still fills the space.
  const paperFrame = canvas.parentElement;
  const paperStage = paperFrame && paperFrame.parentElement;
  const PAPER_RESOLUTION = () => Math.min(window.devicePixelRatio || 1, 1.5);

  function paperSpace() {
    if (!paperStage || !paperFrame || typeof getComputedStyle !== "function") return null;
    const stage = getComputedStyle(paperStage);
    const frame = getComputedStyle(paperFrame);
    const border = (parseFloat(frame.borderLeftWidth) || 0) + (parseFloat(frame.borderRightWidth) || 0);
    const borderY = (parseFloat(frame.borderTopWidth) || 0) + (parseFloat(frame.borderBottomWidth) || 0);
    const width = paperStage.clientWidth - (parseFloat(stage.paddingLeft) || 0) - (parseFloat(stage.paddingRight) || 0) - border;
    const height = paperStage.clientHeight - (parseFloat(stage.paddingTop) || 0) - (parseFloat(stage.paddingBottom) || 0) - borderY;
    if (width < 100 || height < 100) return null;
    return { width, height, border, borderY };
  }

  // Size the paper frame to the bitmap's own shape, as large as fits.
  function sizeFrameToPaper() {
    const space = paperSpace();
    if (!space) return;
    const aspect = canvas.width / canvas.height;
    let width = space.width;
    let height = width / aspect;
    if (height > space.height) { height = space.height; width = height * aspect; }
    paperFrame.style.width = `${Math.floor(width) + space.border}px`;
    paperFrame.style.height = `${Math.floor(height) + space.borderY}px`;
    layoutAllStickers();
  }

  // A new bitmap of the given size (white). Only for an empty page or for a
  // saved page whose picture is about to be drawn back in at its own size.
  function setPaperShape(width, height) {
    width = Math.round(+width); height = Math.round(+height);
    if (!(width >= 50 && height >= 50 && width <= 4096 && height <= 4096)) return false;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
    }
    sizeFrameToPaper();
    return true;
  }

  function pageIsEmpty() {
    if (stickers.length) return false;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset] !== 255 || pixels[offset + 1] !== 255 || pixels[offset + 2] !== 255) return false;
    }
    return true;
  }

  // An empty page fills the screen in whichever way the iPad is held.
  function fitEmptyPaperToScreen() {
    const space = paperSpace();
    if (!space) return false;
    const scale = PAPER_RESOLUTION();
    return setPaperShape(Math.floor(space.width) * scale, Math.floor(space.height) * scale);
  }

  function fitCanvasToPage() {
    if (pageIsEmpty()) fitEmptyPaperToScreen();
    else sizeFrameToPaper();
  }

  // A page bitmap goes back in at its own size: the paper takes the picture's
  // shape. Pages saved before 2026-10-26 carry no size and are measured here.
  function restore(dataUrl) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        if (image.naturalWidth && image.naturalHeight && (image.naturalWidth !== canvas.width || image.naturalHeight !== canvas.height)) {
          setPaperShape(image.naturalWidth, image.naturalHeight);
        }
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve();
      };
      image.onerror = resolve;
      image.src = dataUrl;
    });
  }

  function line(from, to, erase = false) {
    context.save();
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = erase ? "#fff" : color;
    context.lineWidth = erase ? ERASER_SIZE : BRUSH_SIZE;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.restore();
  }

  // One segment of the chosen magic brush. Line brushes (rainbow stripes,
  // sparkle's glow, neon) follow the finger; trail brushes stamp by distance
  // travelled, so the trail is even at any finger speed. `opening` lays the
  // first stamp at the touch itself, so the page answers before any movement.
  function magicLine(from, to, opening = false) {
    const brush = magicBrush();
    const env = { color, random: Math.random };
    if (brush.stroke) brush.stroke(context, from, to, env);
    if (brush.stamp) {
      if (opening) brush.stamp(context, to, env);
      const walk = cgMagicBrushKit.stampsAlong(from, to, brush.spacing, magicCarry);
      magicCarry = walk.carry;
      walk.points.forEach((point) => brush.stamp(context, point, env));
    }
  }

  function fillAt(point) {
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const x0 = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x)));
    const y0 = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y)));
    const start = (y0 * canvas.width + x0) * 4;
    const target = [image.data[start], image.data[start + 1], image.data[start + 2], image.data[start + 3]];
    const rgb = color.match(/[a-f\d]{2}/gi).map((hex) => parseInt(hex, 16));
    if (Math.abs(target[0] - rgb[0]) < 3 && Math.abs(target[1] - rgb[1]) < 3 && Math.abs(target[2] - rgb[2]) < 3) return false;
    const matches = (offset) => Math.abs(image.data[offset] - target[0]) <= 12 && Math.abs(image.data[offset + 1] - target[1]) <= 12 && Math.abs(image.data[offset + 2] - target[2]) <= 12 && image.data[offset + 3] === target[3];
    const seen = new Uint8Array(canvas.width * canvas.height);
    // Packed pixel indexes keep a whole-page fill bounded and avoid allocating
    // hundreds of thousands of little [x, y] arrays on an iPad.
    const queue = [y0 * canvas.width + x0];
    for (let q = 0; q < queue.length; q += 1) {
      const key = queue[q];
      const x = key % canvas.width;
      const y = Math.floor(key / canvas.width);
      if (seen[key]) continue;
      const offset = key * 4;
      if (!matches(offset)) continue;
      seen[key] = 1;
      image.data[offset] = rgb[0]; image.data[offset + 1] = rgb[1]; image.data[offset + 2] = rgb[2]; image.data[offset + 3] = 255;
      if (x) queue.push(key - 1);
      if (x + 1 < canvas.width) queue.push(key + 1);
      if (y) queue.push(key - canvas.width);
      if (y + 1 < canvas.height) queue.push(key + canvas.width);
    }
    context.putImageData(image, 0, 0);
    return true;
  }

  function drawShape(point) {
    const size = 105;
    context.save();
    context.fillStyle = color;
    context.strokeStyle = "rgba(74,49,115,.35)";
    context.lineWidth = 5;
    context.beginPath();
    if (selectedShape === "circle") context.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
    else if (selectedShape === "square") context.rect(point.x - size / 2, point.y - size / 2, size, size);
    else {
      const count = selectedShape === "triangle" ? 3 : selectedShape === "star" ? 10 : 20;
      for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + i * Math.PI * 2 / count;
        let radius = size / 2;
        if (selectedShape === "star" && i % 2) radius *= .45;
        if (selectedShape === "heart") {
          const t = i * Math.PI * 2 / count;
          const x = point.x + 3.2 * 16 * Math.sin(t) ** 3;
          const y = point.y - 3.2 * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
          if (!i) context.moveTo(x, y); else context.lineTo(x, y);
          continue;
        }
        const x = point.x + Math.cos(angle) * radius;
        const y = point.y + Math.sin(angle) * radius;
        if (!i) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath();
    }
    context.fill(); context.stroke(); context.restore();
  }

  function imageForStamp(theme, name) {
    const key = `${theme}-${name}`;
    if (!stampImages.has(key)) {
      if (typeof Image === "undefined") return { complete: false, naturalWidth: 0 };
      const image = new Image();
      image.src = `./assets/blank-stamps/${key}.webp`;
      stampImages.set(key, image);
    }
    return stampImages.get(key);
  }

  // ---- Sticker layer (owner brief, 2026-10-05) -----------------------------
  // A placed sticker is a DOM object above the canvas, never pixels inside
  // it, so it stays draggable, resizable and deletable after placement. The
  // layer itself ignores pointers; each sticker takes its own, so drawing on
  // the paper still works everywhere a sticker is not.

  // Owner report 2026-10-25: "i see stickers that cut off at the edges." The
  // paper frame clips anything past the page edge, and a sticker is a picture
  // ON the page, so it stays whole: its centre is held at least half a sticker
  // in from every edge -- on placing, dragging, resizing and on a new page
  // size. (Before this, only the centre was kept on the page and up to half a
  // sticker vanished under the frame.)
  function stickerHeight(element, sticker, width) {
    if (sticker.kind === "tile") return width;
    const image = element.querySelector("img");
    if (image && image.complete && image.naturalWidth) return width * image.naturalHeight / image.naturalWidth;
    const cached = stampImages.get(`${sticker.theme}-${sticker.value}`);
    if (image && !element.dataset.waitingForArt) {
      element.dataset.waitingForArt = "1";
      image.addEventListener("load", () => { delete element.dataset.waitingForArt; layoutSticker(element, sticker); }, { once: true });
    }
    return cached && cached.naturalWidth ? width * cached.naturalHeight / cached.naturalWidth : width;
  }

  // The art inside turns and mirrors; the sticker's own box is the box the
  // turned art really covers (owner request 2026-10-25), so keeping that box
  // on the page keeps the whole turned sticker on the page.
  function layoutSticker(element, sticker) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.min(rect.width, rect.height) * DEFAULT_STAMP_SHARE * sticker.scale;
    const height = stickerHeight(element, sticker, width);
    const covered = turn ? turn.box(width, height, sticker.rot || 0) : { width, height };
    element.style.width = `${Math.round(covered.width)}px`;
    element.style.height = `${Math.round(covered.height)}px`;
    const art = element.querySelector(".blank-sticker__art");
    if (art) {
      art.style.width = `${Math.round(width)}px`;
      art.style.height = `${Math.round(height)}px`;
      art.style.transform = `translate(-50%, -50%) ${turn ? turn.css(sticker.rot || 0, sticker.flip) : ""}`;
    }
    const page = stickerLayer && typeof stickerLayer.getBoundingClientRect === "function" ? stickerLayer.getBoundingClientRect() : { width: 0, height: 0 };
    if (page.width > 0 && page.height > 0) {
      const boxWidth = covered.width;
      const boxHeight = covered.height;
      const halfX = Math.min(.5, boxWidth / 2 / page.width);
      const halfY = Math.min(.5, boxHeight / 2 / page.height);
      sticker.x = Math.min(1 - halfX, Math.max(halfX, sticker.x));
      sticker.y = Math.min(1 - halfY, Math.max(halfY, sticker.y));
      // A sticker against an edge pulls its delete control and resize grip
      // inside the paper, where the frame cannot clip them.
      const left = sticker.x * page.width - boxWidth / 2;
      const top = sticker.y * page.height - boxHeight / 2;
      element.classList.toggle("is-at-top", top < 20);
      element.classList.toggle("is-at-left", left < 20);
      element.classList.toggle("is-at-right", page.width - (left + boxWidth) < 20);
      element.classList.toggle("is-at-bottom", page.height - (top + boxHeight) < 20);
    }
    element.style.left = `${sticker.x * 100}%`;
    element.style.top = `${sticker.y * 100}%`;
  }

  function layoutAllStickers() {
    stickers.forEach((sticker) => {
      const element = stickerElements.get(sticker.id);
      if (element) layoutSticker(element, sticker);
    });
  }

  function selectSticker(id) {
    selectedStickerId = id;
    stickerElements.forEach((element, stickerId) => element.classList.toggle("is-selected", stickerId === id));
    if (stickerActions) stickerActions.hidden = !stickers.some((sticker) => sticker.id === id);
  }

  // Turn or mirror the selected sticker: one undo step each, saved with the
  // page, and re-kept whole on the page because a turn changes its box.
  function transformSelectedSticker(change, tone) {
    const sticker = stickers.find((item) => item.id === selectedStickerId);
    const element = sticker && stickerElements.get(sticker.id);
    if (!sticker || !element || historyBusy) return;
    const before = captureState();
    change(sticker);
    layoutSticker(element, sticker);
    commit(before);
    pop(tone, .05);
  }

  function buildStickerElement(sticker) {
    const element = document.createElement("div");
    element.className = `blank-sticker${sticker.kind === "tile" ? " blank-sticker--tile" : ""}`;
    element.dataset.stickerId = String(sticker.id);
    element.setAttribute("role", "img");
    // Letter and number tiles are the shared tile pictures (sticker-kit.js),
    // the same ones Stamping stamps, so an "A" looks alike in both modes.
    const art = document.createElement("span");
    art.className = "blank-sticker__art";
    const image = document.createElement("img");
    image.alt = ""; image.draggable = false;
    if (sticker.kind === "tile") {
      image.src = tileArt ? tileArt.url(sticker.value) : "";
      element.setAttribute("aria-label", `${sticker.value} sticker`);
    } else {
      image.src = `./assets/blank-stamps/${sticker.theme}-${sticker.value}.webp`;
      element.setAttribute("aria-label", `${sticker.value.replaceAll("-", " ")} sticker`);
    }
    art.appendChild(image);
    element.appendChild(art);
    // The delete control only exists for the selected sticker (CSS shows it),
    // and it stops the pointer before the sticker can read it as a drag.
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "blank-sticker__delete";
    remove.setAttribute("aria-label", "Remove this sticker");
    remove.innerHTML = BIN_ICON;
    remove.addEventListener("pointerdown", (event) => event.stopPropagation());
    remove.addEventListener("click", () => deleteSticker(sticker.id));
    const handle = document.createElement("span");
    handle.className = "blank-sticker__handle";
    handle.setAttribute("aria-hidden", "true");
    const turnHandle = document.createElement("button");
    turnHandle.type = "button";
    turnHandle.className = "blank-sticker__turn";
    turnHandle.setAttribute("aria-label", "Drag to turn this sticker");
    turnHandle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8.2" y="10.4" width="9" height="9" rx="2" transform="rotate(20 12.7 14.9)" fill="currentColor"/><path d="M4.2 13.2A8.2 8.2 0 0 1 17.6 5.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M18.4 1.8v4.4H14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    element.appendChild(remove);
    element.appendChild(handle);
    element.appendChild(turnHandle);

    element.addEventListener("pointerdown", (event) => beginStickerGesture(event, sticker, "sticker"));
    handle.addEventListener("pointerdown", (event) => beginStickerGesture(event, sticker, "handle"));
    turnHandle.addEventListener("pointerdown", (event) => beginStickerGesture(event, sticker, "turn"));
    return element;
  }

  function rebuildStickers() {
    if (!stickerLayer) return;
    stickerLayer.replaceChildren();
    stickerElements.clear();
    stickers.forEach((sticker) => {
      const element = buildStickerElement(sticker);
      stickerElements.set(sticker.id, element);
      stickerLayer.appendChild(element);
      layoutSticker(element, sticker);
    });
    if (!stickers.some((sticker) => sticker.id === selectedStickerId)) selectedStickerId = null;
    selectSticker(selectedStickerId);
  }

  function replaceStickerState(nextStickers) {
    // A page-level replacement (Clear, Undo/Redo, or opening a saved page) must
    // tear down every part of the live-object layer together. In particular,
    // do not leave a selected handle or an in-flight pointer gesture referring
    // to DOM nodes that have just been removed.
    stickerGesture = null;
    stickerPointers.clear();
    selectedStickerId = null;
    stickers = nextStickers;
    rebuildStickers();
  }

  function placeSticker(point, before) {
    const sticker = { id: stickerSeq++, kind: selectedStamp.kind, theme: selectedStamp.theme, value: selectedStamp.value, x: point.x / canvas.width, y: point.y / canvas.height, scale: 1, rot: 0, flip: false };
    stickers.push(sticker);
    const element = buildStickerElement(sticker);
    stickerElements.set(sticker.id, element);
    stickerLayer.appendChild(element);
    layoutSticker(element, sticker);
    // The fresh sticker arrives selected, so its handle and delete control are
    // visible the moment it lands: a child sees it can be moved or removed.
    selectSticker(sticker.id);
    commit(before);
    pop(440, .05);
  }

  function deleteSticker(id) {
    if (!stickers.some((sticker) => sticker.id === id)) return;
    const before = captureState();
    stickers = stickers.filter((sticker) => sticker.id !== id);
    rebuildStickers();
    commit(before);
    pop(240, .07);
  }

  function sanitizeStickers(list) {
    if (!Array.isArray(list)) return [];
    // Saved stickers are untrusted (localStorage): keep only well-formed
    // entries and re-clamp everything a gesture could have left behind.
    return list
      .filter((item) => item && (item.kind === "tile" ? typeof item.value === "string" && item.value
        : item.kind === "image" && typeof item.theme === "string" && typeof item.value === "string")
        && Number.isFinite(+item.x) && Number.isFinite(+item.y) && Number.isFinite(+item.scale))
      .map((item) => ({ id: stickerSeq++, kind: item.kind, theme: item.theme, value: item.value,
        x: Math.min(.97, Math.max(.03, +item.x)), y: Math.min(.97, Math.max(.03, +item.y)), scale: clampScale(+item.scale),
        rot: turn ? turn.normalise(item.rot || 0) : 0, flip: item.flip === true }));
  }

  function setStickers(json) {
    let list = [];
    try { list = sanitizeStickers(JSON.parse(json)); } catch (_) {}
    replaceStickerState(list);
  }

  // One gesture at a time: "sticker" drag-or-pinch on the body, "handle" the
  // corner resize grip. A SECOND finger on the same sticker joins the gesture
  // and turns a drag into a pinch; a finger on a different sticker is ignored
  // while this gesture runs. Move and up are watched on the window so a drag
  // keeps working even where pointer capture is unavailable.
  function beginStickerGesture(event, sticker, surface) {
    if (!stickerElements.has(sticker.id)) return;
    const sameSticker = stickerGesture && stickerGesture.id === sticker.id;
    if (stickerGesture && !sameSticker) return;
    event.preventDefault();
    event.stopPropagation();
    stickerPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
    if (stickerGesture) {
      // The joining finger of a pinch. Baseline the finger distance NOW, at
      // the moment the second finger lands: pointer moves arrive one at a
      // time, so the first move would otherwise measure an already-spread
      // pair and resize from a wrong start.
      if (stickerGesture.mode === "drag" && stickerPointers.size >= 2) {
        const [first, second] = [...stickerPointers.values()];
        stickerGesture.pinchStart = Math.max(12, Math.hypot(first.x - second.x, first.y - second.y));
      }
      return;
    }
    selectSticker(sticker.id);
    pop(surface === "handle" ? 500 : 620, .03);
    const element = stickerElements.get(sticker.id);
    const rect = element.getBoundingClientRect();
    const centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    if (surface === "handle") {
      stickerGesture = { id: sticker.id, mode: "handle", before: captureState(), changed: false,
        startScale: sticker.scale, startDistance: Math.max(12, Math.hypot(event.clientX - centre.x, event.clientY - centre.y)) };
      return;
    }
    if (surface === "turn") {
      stickerGesture = { id: sticker.id, mode: "turn", before: captureState(), changed: false,
        centre, startRot: sticker.rot || 0,
        startAngle: Math.atan2(event.clientY - centre.y, event.clientX - centre.x) };
      return;
    }
    stickerGesture = { id: sticker.id, mode: "drag", before: captureState(), changed: false,
      startX: sticker.x, startY: sticker.y, originX: event.clientX, originY: event.clientY };
  }

  function moveStickerGesture(event) {
    if (!stickerGesture || !stickerPointers.has(event.pointerId)) return;
    event.preventDefault();
    const sticker = stickers.find((item) => item.id === stickerGesture.id);
    const element = sticker && stickerElements.get(sticker.id);
    if (!sticker || !element) { stickerGesture = null; stickerPointers.clear(); return; }
    stickerPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (stickerGesture.mode === "handle") {
      const rect = element.getBoundingClientRect();
      const distance = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
      const next = clampScale(stickerGesture.startScale * distance / stickerGesture.startDistance);
      if (next !== sticker.scale) { sticker.scale = next; stickerGesture.changed = true; layoutSticker(element, sticker); }
      return;
    }
    if (stickerGesture.mode === "turn") {
      const angle = Math.atan2(event.clientY - stickerGesture.centre.y, event.clientX - stickerGesture.centre.x);
      const next = stickerGesture.startRot + (angle - stickerGesture.startAngle) * 180 / Math.PI;
      if (next !== sticker.rot) {
        sticker.rot = next;
        stickerGesture.changed = true;
        layoutSticker(element, sticker);
      }
      return;
    }
    // A second finger landing on the sticker turns the drag into a pinch;
    // pinchStart was baselined when that finger landed.
    if (stickerGesture.mode !== "handle" && stickerPointers.size >= 2) {
      const [first, second] = [...stickerPointers.values()];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (stickerGesture.mode === "drag") stickerGesture = { ...stickerGesture, mode: "pinch", pinchStart: stickerGesture.pinchStart || Math.max(12, distance), pinchScale: sticker.scale };
      const next = clampScale(stickerGesture.pinchScale * distance / stickerGesture.pinchStart);
      if (next !== sticker.scale) { sticker.scale = next; stickerGesture.changed = true; layoutSticker(element, sticker); }
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const nextX = stickerGesture.startX + (event.clientX - stickerGesture.originX) / rect.width;
    const nextY = stickerGesture.startY + (event.clientY - stickerGesture.originY) / rect.height;
    if (nextX !== sticker.x || nextY !== sticker.y) {
      // layoutSticker keeps the whole sticker on the page (owner report
      // 2026-10-25); art no longer hangs over the edge under the frame.
      sticker.x = Math.min(.97, Math.max(.03, nextX));
      sticker.y = Math.min(.97, Math.max(.03, nextY));
      if (Math.hypot(event.clientX - stickerGesture.originX, event.clientY - stickerGesture.originY) > 4) stickerGesture.changed = true;
      layoutSticker(element, sticker);
    }
  }

  function endStickerGesture(pointerId) {
    stickerPointers.delete(pointerId);
    if (!stickerGesture) return;
    // A pinch survives while at least two fingers remain (three-finger play);
    // a drag or handle gesture survives while its one finger is down.
    const keep = stickerGesture.mode === "pinch" ? stickerPointers.size >= 2 : stickerPointers.size >= 1;
    if (keep) return;
    const gesture = stickerGesture;
    stickerGesture = null;
    stickerPointers.clear();
    if (gesture.changed) { commit(gesture.before); pop(560, .04); }
  }

  window.addEventListener("pointermove", moveStickerGesture, { passive: false });
  window.addEventListener("pointerup", (event) => endStickerGesture(event.pointerId));
  window.addEventListener("pointercancel", (event) => endStickerGesture(event.pointerId));

  function setTool(next) {
    // The sticker picker opens with the tool and collapses the moment a sticker
    // is chosen, so the whole canvas is free for placement (owner brief). Tapping
    // Stickers again brings the picker back for another choice.
    const sameStampTool = next === "stamp" && tool === "stamp";
    tool = next;
    toolButtons.forEach((button) => button.classList.toggle("is-selected", button.dataset.blankTool === next));
    shapeTray.hidden = next !== "shape";
    if (magicTray) magicTray.hidden = next !== "magic";
    stampPanel.hidden = next === "stamp" ? (sameStampTool ? !stampPanel.hidden : false) : true;
    if (next !== "eraser" && palette) palette.markSelected(color);
    if (next === "eraser" && palette) palette.clearSelection();
    disarmClear();
    showMessage({ brush: "Brush", fill: "Fill a space", shape: "Tap to place a shape", stamp: "Pick a sticker, then tap", magic: magicBrush().message, eraser: "Eraser" }[next]);
  }

  function begin(event) {
    event.preventDefault();
    disarmClear();
    const point = pointFrom(event);
    if (["fill", "shape", "stamp"].includes(tool)) {
      const before = captureState();
      selectSticker(null);
      if (tool === "fill") {
        if (fillAt(point)) { commit(before); pop(280, .05); }
      } else if (tool === "shape") {
        drawShape(point); commit(before); pop(440, .05);
      } else {
        placeSticker(point, before);
      }
      return;
    }
    drawing = true; pointerId = event.pointerId; previousPoint = point; beforeGesture = captureState();
    canvas.setPointerCapture(event.pointerId);
    if (tool === "magic") { magicCarry = 0; magicLine(point, point, true); } else line(point, point, tool === "eraser");
  }

  function move(event) {
    if (!drawing || event.pointerId !== pointerId) return;
    event.preventDefault();
    const point = pointFrom(event);
    if (tool === "magic") magicLine(previousPoint, point); else line(previousPoint, point, tool === "eraser");
    previousPoint = point;
  }

  function end(event) {
    if (!drawing || event.pointerId !== pointerId) return;
    event.preventDefault(); drawing = false; pointerId = null; previousPoint = null;
    commit(beforeGesture); beforeGesture = null;
  }

  function disarmClear() {
    clearArmed = false; clearButton.classList.remove("is-armed");
    window.clearTimeout(clearTimer); clearTimer = null;
  }

  function clearPage() {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let alreadyClean = true;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset] !== 255 || pixels[offset + 1] !== 255 || pixels[offset + 2] !== 255 || pixels[offset + 3] !== 255) {
        alreadyClean = false;
        break;
      }
    }
    if (alreadyClean && !stickers.length) {
      disarmClear();
      speak("blank.already-clean");
      return;
    }
    if (!clearArmed) {
      clearArmed = true; clearButton.classList.add("is-armed");
      clearTimer = window.setTimeout(disarmClear, 6000); speak("blank.clear-arm"); pop(360, .06); return;
    }
    const before = captureState();
    // Remove the live DOM objects synchronously in this confirmed-click
    // handler. The bitmap clear follows, and both halves share `before` as
    // one history entry for Undo/Redo.
    replaceStickerState([]);
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    // A cleared page is a fresh page: it fills the screen as the iPad is held
    // now. Undo brings back the old picture in its own shape.
    fitEmptyPaperToScreen();
    commit(before); disarmClear(); speak("blank.clear-done"); pop(280, .08);
  }

  function buildStampTray(category = "space") {
    stampTray.replaceChildren();
    if (typeof stampTray.scrollTo === "function") stampTray.scrollTo({ left: 0 });
    const entries = category === "abc" ? [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((value) => ({ kind: "tile", value }))
      : category === "numbers" ? [..."0123456789"].map((value) => ({ kind: "tile", value }))
      : THEMED_STAMPS[category].map((value) => ({ kind: "image", theme: category, value }));
    entries.forEach((entry, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "blank-stamp-choice";
      if (entry.kind === "image") { const image = document.createElement("img"); image.src = `./assets/blank-stamps/${entry.theme}-${entry.value}.webp`; image.alt = ""; button.appendChild(image); }
      else {
        button.classList.add("blank-stamp-choice--tile");
        if (tileArt) { const image = document.createElement("img"); image.src = tileArt.url(entry.value); image.alt = ""; button.appendChild(image); }
        else button.textContent = entry.value;
      }
      button.setAttribute("aria-label", `${entry.value.replaceAll("-", " ")} stamp`);
      button.addEventListener("click", () => {
        selectedStamp = entry;
        selectAll(stampTray, "button").forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button));
        // Collapse right away so the full canvas is free for placement; the
        // Stickers button brings the picker back.
        stampPanel.hidden = true;
        showMessage("Now tap the page!");
        pop(520, .04);
      });
      stampTray.appendChild(button);
      if (!index) { selectedStamp = entry; button.classList.add("is-selected"); }
    });
    selectAll(categoryTray, "button").forEach((button) => button.classList.toggle("is-selected", button.dataset.category === category));
  }

  Object.keys(categoryLabels).forEach((category) => {
    const button = document.createElement("button"); button.type = "button"; button.dataset.category = category;
    const picture = document.createElement("span"); picture.className = "blank-pack-picture"; picture.setAttribute("aria-hidden", "true");
    const image = document.createElement("img"); image.alt = "";
    if (THEMED_STAMPS[category]) {
      image.src = `./assets/blank-stamps/${category}-${THEMED_STAMPS[category][0]}.webp`;
    } else {
      const glyph = category === "abc" ? "ABC" : "123";
      image.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72"><rect width="96" height="72" rx="16" fill="#ffd6e8"/><text x="48" y="48" text-anchor="middle" font-family="system-ui,sans-serif" font-size="31" font-weight="900" fill="#7148ad">${glyph}</text></svg>`)}`;
    }
    picture.appendChild(image);
    const label = document.createElement("small"); label.textContent = categoryLabels[category];
    button.appendChild(picture); button.appendChild(label);
    button.setAttribute("aria-label", categoryLabels[category]);
    button.addEventListener("click", () => { buildStampTray(category); pop(520, .04); }); categoryTray.appendChild(button);
  });
  // ---- Magic picker (owner brief, 2026-10-28) ------------------------------
  // Built the way the Shapes tray works: it shows with the Magic tool and
  // stays while the tool is chosen. Every choice is a little canvas painted by
  // that brush's own functions -- a real sample of the stroke, never a text
  // label -- and the chosen one carries the tray's yellow mark.
  function drawMagicPreview(canvas, brush) {
    const preview = canvas.getContext("2d");
    // A steady little random, seeded per brush, so each preview always paints
    // the same pleasant sample of its own stroke.
    let seed = 0;
    for (const letter of brush.id) seed = (seed * 31 + letter.charCodeAt(0)) | 0;
    const env = { color: "#f04455", random: () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) % 10000) / 10000; } };
    preview.save();
    preview.scale(canvas.width / 232, canvas.height / 116);
    const path = [];
    for (let step = 0; step <= 20; step += 1) {
      const share = step / 20;
      path.push({ x: 30 + share * 172, y: 80 - Math.sin(share * Math.PI) * 42 - share * 12 });
    }
    if (brush.stroke) brush.stroke(preview, path[0], path[0], env);
    if (brush.stamp) brush.stamp(preview, path[0], env);
    let carry = 0;
    for (let step = 1; step < path.length; step += 1) {
      if (brush.stroke) brush.stroke(preview, path[step - 1], path[step], env);
      if (brush.stamp) {
        const walk = cgMagicBrushKit.stampsAlong(path[step - 1], path[step], brush.spacing, carry);
        carry = walk.carry;
        walk.points.forEach((point) => brush.stamp(preview, point, env));
      }
    }
    preview.restore();
  }

  function buildMagicTray() {
    if (!magicTray) return;
    magicTray.replaceChildren();
    magicBrushes.forEach((brush) => {
      const button = document.createElement("button");
      button.type = "button"; button.dataset.magic = brush.id;
      button.setAttribute("aria-label", `${brush.label} magic brush`);
      const sample = document.createElement("canvas");
      sample.width = 128; sample.height = 64;
      sample.setAttribute("aria-hidden", "true");
      drawMagicPreview(sample, brush);
      button.appendChild(sample);
      button.addEventListener("click", () => {
        selectedMagic = brush.id;
        selectAll(magicTray, "button").forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button));
        showMessage(brush.message);
        pop(480, .04);
      });
      magicTray.appendChild(button);
      if (brush.id === selectedMagic) button.classList.add("is-selected");
    });
  }
  buildMagicTray();

  buildStampTray();
  if (window.wholeItemTray) { window.wholeItemTray(categoryTray); window.wholeItemTray(stampTray); if (magicTray) window.wholeItemTray(magicTray); }
  Object.entries(THEMED_STAMPS).forEach(([theme, names]) => names.forEach((name) => imageForStamp(theme, name)));

  toolButtons.forEach((button) => button.addEventListener("click", () => setTool(button.dataset.blankTool)));
  selectAll(shapeTray, "button").forEach((button) => button.addEventListener("click", () => {
    selectedShape = button.dataset.shape;
    selectAll(shapeTray, "button").forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button));
    pop(480, .04);
  }));

  const palette = window.buildColorPalette ? window.buildColorPalette(paletteRoot, (button) => {
    color = button.dataset.color; if (tool === "eraser") setTool("brush"); else palette.markSelected(color);
    pop(window.swatchTone ? window.swatchTone(color) : 420, .04);
  }) : null;
  const initialSwatch = document.querySelector("#blankPalette .color-button.is-selected");
  if (initialSwatch) color = initialSwatch.dataset.color;

  undoButton.addEventListener("click", undo); redoButton.addEventListener("click", redo); clearButton.addEventListener("click", clearPage);
  const rotateStickerButton = document.querySelector("#blankStickerRotate");
  const flipStickerButton = document.querySelector("#blankStickerFlip");
  if (rotateStickerButton && holdTurn) {
    let heldSticker = null;
    let heldBefore = null;
    let heldStart = 0;
    holdTurn(rotateStickerButton, {
      begin() {
        heldSticker = stickers.find((item) => item.id === selectedStickerId);
        const element = heldSticker && stickerElements.get(heldSticker.id);
        if (!heldSticker || !element || historyBusy) return false;
        heldBefore = captureState(); heldStart = heldSticker.rot || 0;
        return true;
      },
      turn(degrees) {
        if (!heldSticker) return;
        heldSticker.rot = heldStart + degrees;
        layoutSticker(stickerElements.get(heldSticker.id), heldSticker);
      },
      end({ tap }) {
        if (!heldSticker) return;
        if (tap) heldSticker.rot = heldStart + (turn ? turn.STEP : 15);
        layoutSticker(stickerElements.get(heldSticker.id), heldSticker);
        commit(heldBefore); pop(560, .05);
        heldSticker = null; heldBefore = null;
      }
    });
  }
  if (flipStickerButton) flipStickerButton.addEventListener("click", () => transformSelectedSticker((sticker) => { sticker.flip = !sticker.flip; }, 500));
  canvas.addEventListener("pointerdown", begin); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  function openBlankPage() {
    if (window.stopMenuMusic) window.stopMenuMusic();
    document.querySelector("#galleryScreen").hidden = true; screen.hidden = false;
    let savedImage = null;
    let savedStickers = [];
    let savedSize = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        if (saved.startsWith("data:")) savedImage = saved; // a page saved before stickers existed
        else {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed.image === "string") savedImage = parsed.image;
            if (parsed && Array.isArray(parsed.stickers)) savedStickers = parsed.stickers;
            if (parsed && Number.isFinite(parsed.w) && Number.isFinite(parsed.h)) savedSize = { w: parsed.w, h: parsed.h };
          } catch (_) {}
        }
      }
    } catch (_) {}
    undoStack = []; redoStack = []; historyBusy = false; updateHistoryButtons(); disarmClear(); setTool("brush"); speak("blank.open");
    replaceStickerState([]);
    if (!savedImage) {
      fitEmptyPaperToScreen();
      setStickers(JSON.stringify(savedStickers));
      return;
    }
    // The saved page comes back in its own shape. Its stickers are laid out
    // once that shape is known, so keep-on-page never measures the wrong paper.
    if (savedSize && setPaperShape(savedSize.w, savedSize.h)) {
      restore(savedImage);
      setStickers(JSON.stringify(savedStickers));
      return;
    }
    historyBusy = true; updateHistoryButtons();
    restore(savedImage).then(() => {
      sizeFrameToPaper();
      setStickers(JSON.stringify(savedStickers));
      historyBusy = false; updateHistoryButtons();
    });
  }

  function closeBlankPage() {
    saveState();
    disarmClear(); drawing = false; stickerGesture = null; stickerPointers.clear(); screen.hidden = true; if (window.showColoringGallery) window.showColoringGallery();
  }

  document.querySelector("#blankHome").addEventListener("click", closeBlankPage);
  document.querySelector("#blankVoice").addEventListener("click", () => speak("blank.directions"));
  // Turning the iPad never redraws a drawing: the paper is rescaled whole,
  // now and once more after iPadOS has settled the final size. (An empty
  // paper takes the new screen shape straight away.)
  function refitPaper() {
    if (screen.hidden) return;
    if (drawing || historyBusy) sizeFrameToPaper();
    else fitCanvasToPage();
  }
  window.addEventListener("resize", () => {
    refitPaper();
    window.clearTimeout(fitCanvasToPage.timer);
    fitCanvasToPage.timer = window.setTimeout(refitPaper, 160);
  });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape" && !screen.hidden) closeBlankPage(); });
  window.openBlankPage = openBlankPage;
})();

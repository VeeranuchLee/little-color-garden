"use strict";

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

  const THEMED_STAMPS = {
    space: ["ringed-planet", "smiling-star", "rocket", "crescent-moon", "blue-planet", "comet", "astronaut-helmet", "ufo", "sun", "constellation", "satellite", "telescope", "galaxy", "astronaut-boot", "lunar-rover"],
    princess: ["crown", "wand", "glass-slipper", "gown", "heart-tiara", "carriage", "royal-kitten", "rose-bouquet", "gem-heart", "mirror", "sceptre", "pearl-necklace", "hand-fan", "royal-pony", "teacup"],
    mermaid: ["tail", "seashell", "pearl-oyster", "seahorse", "coral", "starfish", "treasure-chest", "dolphin", "tropical-fish", "sea-crown", "trident", "hair-comb", "harp", "kelp", "anchor"],
    castle: ["rainbow-castle", "turret", "magic-door", "magic-key", "crystal-ball", "dragon", "unicorn", "potion", "spell-book", "crystal", "wizard-hat", "cauldron", "broom", "shield", "lantern"],
    animals: ["cat", "puppy", "bunny", "panda", "fox", "owl", "hamster", "turtle", "duck", "koala"],
    ocean: ["fish", "octopus", "whale", "starfish", "shell", "crab", "seahorse", "dolphin", "jellyfish", "coral"],
    food: ["cupcake", "ice-cream", "donut", "strawberry", "lollipop", "cookie", "cake-slice", "watermelon", "cherries", "candy"],
    vehicles: ["car", "bus", "train", "plane", "boat", "bicycle", "fire-truck", "tractor", "hot-air-balloon", "scooter"]
  };
  const categoryLabels = { space: "Space", princess: "Princess", mermaid: "Mermaid", castle: "Magic Castle", animals: "Animals & Pets", ocean: "Ocean", food: "Sweets & Food", vehicles: "Vehicles", abc: "ABC", numbers: "123" };
  const stampImages = new Map();
  let tool = "brush";
  let color = "#f04455";
  let selectedShape = "circle";
  let selectedStamp = { kind: "image", theme: "space", value: "ringed-planet" };
  let drawing = false;
  let pointerId = null;
  let previousPoint = null;
  let magicStep = 0;
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
  let stickerGesture = null; // { id, mode: "drag"|"pinch"|"handle", ... }
  const stickerPointers = new Map(); // pointerId -> { x, y } during a gesture
  const clampScale = (scale) => Math.min(STICKER_MAX_SCALE, Math.max(STICKER_MIN_SCALE, scale));

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

  // One undo entry is the whole page: the paper bitmap plus every sticker.
  function captureState() { return { image: snapshot(), stickers: stickerSnapshot() }; }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ image: snapshot(), stickers })); } catch (_) {}
  }

  function updateHistoryButtons() {
    undoButton.disabled = historyBusy || !undoStack.length;
    redoButton.disabled = historyBusy || !redoStack.length;
  }

  function commit(before) {
    // Callers that only touch the paper pass a bare image; the stickers ride
    // along unchanged. Sticker gestures pass a full captureState().
    undoStack.push(typeof before === "string" ? { image: before, stickers: stickerSnapshot() } : before);
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
    setStickers(entry.stickers);
    updateHistoryButtons();
    await restore(entry.image);
    historyBusy = false;
    updateHistoryButtons();
    saveState();
    pop(440, 0.06);
  }

  function fitCanvasToPage(contents = null) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return;
    // The Blank page deliberately follows the available viewport instead of
    // inheriting the Coloring Book's fixed 2:3 sheet. Match the backing store
    // to that visible shape so circles and trimmed stamps stay undistorted.
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.round(rect.width * scale);
    const height = Math.round(rect.height * scale);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    if (contents) restore(contents);
    // Sticker centres are fractions of the page, but widths are pixels: place
    // them again for the new canvas size.
    layoutAllStickers();
  }

  function restore(dataUrl) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
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

  function magicLine(from, to) {
    const colors = ["#ff5f87", "#ff9f43", "#ffe04d", "#49cf7d", "#52b7ff", "#9667ed"];
    context.save();
    context.lineCap = "round";
    colors.forEach((stripe, index) => {
      context.strokeStyle = stripe;
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(from.x, from.y + (index - 2.5) * 7);
      context.lineTo(to.x, to.y + (index - 2.5) * 7);
      context.stroke();
    });
    magicStep += 1;
    if (magicStep % 3 === 0) {
      context.fillStyle = "#fff7a8";
      context.strokeStyle = "#7b5bd6";
      context.lineWidth = 3;
      context.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const angle = -Math.PI / 2 + i * Math.PI / 4;
        const radius = i % 2 ? 5 : 13;
        const x = to.x + Math.cos(angle) * radius;
        const y = to.y + Math.sin(angle) * radius;
        if (!i) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath(); context.fill(); context.stroke();
    }
    context.restore();
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

  function layoutSticker(element, sticker) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.min(rect.width, rect.height) * DEFAULT_STAMP_SHARE * sticker.scale;
    element.style.width = `${Math.round(width)}px`;
    element.style.left = `${sticker.x * 100}%`;
    element.style.top = `${sticker.y * 100}%`;
    // Tiles size their glyph with the sticker; image stickers keep their own
    // aspect ratio by height:auto.
    if (sticker.kind === "tile") element.style.fontSize = `${Math.round(width * .58)}px`;
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
  }

  function buildStickerElement(sticker) {
    const element = document.createElement("div");
    element.className = `blank-sticker${sticker.kind === "tile" ? " blank-sticker--tile" : ""}`;
    element.dataset.stickerId = String(sticker.id);
    element.setAttribute("role", "img");
    if (sticker.kind === "tile") {
      const glyph = document.createElement("span");
      glyph.className = "blank-sticker__glyph";
      glyph.textContent = sticker.value;
      element.appendChild(glyph);
      element.setAttribute("aria-label", `${sticker.value} sticker`);
    } else {
      const image = document.createElement("img");
      image.src = `./assets/blank-stamps/${sticker.theme}-${sticker.value}.webp`;
      image.alt = ""; image.draggable = false;
      element.appendChild(image);
      element.setAttribute("aria-label", `${sticker.value.replaceAll("-", " ")} sticker`);
    }
    // The delete control only exists for the selected sticker (CSS shows it),
    // and it stops the pointer before the sticker can read it as a drag.
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "blank-sticker__delete";
    remove.setAttribute("aria-label", "Remove this sticker");
    remove.textContent = "🗑️";
    remove.addEventListener("pointerdown", (event) => event.stopPropagation());
    remove.addEventListener("click", () => deleteSticker(sticker.id));
    const handle = document.createElement("span");
    handle.className = "blank-sticker__handle";
    handle.setAttribute("aria-hidden", "true");
    element.appendChild(remove);
    element.appendChild(handle);

    element.addEventListener("pointerdown", (event) => beginStickerGesture(event, sticker, "sticker"));
    handle.addEventListener("pointerdown", (event) => beginStickerGesture(event, sticker, "handle"));
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
    const sticker = { id: stickerSeq++, kind: selectedStamp.kind, theme: selectedStamp.theme, value: selectedStamp.value, x: point.x / canvas.width, y: point.y / canvas.height, scale: 1 };
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
        x: Math.min(.97, Math.max(.03, +item.x)), y: Math.min(.97, Math.max(.03, +item.y)), scale: clampScale(+item.scale) }));
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
      // Keep the centre on the page so a sticker is always grabbable again;
      // art may hang over the edge, exactly like a real sticker on paper.
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
    stampPanel.hidden = next === "stamp" ? (sameStampTool ? !stampPanel.hidden : false) : true;
    if (next !== "eraser" && palette) palette.markSelected(color);
    if (next === "eraser" && palette) palette.clearSelection();
    disarmClear();
    showMessage({ brush: "Brush", fill: "Fill a space", shape: "Tap to place a shape", stamp: "Pick a sticker, then tap", magic: "Rainbow magic!", eraser: "Eraser" }[next]);
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
    if (tool === "magic") magicLine(point, point); else line(point, point, tool === "eraser");
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
    commit(before); disarmClear(); speak("blank.clear-done"); pop(280, .08);
  }

  function buildStampTray(category = "space") {
    stampTray.replaceChildren();
    const entries = category === "abc" ? [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((value) => ({ kind: "tile", value }))
      : category === "numbers" ? [..."0123456789"].map((value) => ({ kind: "tile", value }))
      : THEMED_STAMPS[category].map((value) => ({ kind: "image", theme: category, value }));
    entries.forEach((entry, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "blank-stamp-choice";
      if (entry.kind === "image") { const image = document.createElement("img"); image.src = `./assets/blank-stamps/${entry.theme}-${entry.value}.webp`; image.alt = ""; button.appendChild(image); }
      else { button.textContent = entry.value; button.classList.add("blank-stamp-choice--tile"); }
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
  buildStampTray();
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
  canvas.addEventListener("pointerdown", begin); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  function openBlankPage() {
    if (window.stopMenuMusic) window.stopMenuMusic();
    document.querySelector("#galleryScreen").hidden = true; screen.hidden = false;
    let savedImage = null;
    let savedStickers = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        if (saved.startsWith("data:")) savedImage = saved; // a page saved before stickers existed
        else {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed.image === "string") savedImage = parsed.image;
            if (parsed && Array.isArray(parsed.stickers)) savedStickers = parsed.stickers;
          } catch (_) {}
        }
      }
    } catch (_) {}
    fitCanvasToPage();
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    if (savedImage) restore(savedImage);
    setStickers(JSON.stringify(savedStickers));
    undoStack = []; redoStack = []; historyBusy = false; updateHistoryButtons(); disarmClear(); setTool("brush"); speak("blank.open");
  }

  function closeBlankPage() {
    saveState();
    disarmClear(); drawing = false; stickerGesture = null; stickerPointers.clear(); screen.hidden = true; if (window.showColoringGallery) window.showColoringGallery();
  }

  document.querySelector("#blankHome").addEventListener("click", closeBlankPage);
  document.querySelector("#blankVoice").addEventListener("click", () => speak("blank.directions"));
  window.addEventListener("resize", () => {
    if (screen.hidden) return;
    window.clearTimeout(fitCanvasToPage.timer);
    const contents = snapshot();
    fitCanvasToPage.timer = window.setTimeout(() => fitCanvasToPage(contents), 120);
  });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape" && !screen.hidden) closeBlankPage(); });
  window.openBlankPage = openBlankPage;
})();

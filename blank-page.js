"use strict";

// Blank Coloring Page: a small, child-first drawing toy. Every canvas mutation
// is one history action; stamps and shapes repeat-place until another choice is
// made. There are deliberately no layers, selections, transforms, or text input.
(() => {
  const screen = document.querySelector("#blankScreen");
  if (!screen) return;

  const canvas = document.querySelector("#blankCanvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
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

  const THEMED_STAMPS = {
    space: ["ringed-planet", "smiling-star", "rocket", "crescent-moon", "blue-planet", "comet", "astronaut-helmet", "ufo", "sun", "constellation"],
    princess: ["crown", "wand", "glass-slipper", "gown", "heart-tiara", "carriage", "royal-kitten", "rose-bouquet", "gem-heart", "mirror"],
    mermaid: ["tail", "seashell", "pearl-oyster", "seahorse", "coral", "starfish", "treasure-chest", "dolphin", "tropical-fish", "sea-crown"],
    castle: ["rainbow-castle", "turret", "magic-door", "magic-key", "crystal-ball", "dragon", "unicorn", "potion", "spell-book", "crystal"]
  };
  const categoryLabels = { space: "Space", princess: "Princess", mermaid: "Mermaid", castle: "Magic Castle", abc: "ABC", numbers: "123" };
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
  let clearArmed = false;
  let clearTimer = null;

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

  function updateHistoryButtons() {
    undoButton.disabled = !undoStack.length;
    redoButton.disabled = !redoStack.length;
  }

  function commit(before) {
    undoStack.push(before);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
    updateHistoryButtons();
    try { localStorage.setItem(STORAGE_KEY, snapshot()); } catch (_) {}
  }

  async function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    await restore(undoStack.pop());
    updateHistoryButtons();
    try { localStorage.setItem(STORAGE_KEY, snapshot()); } catch (_) {}
    pop(300, 0.06);
  }

  async function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    await restore(redoStack.pop());
    updateHistoryButtons();
    try { localStorage.setItem(STORAGE_KEY, snapshot()); } catch (_) {}
    pop(440, 0.06);
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

  function drawStamp(point) {
    const stampSize = Math.round(Math.min(canvas.width, canvas.height) * DEFAULT_STAMP_SHARE);
    if (selectedStamp.kind === "tile") {
      const size = stampSize;
      const gradient = context.createLinearGradient(point.x, point.y - size / 2, point.x, point.y + size / 2);
      gradient.addColorStop(0, "#fff7ad"); gradient.addColorStop(1, "#ffb8dc");
      context.save(); context.fillStyle = gradient; context.strokeStyle = "#7453bd"; context.lineWidth = 8;
      context.beginPath();
      // roundRect is Safari 16.4+; a 9.7" iPad can be stuck on an older iOS, so
      // fall back to a plain square tile rather than throwing and silently
      // dropping every ABC/123 stamp placement.
      if (typeof context.roundRect === "function") context.roundRect(point.x - size / 2, point.y - size / 2, size, size, 24);
      else context.rect(point.x - size / 2, point.y - size / 2, size, size);
      context.fill(); context.stroke();
      context.fillStyle = color; context.font = `bold ${Math.round(size * .64)}px ui-rounded, system-ui, sans-serif`; context.textAlign = "center"; context.textBaseline = "middle";
      context.fillText(selectedStamp.value, point.x, point.y + 4); context.restore();
      return true;
    }
    const image = imageForStamp(selectedStamp.theme, selectedStamp.value);
    if (!image.complete || !image.naturalWidth) return false;
    const scale = stampSize / Math.max(image.naturalWidth, image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, point.x - width / 2, point.y - height / 2, width, height);
    return true;
  }

  function setTool(next) {
    tool = next;
    toolButtons.forEach((button) => button.classList.toggle("is-selected", button.dataset.blankTool === next));
    shapeTray.hidden = next !== "shape";
    stampPanel.hidden = next !== "stamp";
    if (next !== "eraser" && palette) palette.markSelected(color);
    if (next === "eraser" && palette) palette.clearSelection();
    disarmClear();
    showMessage({ brush: "Brush", fill: "Fill a space", shape: "Tap to place a shape", stamp: "Pick a stamp, then tap", magic: "Rainbow magic!", eraser: "Eraser" }[next]);
  }

  function begin(event) {
    event.preventDefault();
    disarmClear();
    const point = pointFrom(event);
    if (["fill", "shape", "stamp"].includes(tool)) {
      const before = snapshot();
      const changed = tool === "fill" ? fillAt(point) : tool === "shape" ? (drawShape(point), true) : drawStamp(point);
      if (changed) { commit(before); pop(tool === "fill" ? 280 : 440, .05); }
      return;
    }
    drawing = true; pointerId = event.pointerId; previousPoint = point; beforeGesture = snapshot();
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
    if (alreadyClean) {
      disarmClear();
      speak("blank.already-clean");
      return;
    }
    if (!clearArmed) {
      clearArmed = true; clearButton.classList.add("is-armed");
      clearTimer = window.setTimeout(disarmClear, 6000); speak("blank.clear-arm"); pop(360, .06); return;
    }
    const before = snapshot();
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
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) {}
    fitCanvasToPage();
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    if (saved) restore(saved);
    undoStack = []; redoStack = []; updateHistoryButtons(); disarmClear(); setTool("brush"); speak("blank.open");
  }

  function closeBlankPage() {
    try { localStorage.setItem(STORAGE_KEY, snapshot()); } catch (_) {}
    disarmClear(); drawing = false; screen.hidden = true; if (window.showColoringGallery) window.showColoringGallery();
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

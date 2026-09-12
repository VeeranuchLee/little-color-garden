"use strict";

const PAGES = [
  { id: "solar-system", file: "solar-system.png", voice: "the happy planets", card: "#fff3a8", background: "space-soft.jpg" },
  { id: "space-kid", file: "space-kid.png", voice: "the little astronaut", card: "#c4efff", background: "saturn.jpg" },
  { id: "moon-flag", file: "moon-flag.png", voice: "the moon explorer", card: "#d5ccff", background: "moon.jpg" },
  { id: "mars-rover", file: "mars-rover.png", voice: "the friendly space robot", card: "#ffd0ae", background: "moon.jpg" },
  { id: "pink-princess", file: "pink-princess.png", voice: "the heart princess", card: "#ffd5eb", background: "rainbow-castle.jpg" },
  { id: "magic-princess", file: "magic-princess.png", voice: "the magic princess", card: "#eee0ff", background: "rainbow-castle.jpg" },
  { id: "mermaid-princess", file: "mermaid-princess.png", voice: "the ocean princess", card: "#c7f4ef", background: "rainbow-castle.jpg" },
  { id: "bird-princess", file: "bird-princess.png", voice: "the bird princess", card: "#ffe6ca", background: "forest-friends.jpg" },
  { id: "hibiscus", file: "hibiscus.png", voice: "the hibiscus flowers", card: "#ffd1d0", background: "spring-meadow.jpg" },
  { id: "ginger-lily", file: "ginger-lily.png", voice: "the white flowers", card: "#ecf7c8", background: "spring-meadow.jpg" },
  { id: "blue-pea", file: "blue-pea.png", voice: "the blue pea flowers", card: "#d4ddff", background: "spring-meadow.jpg" },
  { id: "ylang-ylang", file: "ylang-ylang.png", voice: "the yellow flowers", card: "#fff4b9", background: "spring-meadow.jpg" }
];

const COLORS = [
  { name: "red", value: "#f04455" },
  { name: "orange", value: "#ff8a35" },
  { name: "yellow", value: "#ffd93d" },
  { name: "green", value: "#51c86b" },
  { name: "turquoise", value: "#31c8c6" },
  { name: "blue", value: "#3c83ef" },
  { name: "purple", value: "#8257df" },
  { name: "pink", value: "#f46eb3" },
  { name: "brown", value: "#9b623c" },
  { name: "black", value: "#30313b" }
];

const galleryScreen = document.querySelector("#galleryScreen");
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
let currentColor = COLORS[0].value;
let currentColorName = COLORS[0].name;
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

function speak(message) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 0.9;
  utterance.pitch = 1.2;
  utterance.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const friendlyVoice = voices.find((voice) => /^en/i.test(voice.lang) && /samantha|karen|moira|female|serena|ava/i.test(voice.name));
  if (friendlyVoice) utterance.voice = friendlyVoice;
  window.speechSynthesis.speak(utterance);
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

function buildPalette() {
  COLORS.forEach((color, index) => {
    const button = document.createElement("button");
    button.className = `color-button${index === 0 ? " is-selected" : ""}`;
    button.type = "button";
    button.style.setProperty("--swatch", color.value);
    button.setAttribute("aria-label", color.name);
    button.dataset.color = color.value;
    button.dataset.name = color.name;
    button.addEventListener("click", () => selectColor(button, true));
    colorPalette.appendChild(button);
  });
}

function selectColor(button, announce = false) {
  document.querySelectorAll(".color-button").forEach((item) => item.classList.toggle("is-selected", item === button));
  eraserButton.classList.remove("is-selected");
  currentColor = button.dataset.color;
  currentColorName = button.dataset.name;
  usingEraser = false;
  tinyPop(460 + COLORS.findIndex((item) => item.value === currentColor) * 45);
  if (announce) showMessage(currentColorName[0].toUpperCase() + currentColorName.slice(1));
}

function openPage(page) {
  stopGalleryMusic();
  activePage = page;
  galleryScreen.hidden = true;
  coloringScreen.hidden = false;
  canvasLoader.hidden = false;
  coloringScreen.style.setProperty("--game-bg", `url("./assets/backgrounds/${page.background}")`);
  document.body.style.background = page.card;
  disarmClear();
  clearedBackup = null;
  referenceVisible = loadReferencePref();
  applyReferenceState();
  referenceImage.src = `./assets/references/${page.id}.jpg`;
  strokes = loadStrokes(page.id);
  lineImage = new Image();
  lineImage.onload = () => {
    paintCanvas.width = lineImage.naturalWidth;
    paintCanvas.height = lineImage.naturalHeight;
    paintLayer.width = paintCanvas.width;
    paintLayer.height = paintCanvas.height;
    const lineCanvas = document.createElement("canvas");
    lineCanvas.width = paintCanvas.width;
    lineCanvas.height = paintCanvas.height;
    const lineContext = lineCanvas.getContext("2d", { willReadFrequently: true });
    lineContext.drawImage(lineImage, 0, 0, paintCanvas.width, paintCanvas.height);
    linePixels = lineContext.getImageData(0, 0, paintCanvas.width, paintCanvas.height).data;
    rebuildPaintLayer();
    composeCanvas();
    canvasLoader.hidden = true;
    undoButton.disabled = strokes.length === 0;
    speak(`Let's color ${page.voice}! Pick a color, then draw with your finger.`);
  };
  lineImage.onerror = () => {
    canvasLoader.hidden = true;
    speak("Oops. This picture needs a little help loading.");
  };
  lineImage.src = `./assets/pages/${page.file}`;
}

function goHome() {
  saveStrokes();
  disarmClear();
  clearedBackup = null;
  activePage = null;
  lineImage = null;
  strokes = [];
  coloringScreen.hidden = true;
  galleryScreen.hidden = false;
  document.body.style.background = "#8a6bea";
  speak("Pick a picture to color.");
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
    strokes.push(action);
    applyAction(action);
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
      floodFill(stroke.point, stroke.color);
      return;
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

function floodFill(point, color) {
  if (!linePixels) return;
  const width = paintLayer.width;
  const height = paintLayer.height;
  const startX = Math.max(0, Math.min(width - 1, Math.round(point.x)));
  const startY = Math.max(0, Math.min(height - 1, Math.round(point.y)));
  const output = paintContext.getImageData(0, 0, width, height);
  const rgba = color.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16));
  const visited = new Uint8Array(width * height);
  const stack = [startY * width + startX];
  const isBoundary = (index) => {
    const offset = index * 4;
    return linePixels[offset + 3] > 90 && linePixels[offset] + linePixels[offset + 1] + linePixels[offset + 2] < 430;
  };
  while (stack.length) {
    const index = stack.pop();
    if (visited[index] || isBoundary(index)) continue;
    visited[index] = 1;
    const offset = index * 4;
    output.data[offset] = rgba[0]; output.data[offset + 1] = rgba[1]; output.data[offset + 2] = rgba[2]; output.data[offset + 3] = 255;
    const x = index % width;
    if (x) stack.push(index - 1);
    if (x < width - 1) stack.push(index + 1);
    if (index >= width) stack.push(index - width);
    if (index < width * (height - 1)) stack.push(index + width);
  }
  paintContext.putImageData(output, 0, 0);
}

function composeCanvas() {
  if (!lineImage) return;
  visibleContext.save();
  visibleContext.globalCompositeOperation = "source-over";
  visibleContext.fillStyle = "#fff";
  visibleContext.fillRect(0, 0, paintCanvas.width, paintCanvas.height);
  visibleContext.drawImage(paintLayer, 0, 0);
  visibleContext.globalCompositeOperation = "multiply";
  visibleContext.drawImage(lineImage, 0, 0, paintCanvas.width, paintCanvas.height);
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
    speak("Here it is again!");
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
  speak("All clean! Tap the yellow arrow if you want it back.");
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
  speak("Tap the broom again to clean the whole picture.");
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
    speak("The picture is already clean.");
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
  const colors = COLORS.slice(0, 8).map((item) => item.value);
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
  speak("Wow! Your picture is beautiful!");
  window.setTimeout(() => celebration.replaceChildren(), 3900);
}

function applyReferenceState() {
  canvasStage.classList.toggle("is-split", referenceVisible);
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
    speak("Here is one way it can look. You can color it your own way!");
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
document.querySelector("#voiceButton").addEventListener("click", () => speak("Pick a color, then draw with your finger. Tap the little picture button to see the finished picture next to yours."));
document.querySelector("#homeButton").addEventListener("click", goHome);
document.querySelector("#finishButton").addEventListener("click", celebrate);
undoButton.addEventListener("click", undoLastStroke);
clearButton.addEventListener("click", handleClearTap);

peekButton.addEventListener("click", toggleReference);

eraserButton.addEventListener("click", () => {
  selectTool("brush");
  usingEraser = true;
  document.querySelectorAll(".color-button").forEach((button) => button.classList.remove("is-selected"));
  eraserButton.classList.add("is-selected");
  tinyPop(340);
  showMessage("Eraser");
});

function selectTool(tool) {
  currentTool = tool;
  document.querySelectorAll(".primary-tool[data-tool]").forEach((button) => button.classList.toggle("is-selected", button.dataset.tool === tool));
  document.querySelectorAll(".tool-options").forEach((options) => { options.hidden = options.dataset.options !== tool; });
  colorPalette.hidden = false;
  if (tool !== "brush") usingEraser = false;
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

buildGallery();
buildPalette();
updateMusicButton(false);

if (
  "serviceWorker" in navigator &&
  location.protocol !== "file:" &&
  !["localhost", "127.0.0.1"].includes(location.hostname)
) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

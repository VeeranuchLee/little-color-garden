"use strict";

const PAGES = [
  { id: "solar-system", file: "solar-system.png", voice: "the happy planets", card: "#fff3a8" },
  { id: "space-kid", file: "space-kid.png", voice: "the little astronaut", card: "#c4efff" },
  { id: "moon-flag", file: "moon-flag.png", voice: "the moon explorer", card: "#d5ccff" },
  { id: "mars-rover", file: "mars-rover.png", voice: "the friendly space robot", card: "#ffd0ae" },
  { id: "pink-princess", file: "pink-princess.png", voice: "the heart princess", card: "#ffd5eb" },
  { id: "magic-princess", file: "magic-princess.png", voice: "the magic princess", card: "#eee0ff" },
  { id: "mermaid-princess", file: "mermaid-princess.png", voice: "the ocean princess", card: "#c7f4ef" },
  { id: "bird-princess", file: "bird-princess.png", voice: "the bird princess", card: "#ffe6ca" },
  { id: "hibiscus", file: "hibiscus.png", voice: "the hibiscus flowers", card: "#ffd1d0" },
  { id: "ginger-lily", file: "ginger-lily.png", voice: "the white flowers", card: "#ecf7c8" },
  { id: "blue-pea", file: "blue-pea.png", voice: "the blue pea flowers", card: "#d4ddff" },
  { id: "ylang-ylang", file: "ylang-ylang.png", voice: "the yellow flowers", card: "#fff4b9" }
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
const celebration = document.querySelector("#celebration");

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
let holdTimer = null;
let frameRequested = false;

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
  if (announce) speak(currentColorName);
}

function openPage(page) {
  activePage = page;
  galleryScreen.hidden = true;
  coloringScreen.hidden = false;
  canvasLoader.hidden = false;
  document.body.style.background = page.card;
  strokes = loadStrokes(page.id);
  lineImage = new Image();
  lineImage.onload = () => {
    paintCanvas.width = lineImage.naturalWidth;
    paintCanvas.height = lineImage.naturalHeight;
    paintLayer.width = paintCanvas.width;
    paintLayer.height = paintCanvas.height;
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
  event.preventDefault();
  drawing = true;
  activePointerId = event.pointerId;
  paintCanvas.setPointerCapture(event.pointerId);
  const point = canvasPoint(event);
  currentStroke = {
    color: currentColor,
    size: currentSize,
    erase: usingEraser,
    points: [point]
  };
  drawSegment(currentStroke, point, point);
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
  drawSegment(currentStroke, previous, point);
  requestCompose();
}

function endStroke(event) {
  if (!drawing || event.pointerId !== activePointerId || !currentStroke) return;
  event.preventDefault();
  strokes.push(currentStroke);
  currentStroke = null;
  drawing = false;
  activePointerId = null;
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
  strokes.forEach((stroke) => {
    if (stroke.points.length === 1) {
      drawSegment(stroke, stroke.points[0], stroke.points[0]);
      return;
    }
    stroke.points.forEach((point, index) => {
      if (index) drawSegment(stroke, stroke.points[index - 1], point);
    });
  });
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
  if (!strokes.length) return;
  strokes.pop();
  rebuildPaintLayer();
  composeCanvas();
  undoButton.disabled = strokes.length === 0;
  saveStrokes();
  tinyPop(300, 0.08);
}

function clearPicture() {
  strokes = [];
  rebuildPaintLayer();
  composeCanvas();
  undoButton.disabled = true;
  saveStrokes();
  speak("All clean. Let's make a new picture!");
}

function startClearHold(event) {
  event.preventDefault();
  clearButton.classList.add("is-holding");
  if (!strokes.length) {
    speak("The picture is already clean.");
    return;
  }
  holdTimer = window.setTimeout(() => {
    clearButton.classList.remove("is-holding");
    holdTimer = null;
    clearPicture();
  }, 850);
}

function cancelClearHold() {
  clearButton.classList.remove("is-holding");
  if (holdTimer) {
    window.clearTimeout(holdTimer);
    holdTimer = null;
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

function storageKey() {
  return activePage ? `little-color-garden:${activePage.id}` : "";
}

function saveStrokes() {
  if (!activePage) return;
  try {
    const trimmed = strokes.slice(-180).map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }))
    }));
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

document.querySelector("#galleryVoiceButton").addEventListener("click", () => speak("Pick a picture to color."));
document.querySelector("#voiceButton").addEventListener("click", () => speak("Pick a color, then draw with your finger. You can use the eraser or the undo arrow too."));
document.querySelector("#homeButton").addEventListener("click", goHome);
document.querySelector("#finishButton").addEventListener("click", celebrate);
undoButton.addEventListener("click", undoLastStroke);

clearButton.addEventListener("pointerdown", startClearHold);
clearButton.addEventListener("pointerup", cancelClearHold);
clearButton.addEventListener("pointercancel", cancelClearHold);
clearButton.addEventListener("pointerleave", cancelClearHold);

eraserButton.addEventListener("click", () => {
  usingEraser = true;
  document.querySelectorAll(".color-button").forEach((button) => button.classList.remove("is-selected"));
  eraserButton.classList.add("is-selected");
  tinyPop(340);
  speak("Eraser");
});

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
  if (event.key === "Escape" && !coloringScreen.hidden) goHome();
});

buildGallery();
buildPalette();

if (
  "serviceWorker" in navigator &&
  location.protocol !== "file:" &&
  !["localhost", "127.0.0.1"].includes(location.hostname)
) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

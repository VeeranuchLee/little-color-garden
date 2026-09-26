"use strict";

// Blank Page — free drawing on a white page, the first card of Coloring
// (owner brief, 2026-09-14). The owner's tool list is the whole design:
// "basic brush, eraser, clear page ... do not turn this into a complex art
// studio." So there is exactly one brush (the app's default medium size, no
// size buttons), an eraser, and an armed clear. No undo, no fill, no stamps.
//
// The module is self-contained the way pixel-mode.js is: it never touches the
// coloring-page screen's state, and reuses only what app.js already exposes
// on `window` (`speak`, `tinyPop`, `stopMenuMusic`, `showColoringGallery`,
// `buildColorPalette`). The stroke engine mirrors app.js's brush path --
// round caps, `destination-out` for the eraser, a transparent paint layer
// composed over white -- so a saved Blank Page stroke is the same shape a
// coloring page saves.
(() => {
  const blankScreen = document.querySelector("#blankScreen");
  if (!blankScreen) return;

  const canvas = document.querySelector("#blankCanvas");
  const visibleContext = canvas.getContext("2d", { alpha: false });
  const message = document.querySelector("#blankMessage");
  const brushButton = document.querySelector("#blankBrush");
  const eraserToolButton = document.querySelector("#blankEraser");
  const clearButton = document.querySelector("#blankClear");

  const speak = typeof window.speak === "function" ? window.speak : () => {};
  const pop = typeof window.tinyPop === "function" ? window.tinyPop : () => {};
  const stopMusic = typeof window.stopMenuMusic === "function" ? window.stopMenuMusic : () => {};
  const showColoringGallery =
    typeof window.showColoringGallery === "function" ? window.showColoringGallery : () => {};
  const buildColorPalette =
    typeof window.buildColorPalette === "function" ? window.buildColorPalette : null;

  // Same key shape as every other saved surface in this app, under its own
  // name; nothing else reads or writes it.
  const STORAGE_KEY = "little-color-garden:blank-page";
  const BRUSH_SIZE = 26;

  const paintLayer = document.createElement("canvas");
  const paintContext = paintLayer.getContext("2d");
  paintLayer.width = canvas.width;
  paintLayer.height = canvas.height;

  let strokes = [];
  let drawing = false;
  let activePointerId = null;
  let currentStroke = null;
  let currentColor = "#f04455";
  let usingEraser = false;
  let clearArmed = false;
  let clearArmTimer = null;
  let frameRequested = false;

  function showMessage(text) {
    message.textContent = text;
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => { message.textContent = ""; }, 3200);
  }

  // --- drawing -----------------------------------------------------------
  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
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

  function composeCanvas() {
    visibleContext.fillStyle = "#fff";
    visibleContext.fillRect(0, 0, canvas.width, canvas.height);
    visibleContext.drawImage(paintLayer, 0, 0);
  }

  function requestCompose() {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(() => {
      composeCanvas();
      frameRequested = false;
    });
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
    composeCanvas();
  }

  function beginStroke(event) {
    if (drawing) return;
    event.preventDefault();
    drawing = true;
    activePointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    if (clearArmed) disarmClear();
    currentStroke = { type: "brush", color: currentColor, size: BRUSH_SIZE, erase: usingEraser, points: [canvasPoint(event)] };
    drawSegment(currentStroke, currentStroke.points[0], currentStroke.points[0]);
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
    saveStrokes();
    requestCompose();
  }

  // --- clear (armed, like every other broom in this app) ------------------
  function armClear() {
    clearArmed = true;
    clearButton.classList.add("is-armed");
    if (clearArmTimer) window.clearTimeout(clearArmTimer);
    clearArmTimer = window.setTimeout(disarmClear, 6000);
    pop(360);
    speak("blank.clear-arm");
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
      speak("blank.already-clean");
      return;
    }
    if (clearArmed) {
      disarmClear();
      strokes = [];
      rebuildPaintLayer();
      saveStrokes();
      pop(320, 0.07);
      window.setTimeout(() => pop(240, 0.09), 90);
      speak("blank.clear-done");
    } else {
      armClear();
    }
  }

  // --- persistence --------------------------------------------------------
  function saveStrokes() {
    try {
      const trimmed = strokes.slice(-180).map((stroke) => ({
        ...stroke,
        points: stroke.points.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }))
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (_) {
      // Storage may be disabled; this session still works.
    }
  }

  function loadStrokes() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((stroke) => Array.isArray(stroke.points) && stroke.points.length) : [];
    } catch (_) {
      return [];
    }
  }

  // --- tools ---------------------------------------------------------------
  function selectBrush() {
    usingEraser = false;
    brushButton.classList.add("is-selected");
    eraserToolButton.classList.remove("is-selected");
    // Coming back from the eraser restores the ring it cleared (owner:
    // "selected color must be visually obvious").
    if (palette) palette.markSelected(currentColor);
  }

  function selectEraser() {
    usingEraser = true;
    brushButton.classList.remove("is-selected");
    eraserToolButton.classList.add("is-selected");
    if (palette) palette.clearSelection();
    pop(340);
    showMessage("Eraser");
  }

  const palette = buildColorPalette
    ? buildColorPalette(document.querySelector("#blankPalette"), (button) => {
        currentColor = button.dataset.color;
        selectBrush();
        if (typeof window.swatchTone === "function") pop(window.swatchTone(currentColor));
        const name = button.dataset.name;
        showMessage(name[0].toUpperCase() + name.slice(1));
      })
    : null;

  // Start on whatever the builder marked selected (classic red), so this
  // screen and its ring can never disagree about the opening colour.
  const initialSwatch = document.querySelector("#blankPalette .color-button.is-selected");
  if (initialSwatch) currentColor = initialSwatch.dataset.color;

  brushButton.addEventListener("click", () => {
    selectBrush();
    pop(460, 0.06);
  });
  eraserToolButton.addEventListener("click", selectEraser);
  clearButton.addEventListener("click", handleClearTap);

  // --- navigation ------------------------------------------------------------
  function openBlankPage() {
    stopMusic();
    document.querySelector("#galleryScreen").hidden = true;
    blankScreen.hidden = false;
    strokes = loadStrokes();
    rebuildPaintLayer();
    disarmClear();
    speak("blank.open");
  }

  function closeBlankPage() {
    saveStrokes();
    disarmClear();
    drawing = false;
    activePointerId = null;
    currentStroke = null;
    blankScreen.hidden = true;
    showColoringGallery();
  }

  document.querySelector("#blankHome").addEventListener("click", closeBlankPage);
  document.querySelector("#blankVoice").addEventListener("click", () =>
    speak("blank.directions")
  );

  canvas.addEventListener("pointerdown", beginStroke);
  canvas.addEventListener("pointermove", continueStroke);
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !blankScreen.hidden) closeBlankPage();
  });

  window.addEventListener("beforeunload", () => {
    if (!blankScreen.hidden) saveStrokes();
  });

  window.openBlankPage = openBlankPage;
})();

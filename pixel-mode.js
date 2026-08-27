"use strict";

// Pixel Mosaic — a toy-like grid-coloring mode inside Little Color Garden.
//
// The whole mode is self-contained on purpose: it never edits the brush-mode
// state above, and every screen it owns sits beside the app's own sections.
// Shared helpers from app.js (`speak`, `tinyPop`) are reused when present so
// the mode sounds like the same toy, but nothing breaks if they are absent.
//
// Feel targets the physical reference (owner, 2026-08-27): a white recessed
// board with square pockets, puffy glossy tiles, and a chunky rounded frame —
// "like using a real pixel mosaic / pegboard toy", never a paint tool.
(() => {
  const DATA = window.PIXEL_CARDS;
  if (!DATA) return;

  const W = DATA.boardWidth;
  const H = DATA.boardHeight;
  const CELLS = W * H;
  const PALETTE = DATA.palette;
  const EMPTY = -1;
  const FREE_ID = "free";

  const charToIndex = new Map([[".", EMPTY]]);
  PALETTE.forEach((color, index) => charToIndex.set(index.toString(36), index));

  const cardIndices = new Map(); // id -> Int8Array of palette indices
  DATA.cards.forEach((card) => {
    const grid = new Array(CELLS).fill(EMPTY);
    card.rows.forEach((row, r) => {
      for (let c = 0; c < W; c += 1) grid[r * W + c] = charToIndex.get(row[c]);
    });
    cardIndices.set(card.id, grid);
  });

  // --- DOM -------------------------------------------------------------
  const mainGallery = document.querySelector("#galleryScreen");
  const pageGallery = document.querySelector("#pageGallery");
  const galleryScreen = document.querySelector("#pixelGalleryScreen");
  const boardScreen = document.querySelector("#pixelBoardScreen");
  const cardsRow = document.querySelector("#pixelCards");
  const boardCanvas = document.querySelector("#pixelBoard");
  const boardFrame = document.querySelector("#pixelBoardFrame");
  const paletteRow = document.querySelector("#pixelPalette");
  const eraserButton = document.querySelector("#pixelEraser");
  const undoButton = document.querySelector("#pixelUndo");
  const clearButton = document.querySelector("#pixelClear");
  const finishButton = document.querySelector("#pixelFinish");
  const homeButton = document.querySelector("#pixelHome");
  const voiceButton = document.querySelector("#pixelVoice");
  const galleryVoiceButton = document.querySelector("#pixelGalleryVoice");
  const galleryBackButton = document.querySelector("#pixelGalleryBack");
  const thumbButton = document.querySelector("#pixelThumb");
  const thumbCanvas = document.querySelector("#pixelThumbCanvas");
  const overlay = document.querySelector("#pixelCardOverlay");
  const overlayCanvas = document.querySelector("#pixelCardOverlayCanvas");
  const celebration = document.querySelector("#pixelCelebration");

  const context = boardCanvas.getContext("2d");
  const CELL = 64; // internal canvas pixels per cell (board is 1280x960)

  // --- state -----------------------------------------------------------
  let grid = new Array(CELLS).fill(EMPTY);
  let outlineGrid = null; // the active card's cells, for the dashed fill-area guide
  let activeCard = null; // card object, or null for the free board
  let activeId = FREE_ID;
  let selectedIndex = 10; // start on classic red
  let erasing = false;
  let painting = false;
  let activePointerId = null;
  let lastCell = null;
  let strokeChanges = null; // Map index -> previous value
  let undoStack = [];
  let clearArmed = false;
  let clearArmTimer = null;
  let matched = false; // current board already matched the card (and celebrated)
  let effects = []; // { r, c, t0 } tile pop-in animations
  let frameRequested = false;
  let lastPopAt = 0;

  // app.js's helpers are global function declarations; resolve them through
  // window so this IIFE's own names cannot shadow them mid-initialisation.
  const speak = typeof window.speak === "function" ? window.speak : () => {};
  const pop = typeof window.tinyPop === "function" ? window.tinyPop : () => {};

  // --- drawing ---------------------------------------------------------
  function roundedPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawPocket(ctx, x, y, size) {
    const pad = size * 0.08;
    roundedPath(ctx, x + pad, y + pad, size - pad * 2, size - pad * 2, size * 0.2);
    ctx.fillStyle = "#efe7d6";
    ctx.fill();
    // A soft lip along the top edge makes each empty square read as a pocket.
    ctx.strokeStyle = "rgba(112, 92, 55, 0.14)";
    ctx.lineWidth = Math.max(1.5, size * 0.035);
    ctx.stroke();
  }

  // The dashed ghost of a tile: marks cells that belong to the picture but
  // are not filled yet. Without it, copying a card means counting grid cells
  // to find where the shape goes (owner feedback, 2026-08-27: "show the area
  // to fill"); with it, the challenge is choosing the right colors.
  function drawGhostTile(ctx, x, y, size) {
    const pad = size * 0.08;
    roundedPath(ctx, x + pad, y + pad, size - pad * 2, size - pad * 2, size * 0.24);
    ctx.fillStyle = "rgba(150, 128, 86, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(150, 128, 86, 0.5)";
    ctx.lineWidth = Math.max(1.5, size * 0.032);
    ctx.setLineDash([size * 0.13, size * 0.1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawTile(ctx, x, y, size, hex, scale) {
    const pad = size * 0.08;
    let ix = x + pad;
    let iy = y + pad;
    let iw = size - pad * 2;
    let ih = size - pad * 2;
    if (scale < 1) {
      const dw = iw * (1 - scale);
      const dh = ih * (1 - scale);
      ix += dw / 2;
      iy += dh / 2;
      iw -= dw;
      ih -= dh;
    }
    const radius = size * 0.24;
    roundedPath(ctx, ix, iy, iw, ih, radius);
    ctx.fillStyle = hex;
    ctx.fill();
    ctx.strokeStyle = "rgba(48, 33, 12, 0.16)";
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.stroke();
    // Glossy puffy top: a light sheen over the upper half of the tile.
    ctx.save();
    ctx.clip();
    const sheen = ctx.createLinearGradient(0, iy, 0, iy + ih * 0.62);
    sheen.addColorStop(0, "rgba(255,255,255,0.42)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(ix, iy, iw, ih * 0.62);
    ctx.fillStyle = "rgba(48, 33, 12, 0.10)";
    ctx.fillRect(ix, iy + ih - size * 0.07, iw, size * 0.07);
    ctx.restore();
  }

  function drawBoard(ctx, cellSize, board, withPockets, outline) {
    for (let r = 0; r < H; r += 1) {
      for (let c = 0; c < W; c += 1) {
        const x = c * cellSize;
        const y = r * cellSize;
        if (withPockets) drawPocket(ctx, x, y, cellSize);
        const value = board[r * W + c];
        if (value !== EMPTY) {
          let scale = 1;
          const effect = effects.find((item) => item.r === r && item.c === c);
          if (effect) {
            const t = Math.min(1, (performance.now() - effect.t0) / 190);
            // A little overshoot, like a tile pressed into a pocket.
            scale = t < 1 ? 1 - Math.pow(1 - t, 2) * 0.7 + (t > 0.6 ? Math.sin((t - 0.6) * 5) * 0.08 : 0) : 1;
          }
          drawTile(ctx, x, y, cellSize, PALETTE[value].value, scale);
        } else if (outline && outline[r * W + c] !== EMPTY) {
          drawGhostTile(ctx, x, y, cellSize);
        }
      }
    }
  }

  function renderBoard() {
    context.fillStyle = "#fbf7ee";
    context.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    drawBoard(context, CELL, grid, true, outlineGrid);
  }

  function requestRender() {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(() => {
      frameRequested = false;
      renderBoard();
      if (effects.length) requestRender();
    });
  }

  function renderStill(ctx, canvas, board, cellSize) {
    ctx.fillStyle = "#fffdf6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawBoard(ctx, cellSize, board, false);
  }

  // --- persistence -----------------------------------------------------
  function boardKey(id) {
    return `little-color-garden:pixel:board:${id}`;
  }

  function saveBoard() {
    try {
      const sparse = [];
      for (let i = 0; i < CELLS; i += 1) {
        if (grid[i] !== EMPTY) sparse.push(i, grid[i]);
      }
      localStorage.setItem(boardKey(activeId), JSON.stringify(sparse));
    } catch (_) {
      // Storage may be disabled; this session still works.
    }
  }

  function loadBoard(id) {
    const fresh = new Array(CELLS).fill(EMPTY);
    try {
      const saved = JSON.parse(localStorage.getItem(boardKey(id)) || "[]");
      if (Array.isArray(saved)) {
        for (let i = 0; i + 1 < saved.length; i += 2) {
          const at = saved[i];
          if (Number.isInteger(at) && at >= 0 && at < CELLS) fresh[at] = saved[i + 1];
        }
      }
    } catch (_) {
      // Corrupt or missing data starts clean, like a fresh toy.
    }
    return fresh;
  }

  function doneIds() {
    try {
      const saved = JSON.parse(localStorage.getItem("little-color-garden:pixel:done") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (_) {
      return [];
    }
  }

  function markDone(id) {
    const done = doneIds();
    if (done.includes(id)) return;
    done.push(id);
    try {
      localStorage.setItem("little-color-garden:pixel:done", JSON.stringify(done));
    } catch (_) {
      // The celebration still happened; only the badge is lost.
    }
  }

  // --- painting --------------------------------------------------------
  function cellFromPoint(event) {
    const rect = boardCanvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;
    const c = Math.max(0, Math.min(W - 1, Math.floor(x)));
    const r = Math.max(0, Math.min(H - 1, Math.floor(y)));
    return { c, r, inside: x >= 0 && y >= 0 && x < W && y < H };
  }

  function paintCell(c, r) {
    const index = r * W + c;
    const next = erasing ? EMPTY : selectedIndex;
    if (grid[index] === next) return;
    if (strokeChanges && !strokeChanges.has(index)) strokeChanges.set(index, grid[index]);
    grid[index] = next;
    const now = performance.now();
    if (next !== EMPTY) {
      effects = effects.filter((item) => !(item.r === r && item.c === c));
      effects.push({ r, c, t0: now });
    }
    if (now - lastPopAt > 70) {
      lastPopAt = now;
      pop(erasing ? 290 : 440 + (selectedIndex % 10) * 40 + Math.floor(selectedIndex / 10) * 60, 0.05);
    }
    requestRender();
  }

  function paintLine(from, to) {
    // Step along the segment at half-cell resolution so a fast drag leaves no gaps.
    // Includes the from-cell: some input paths begin with a move rather than a
    // down inside the canvas, and repainting a cell is always a no-op.
    const steps = Math.max(Math.abs(to.c - from.c), Math.abs(to.r - from.r)) * 2 + 1;
    for (let i = 0; i <= steps; i += 1) {
      const c = Math.round(from.c + ((to.c - from.c) * i) / steps);
      const r = Math.round(from.r + ((to.r - from.r) * i) / steps);
      paintCell(c, r);
    }
  }

  function beginPaint(event) {
    if (painting && activePointerId === event.pointerId) {
      // The previous stroke never saw its pointerup (dropped or cancelled
      // without an event). Recover here instead of ignoring this gesture —
      // a stuck stroke would swallow the first tile of every later drag.
      painting = false;
      strokeChanges = null;
      lastCell = null;
    }
    if (painting) return; // a second finger never interrupts the first
    event.preventDefault();
    painting = true;
    activePointerId = event.pointerId;
    boardCanvas.setPointerCapture(event.pointerId);
    strokeChanges = new Map();
    const cell = cellFromPoint(event);
    // A finger that lands off the board paints nothing — the clamp in
    // cellFromPoint exists for drag lines, not for border splatter.
    if (cell.inside) paintCell(cell.c, cell.r);
    lastCell = cell.inside ? cell : null;
  }

  function continuePaint(event) {
    if (!painting || event.pointerId !== activePointerId) return;
    event.preventDefault();
    const cell = cellFromPoint(event);
    if (!cell.inside) {
      // Leaving the board lifts the pen; coming back restarts the line cleanly.
      lastCell = null;
      return;
    }
    if (lastCell && (cell.c !== lastCell.c || cell.r !== lastCell.r)) {
      paintLine(lastCell, cell);
      lastCell = cell;
    } else {
      paintCell(cell.c, cell.r);
    }
  }

  function endPaint(event) {
    if (!painting || event.pointerId !== activePointerId) return;
    event.preventDefault();
    painting = false;
    activePointerId = null;
    lastCell = null;
    if (strokeChanges && strokeChanges.size) {
      undoStack.push(strokeChanges);
      if (undoStack.length > 80) undoStack.shift();
      undoButton.disabled = false;
      strokeChanges = null;
      saveBoard();
      checkMatch();
    }
    strokeChanges = null;
  }

  // --- undo / clear ----------------------------------------------------
  function undoStroke() {
    const changes = undoStack.pop();
    if (!changes) return;
    changes.forEach((previous, index) => {
      grid[index] = previous;
    });
    undoButton.disabled = undoStack.length === 0;
    saveBoard();
    requestRender();
    pop(300, 0.08);
    checkMatch();
  }

  function armClear() {
    clearArmed = true;
    clearButton.classList.add("is-armed");
    if (clearArmTimer) window.clearTimeout(clearArmTimer);
    clearArmTimer = window.setTimeout(disarmClear, 6000);
    pop(360);
    speak("Tap the broom again to clean the whole board.");
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
    if (!grid.some((value) => value !== EMPTY)) {
      disarmClear();
      speak("The board is already clean.");
      return;
    }
    if (clearArmed) {
      disarmClear();
      const changes = new Map();
      for (let i = 0; i < CELLS; i += 1) {
        if (grid[i] !== EMPTY) changes.set(i, grid[i]);
      }
      grid.fill(EMPTY);
      undoStack.push(changes);
      undoButton.disabled = false;
      saveBoard();
      requestRender();
      pop(320, 0.07);
      window.setTimeout(() => pop(240, 0.09), 90);
      speak("All clean!");
      checkMatch();
    } else {
      armClear();
    }
  }

  // --- challenge matching ----------------------------------------------
  function boardMatchesCard() {
    if (!activeCard) return false;
    const target = cardIndices.get(activeCard.id);
    for (let i = 0; i < CELLS; i += 1) {
      if (grid[i] !== target[i]) return false;
    }
    return true;
  }

  function checkMatch() {
    if (!activeCard) {
      matched = false;
      return;
    }
    if (boardMatchesCard()) {
      if (matched) return;
      matched = true;
      markDone(activeCard.id);
      refreshBadges();
      celebrate(`You made ${activeCard.name}! It matches the card!`);
    } else {
      matched = false;
    }
  }

  // --- celebration -----------------------------------------------------
  function celebrate(message) {
    celebration.replaceChildren();
    const colors = PALETTE.filter((_, index) => index % 3 === 1).map((color) => color.value);
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
    [523, 659, 784].forEach((frequency, index) => window.setTimeout(() => pop(frequency, 0.18), index * 130));
    speak(message);
    window.setTimeout(() => celebration.replaceChildren(), 3900);
  }

  // --- navigation ------------------------------------------------------
  function hideAllPixelScreens() {
    galleryScreen.hidden = true;
    boardScreen.hidden = true;
    overlay.hidden = true;
  }

  function showMainGallery() {
    hideAllPixelScreens();
    disarmClear();
    mainGallery.hidden = false;
    document.body.style.background = "#8a6bea";
    speak("Pick a picture to color.");
  }

  function showPixelGallery() {
    hideAllPixelScreens();
    disarmClear();
    saveBoard();
    galleryScreen.hidden = false;
    document.body.style.background = "#f2a0b8";
    refreshBadges();
    speak("Pick a picture to copy.");
  }

  function openBoard(card) {
    hideAllPixelScreens();
    boardScreen.hidden = false;
    document.body.style.background = "#9fdfe8";
    activeCard = card || null;
    activeId = card ? card.id : FREE_ID;
    grid = loadBoard(activeId);
    outlineGrid = card ? cardIndices.get(card.id) : null;
    undoStack = [];
    undoButton.disabled = true;
    matched = false;
    erasing = false;
    eraserButton.classList.remove("is-selected");
    disarmClear();
    thumbButton.hidden = !card;
    if (card) {
      renderStill(thumbCanvas.getContext("2d"), thumbCanvas, cardIndices.get(card.id), 8);
      renderStill(overlayCanvas.getContext("2d"), overlayCanvas, cardIndices.get(card.id), 24);
      speak(`Copy ${card.name}! Fill the dashed squares with the right colors.`);
    } else {
      speak("Make your own picture! Tap a color, then fill the little squares.");
    }
    renderBoard();
    // A saved board that already matches its card is quietly recognised — the
    // badge shows, but finishing again is the child's choice, not a surprise.
    matched = activeCard ? boardMatchesCard() : false;
  }

  function openOverlay() {
    if (!activeCard) return;
    overlay.hidden = false;
    pop(620, 0.06);
  }

  function closeOverlay() {
    overlay.hidden = true;
  }

  // --- gallery building --------------------------------------------------
  const FREE_TILE_ART = [
    "..2..a..",
    ".5..c..d",
    "..a..5..",
    ".c..d..5",
    "..h..e..",
    ".0..7..2"
  ];

  function makeMiniCanvas(card) {
    const canvas = document.createElement("canvas");
    canvas.width = W * 10;
    canvas.height = H * 10;
    canvas.className = "px-card-art";
    renderStill(canvas.getContext("2d"), canvas, cardIndices.get(card.id), 10);
    return canvas;
  }

  function makeFreeCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    canvas.className = "px-card-art";
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fffdf6";
    ctx.fillRect(0, 0, 160, 120);
    FREE_TILE_ART.forEach((row, r) => {
      for (let c = 0; c < row.length; c += 1) {
        const ch = row[c];
        if (ch === ".") continue;
        drawTile(ctx, c * 20, r * 20, 20, PALETTE[charToIndex.get(ch)].value, 1);
      }
    });
    return canvas;
  }

  function buildPixelGallery() {
    const free = document.createElement("button");
    free.className = "px-card px-card--free";
    free.type = "button";
    free.setAttribute("aria-label", "Make your own picture");
    free.appendChild(makeFreeCanvas());
    free.addEventListener("click", () => openBoard(null));
    cardsRow.appendChild(free);

    DATA.cards.forEach((card) => {
      const button = document.createElement("button");
      button.className = "px-card";
      button.type = "button";
      button.dataset.card = card.id;
      button.setAttribute("aria-label", `Copy ${card.name}`);
      button.appendChild(makeMiniCanvas(card));
      const badge = document.createElement("span");
      badge.className = "px-card-badge";
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = "♥";
      button.appendChild(badge);
      button.addEventListener("click", () => openBoard(card));
      cardsRow.appendChild(button);
    });
  }

  function refreshBadges() {
    const done = doneIds();
    cardsRow.querySelectorAll(".px-card[data-card]").forEach((button) => {
      button.classList.toggle("is-done", done.includes(button.dataset.card));
    });
  }

  // The door into pixel mode from the app's main gallery: one distinctive card
  // at the front of the shelf, drawn from the same card renderer.
  function injectEntryCard() {
    const rainbow = DATA.cards.find((card) => card.id === "rainbow") || DATA.cards[0];
    const button = document.createElement("button");
    button.className = "page-card px-entry";
    button.type = "button";
    button.setAttribute("aria-label", "Pixel Mosaic");
    button.style.setProperty("--card-color", "#fff3d6");
    const canvas = document.createElement("canvas");
    canvas.width = W * 12;
    canvas.height = H * 12;
    canvas.className = "px-entry-art";
    renderStill(canvas.getContext("2d"), canvas, cardIndices.get(rainbow.id), 12);
    button.appendChild(canvas);
    button.addEventListener("click", () => {
      mainGallery.hidden = true;
      showPixelGallery();
      pop(520, 0.06);
    });
    pageGallery.insertBefore(button, pageGallery.firstChild);
  }

  // --- palette -----------------------------------------------------------
  function buildPalette() {
    PALETTE.forEach((color, index) => {
      const button = document.createElement("button");
      button.className = `px-swatch${index === selectedIndex ? " is-selected" : ""}`;
      button.type = "button";
      button.style.setProperty("--swatch", color.value);
      button.setAttribute("aria-label", color.name);
      button.title = color.name;
      button.addEventListener("click", () => {
        selectedIndex = index;
        erasing = false;
        paletteRow.querySelectorAll(".px-swatch").forEach((item) => item.classList.toggle("is-selected", item === button));
        eraserButton.classList.remove("is-selected");
        pop(440 + (index % 10) * 40 + Math.floor(index / 10) * 60);
        speak(color.name);
      });
      paletteRow.appendChild(button);
    });
  }

  // --- wiring ------------------------------------------------------------
  boardCanvas.width = W * CELL;
  boardCanvas.height = H * CELL;

  boardCanvas.addEventListener("pointerdown", beginPaint);
  boardCanvas.addEventListener("pointermove", continuePaint);
  boardCanvas.addEventListener("pointerup", endPaint);
  boardCanvas.addEventListener("pointercancel", endPaint);
  boardCanvas.addEventListener("contextmenu", (event) => event.preventDefault());

  eraserButton.addEventListener("click", () => {
    erasing = true;
    paletteRow.querySelectorAll(".px-swatch").forEach((item) => item.classList.remove("is-selected"));
    eraserButton.classList.add("is-selected");
    pop(340);
    speak("Eraser");
  });

  undoButton.addEventListener("click", undoStroke);
  clearButton.addEventListener("click", handleClearTap);
  finishButton.addEventListener("click", () => {
    if (activeCard && boardMatchesCard()) {
      markDone(activeCard.id);
      refreshBadges();
      celebrate(`You made ${activeCard.name}! It matches the card!`);
    } else if (activeCard) {
      speak("Look at the little card and keep going!");
      pop(360, 0.08);
    } else {
      celebrate("Wow! Your mosaic is beautiful!");
    }
  });
  homeButton.addEventListener("click", showPixelGallery);
  galleryBackButton.addEventListener("click", showMainGallery);
  galleryVoiceButton.addEventListener("click", () => speak("Pick a picture to copy. Tap one, then match the little squares!"));
  voiceButton.addEventListener("click", () => {
    if (activeCard) speak(`Copy ${activeCard.name}! The dashed squares show where the picture goes. Match the little card's colors.`);
    else speak("Tap a color, then fill the squares. Make anything you like!");
  });
  thumbButton.addEventListener("click", openOverlay);
  overlay.addEventListener("click", closeOverlay);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!overlay.hidden) {
        closeOverlay();
        return;
      }
      if (!boardScreen.hidden) showPixelGallery();
      else if (!galleryScreen.hidden) showMainGallery();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !boardScreen.hidden) {
      event.preventDefault();
      undoStroke();
    }
  });

  window.addEventListener("beforeunload", () => {
    if (!boardScreen.hidden) saveBoard();
  });

  buildPixelGallery();
  buildPalette();
  injectEntryCard();
})();

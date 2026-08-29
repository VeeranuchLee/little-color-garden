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

  // Levels. Owner, 2026-08-27: "how about we add level too? like easy level,
  // if tap on 'outside' the pic area (but still on the board, on the brown
  // area) no color there?" Only the *help* changes across the three — the
  // child still chooses every color themselves, which is the whole point of
  // copying a card, so nothing here grades a tap as right or wrong.
  const LEVELS = [
    {
      id: "easy",
      dots: 1,
      label: "Easy level. The shaded squares show which color goes where, and only they can take a tile.",
      say: "Easy. The shaded squares show the colors, and only they take a tile.",
      prompt: (name) => `Copy ${name}! The shaded squares show which color goes where. The rest of the board is closed.`
    },
    {
      id: "medium",
      dots: 2,
      label: "Medium level. The shaded squares show which color goes where, and every square can take a tile.",
      say: "Medium. The shaded squares show the colors. Every square can take a tile.",
      prompt: (name) => `Copy ${name}! The shaded squares show which color goes where.`
    },
    {
      id: "hard",
      dots: 3,
      label: "Hard level. No shape is shown. Copy the little card.",
      say: "Hard! No shape. Look at the little card and copy it.",
      prompt: (name) => `Copy ${name}! Nothing is shown. Look at the little card and copy it.`
    }
  ];
  const LEVEL_KEY = "little-color-garden:pixel:level";

  // The tray is 3 rows x 12 columns: one hue family per column, light over mid
  // over dark. The original ten families keep their palette indices (a card
  // square is a palette index, so changing one would rewrite every card); lime
  // and peach were appended at 30-35 and are slotted in here by hue, so the
  // tray still reads as a rainbow rather than showing the newcomers bolted on
  // the end.
  const PALETTE_COLUMNS = [
    [0, 10, 20],   // red
    [1, 11, 21],   // orange
    [33, 34, 35],  // peach
    [2, 12, 22],   // yellow
    [30, 31, 32],  // lime
    [3, 13, 23],   // green
    [4, 14, 24],   // teal
    [5, 15, 25],   // blue
    [6, 16, 26],   // purple
    [7, 17, 27],   // pink
    [8, 18, 28],   // white / brown
    [9, 19, 29]    // grey
  ];

  // Where each colour sits in the tray, so its tap tone rises left-to-right and
  // deepens top-to-bottom however the columns are arranged.
  const trayPosition = [];
  PALETTE_COLUMNS.forEach((column, col) => {
    column.forEach((index, row) => { trayPosition[index] = { col, row }; });
  });

  function swatchTone(index) {
    const at = trayPosition[index] || { col: 0, row: 0 };
    return 440 + at.col * 34 + at.row * 60;
  }

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
  const levelsRow = document.querySelector("#pixelLevels");
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
  let levelId = loadLevel();
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

  function drawPocket(ctx, x, y, size, sleeping, fill) {
    const pad = size * 0.08;
    roundedPath(ctx, x + pad, y + pad, size - pad * 2, size - pad * 2, size * 0.2);
    // `fill` overrides the board cream for a picture square that already holds
    // a tile: it keeps that square's own tint, so a placed tile does not get a
    // bright cream ring drawn around it in the middle of the shaded area.
    ctx.fillStyle = fill || (sleeping ? "#f4eee1" : "#efe7d6");
    ctx.fill();
    // A soft lip along the top edge makes each empty square read as a pocket.
    // On the easy level the squares outside the picture take no tile at all,
    // so their lip fades away: the board keeps its texture, but only the
    // picture area looks open for work.
    ctx.strokeStyle = sleeping ? "rgba(112, 92, 55, 0.045)" : "rgba(112, 92, 55, 0.14)";
    ctx.lineWidth = Math.max(1.5, size * 0.035);
    ctx.stroke();
  }

  // The fill-area guide: every cell that belongs to the picture and holds no
  // tile yet. Three cuts of this mark failed before this one — brown dashes
  // (read as brown tiles), grey dashes, then solid light-grey chips (v12) —
  // and the last one failed on measurement: #e8eaef chips on #efe7d6 pockets
  // are 12 dE apart but only 0.9 L* apart, and at tile size the eye reads
  // lightness first. Owner, 2026-08-27, with a screenshot of an empty board:
  // "the different between two colors not enough, it's hard to make picture
  // like this."
  //
  // What held every earlier cut pale was the fear of a guide that reads as a
  // *color*. Drawing it as one continuous region retires that fear: it spans
  // whole cells edge to edge, with no gap and no gloss, while a tile is
  // always a separate rounded chip sitting inside its pocket. So the tone is
  // free to drop ~12 L* below the pockets (dE 22), the shape gets a firm
  // outline of its own, and the area reads as one place to fill instead of a
  // hundred grey squares.
  const GUIDE_FILL = "#bfc7d8";
  const GUIDE_EDGE = "rgba(84, 99, 138, 0.62)";
  const GUIDE_SEAM = "rgba(84, 99, 138, 0.15)";

  // --- colour maths ----------------------------------------------------
  // Two things need to know how colours relate: the washed tints painted
  // into the shaded area, and the "close enough" match. Both are computed
  // once here, from the palette itself, so neither can drift from it.
  function hexToRgb(hex) {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  function rgbToLab([r, g, b]) {
    const linear = (channel) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
    const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
    const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
    const z = (lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const [fx, fy, fz] = [f(x), f(y), f(z)];
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  // Owner, 2026-08-28: "If the color is 'close enough' it's a pass."
  //
  // Measured over this palette, "same colour family" cannot express that:
  // same-family shade steps span ΔE 18–64 while the closest *cross*-family
  // pair is ΔE 19, so a family rule would forgive white-for-dark-brown (64)
  // and still fail white-for-light-grey (19). Perceptual distance is the
  // honest rule, because it forgives exactly what actually looks alike.
  //
  // ΔE 32 covers every same-family light→mid and mid→dark step plus six
  // genuine look-alikes across families (light orange / light yellow,
  // light blue / grey, dark brown / black, dark red / dark pink,
  // light purple / light pink, light pink / grey). Red for orange (ΔE 44),
  // white for brown (64) and red for blue (104) still fail — the picture
  // still has to be the right picture.
  const MATCH_TOLERANCE = 32;

  // How much of a square's real colour shows through the shaded area.
  // Owner, same message: "I want to see all the color vaguely on the gray
  // area too." Vaguely is the operative word — enough to tell red from blue
  // at a glance, faint enough that nobody mistakes it for a placed tile.
  const GUIDE_TINT = 0.42;

  const paletteLab = PALETTE.map((color) => rgbToLab(hexToRgb(color.value)));

  const guideTints = PALETTE.map((color) => {
    const [r, g, b] = hexToRgb(color.value);
    const [gr, gg, gb] = hexToRgb(GUIDE_FILL);
    const mix = (a, b2) => Math.round(a * GUIDE_TINT + b2 * (1 - GUIDE_TINT));
    return `rgb(${mix(r, gr)}, ${mix(g, gg)}, ${mix(b, gb)})`;
  });

  // A 30x30 lookup built once: closeEnough[a][b] is true when a tile of
  // colour `a` passes for a card asking for `b`.
  const closeEnough = paletteLab.map((a) =>
    paletteLab.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= MATCH_TOLERANCE)
  );

  // `guided(index)` is true for a picture cell that still holds no tile, so
  // the shaded area shrinks as the copy progresses and a finished picture
  // leaves no trace of the help behind.
  function drawGuideRegion(ctx, cellSize, cols, rows, at) {
    const { guided, shaped, tint } = at;
    const inside = (c, r) =>
      c >= 0 && r >= 0 && c < cols && r < rows && guided(r * cols + c);
    // Whether the cell belongs to the picture at all, tile or no tile. The
    // firm outline follows *this* — so a tile dropped in the middle of the
    // shape leaves a hole in the shading without drawing a heavy box around
    // itself, and the silhouette holds its shape while the shading empties.
    const inPicture = (c, r) =>
      c >= 0 && r >= 0 && c < cols && r < rows && shaped(r * cols + c);

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!inside(c, r)) continue;
        ctx.fillStyle = tint(r * cols + c);
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }

    // Light falls from above on this board, so a recess darkens along its top
    // edge where a puffy tile would catch a highlight. That one inversion is
    // what makes the region read as a hollow rather than a big flat sticker.
    const depth = cellSize * 0.3;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!inside(c, r) || inside(c, r - 1)) continue;
        const y = r * cellSize;
        const shade = ctx.createLinearGradient(0, y, 0, y + depth);
        shade.addColorStop(0, "rgba(64, 78, 116, 0.24)");
        shade.addColorStop(1, "rgba(64, 78, 116, 0)");
        ctx.fillStyle = shade;
        ctx.fillRect(c * cellSize, y, cellSize, depth);
      }
    }

    // Seams inside the region keep single squares countable — a child copying
    // a card still has to land on the right one.
    ctx.strokeStyle = GUIDE_SEAM;
    ctx.lineWidth = Math.max(1, cellSize * 0.03);
    ctx.beginPath();
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!inside(c, r)) continue;
        const x = c * cellSize;
        const y = r * cellSize;
        if (inside(c + 1, r)) {
          ctx.moveTo(x + cellSize, y);
          ctx.lineTo(x + cellSize, y + cellSize);
        }
        if (inside(c, r + 1)) {
          ctx.moveTo(x, y + cellSize);
          ctx.lineTo(x + cellSize, y + cellSize);
        }
      }
    }
    ctx.stroke();

    // The shape's own edge, drawn last: the picture is visible as a silhouette
    // before a single tile is placed.
    ctx.strokeStyle = GUIDE_EDGE;
    ctx.lineWidth = Math.max(2, cellSize * 0.075);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!inside(c, r)) continue;
        const x = c * cellSize;
        const y = r * cellSize;
        if (!inPicture(c, r - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + cellSize, y); }
        if (!inPicture(c, r + 1)) { ctx.moveTo(x, y + cellSize); ctx.lineTo(x + cellSize, y + cellSize); }
        if (!inPicture(c - 1, r)) { ctx.moveTo(x, y); ctx.lineTo(x, y + cellSize); }
        if (!inPicture(c + 1, r)) { ctx.moveTo(x + cellSize, y); ctx.lineTo(x + cellSize, y + cellSize); }
      }
    }
    ctx.stroke();
  }

  // `loose` marks a tile that is not the colour this square wants. Owner,
  // 2026-08-28: "when the tiles are filled, it need to show if it's 'pass' or
  // not ... can't see color underneath." A loose tile is drawn well inside
  // its square, so the square's own tint shows all the way around it — the
  // child sees their colour and the wanted colour side by side, in place.
  // A tile that passes sits flush and covers its square: no ring is the pass
  // signal, which keeps a finished picture a picture rather than a checklist.
  function drawTile(ctx, x, y, size, hex, scale, loose) {
    const pad = size * (loose ? 0.19 : 0.08);
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

  // Three passes, because the guide is a region and not a per-cell mark:
  // empty pockets first, then the picture area over them, then the tiles.
  // `options.cols`/`rows` let the gallery's little level samples reuse the
  // board's own drawing rather than imitating it.
  function drawBoard(ctx, cellSize, board, options) {
    const opts = options || {};
    const cols = opts.cols || W;
    const rows = opts.rows || H;
    const outline = opts.outline || null;

    const guided = (index) => outline !== null && outline[index] !== EMPTY && board[index] === EMPTY;

    if (opts.pockets) {
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const index = r * cols + c;
          // The shaded area replaces the pocket on squares still to fill. A
          // picture square that already holds a tile keeps its pocket, tinted
          // rather than cream so the region reads as one unbroken area.
          if (guided(index)) continue;
          const inPicture = outline !== null && outline[index] !== EMPTY;
          drawPocket(
            ctx,
            c * cellSize,
            r * cellSize,
            cellSize,
            opts.closedOutside === true,
            inPicture ? guideTints[outline[index]] : null
          );
        }
      }
    }

    if (outline) {
      drawGuideRegion(ctx, cellSize, cols, rows, {
        guided,
        shaped: (index) => outline[index] !== EMPTY,
        tint: (index) => guideTints[outline[index]] || GUIDE_FILL
      });
    }

    // Judging follows the guide: easy and medium show it, hard shows nothing
    // at all and stays a real copy-it-yourself challenge.
    const judging = outline !== null && opts.judge === true;
    const wrong = (index, value) =>
      judging && !(outline[index] !== EMPTY && closeEnough[value][outline[index]]);

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const index = r * cols + c;
        const value = board[index];
        if (value === EMPTY) continue;
        let scale = 1;
        if (opts.animate) {
          const effect = effects.find((item) => item.r === r && item.c === c);
          if (effect) {
            const t = Math.min(1, (performance.now() - effect.t0) / 190);
            // A little overshoot, like a tile pressed into a pocket.
            scale = t < 1 ? 1 - Math.pow(1 - t, 2) * 0.7 + (t > 0.6 ? Math.sin((t - 0.6) * 5) * 0.08 : 0) : 1;
          }
        }
        drawTile(ctx, c * cellSize, r * cellSize, cellSize, PALETTE[value].value, scale, wrong(index, value));
      }
    }
  }

  function renderBoard() {
    context.fillStyle = "#fbf7ee";
    context.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    drawBoard(context, CELL, grid, {
      pockets: true,
      outline: outlineGrid,
      closedOutside: levelId === "easy" && outlineGrid !== null,
      judge: true,
      animate: true
    });
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
    drawBoard(ctx, cellSize, board, {});
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

  function loadLevel() {
    try {
      const saved = localStorage.getItem(LEVEL_KEY);
      if (LEVELS.some((item) => item.id === saved)) return saved;
    } catch (_) {
      // Storage may be disabled; medium is the level the mode shipped with.
    }
    return "medium";
  }

  function currentLevel() {
    return LEVELS.find((item) => item.id === levelId) || LEVELS[1];
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

  // Easy level: the board outside the picture takes no tile. The eraser is
  // never blocked — a child who painted outside on another level must always
  // be able to take it back.
  function isClosed(index) {
    return levelId === "easy" && outlineGrid !== null && outlineGrid[index] === EMPTY;
  }

  function paintCell(c, r) {
    const index = r * W + c;
    const next = erasing ? EMPTY : selectedIndex;
    if (!erasing && isClosed(index)) {
      const knock = performance.now();
      // A quiet low knock, well below the tile sounds: the tap was heard, the
      // square is simply closed. Throttled so dragging across the board is
      // not a drum roll.
      if (knock - lastPopAt > 240) {
        lastPopAt = knock;
        pop(150, 0.035);
      }
      return;
    }
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
      pop(erasing ? 290 : swatchTone(selectedIndex), 0.05);
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
  // The shape still has to be right — an empty square stays empty and a
  // filled one stays filled. Only the *colour* is forgiven, and only as far
  // as MATCH_TOLERANCE: this is a toy for a four-year-old, not a colour exam.
  function boardMatchesCard() {
    if (!activeCard) return false;
    const target = cardIndices.get(activeCard.id);
    for (let i = 0; i < CELLS; i += 1) {
      if (grid[i] === target[i]) continue;
      if (grid[i] === EMPTY || target[i] === EMPTY) return false;
      if (!closeEnough[grid[i]][target[i]]) return false;
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
    outlineGrid = card && levelId !== "hard" ? cardIndices.get(card.id) : null;
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
      speak(currentLevel().prompt(card.name));
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

  // --- levels ------------------------------------------------------------
  // Each button draws the board it chooses, through the board's own renderer:
  // one half-built heart, shown the way that level would show it. A child who
  // cannot read still picks a level by looking at it.
  const LEVEL_SAMPLE = [
    "........",
    ".aa..xx.",
    "aaaaxxxx",
    "aaaaxxxx",
    ".aaaxxx.",
    "..aaxx..",
    "...ax..."
  ];

  function buildLevels() {
    const cols = LEVEL_SAMPLE[0].length;
    const rows = LEVEL_SAMPLE.length;
    const sample = new Array(cols * rows).fill(EMPTY);
    const shape = new Array(cols * rows).fill(EMPTY);
    LEVEL_SAMPLE.forEach((row, r) => {
      for (let c = 0; c < cols; c += 1) {
        const ch = row[c];
        if (ch === ".") continue;
        // "x" is a square still to fill: it carries the heart's own colour so
        // the sample shows the tinted shading the level actually draws.
        const index = charToIndex.get(ch === "x" ? "a" : ch);
        shape[r * cols + c] = index;
        if (ch !== "x") sample[r * cols + c] = index;
      }
    });

    LEVELS.forEach((level) => {
      const button = document.createElement("button");
      button.className = `px-level${level.id === levelId ? " is-selected" : ""}`;
      button.type = "button";
      button.dataset.level = level.id;
      button.setAttribute("aria-label", level.label);
      button.title = level.label;

      const size = 22;
      const canvas = document.createElement("canvas");
      canvas.width = cols * size;
      canvas.height = rows * size;
      canvas.className = "px-level-art";
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fbf7ee";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawBoard(ctx, size, sample, {
        cols,
        rows,
        pockets: true,
        outline: level.id === "hard" ? null : shape,
        closedOutside: level.id === "easy"
      });
      button.appendChild(canvas);

      const dots = document.createElement("span");
      dots.className = "px-level-dots";
      dots.setAttribute("aria-hidden", "true");
      for (let i = 0; i < LEVELS.length; i += 1) {
        const dot = document.createElement("i");
        if (i >= level.dots) dot.className = "is-off";
        dots.appendChild(dot);
      }
      button.appendChild(dots);

      button.addEventListener("click", () => {
        levelId = level.id;
        try {
          localStorage.setItem(LEVEL_KEY, levelId);
        } catch (_) {
          // The level still applies to this session.
        }
        levelsRow.querySelectorAll(".px-level").forEach((item) => item.classList.toggle("is-selected", item === button));
        pop(430 + level.dots * 110, 0.07);
        speak(level.say);
      });
      levelsRow.appendChild(button);
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
  // The grid fills row by row, so the buttons are appended row by row: all
  // twelve lights, then the mids, then the darks.
  function buildPalette() {
    for (let row = 0; row < 3; row += 1) {
      PALETTE_COLUMNS.forEach((column) => {
        const index = column[row];
        const color = PALETTE[index];
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
          pop(swatchTone(index));
          speak(color.name);
        });
        paletteRow.appendChild(button);
      });
    }
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
  galleryVoiceButton.addEventListener("click", () => speak("Pick how much help you want at the top, then pick a picture to copy!"));
  voiceButton.addEventListener("click", () => {
    if (activeCard) speak(currentLevel().prompt(activeCard.name));
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

  buildLevels();
  buildPixelGallery();
  buildPalette();
  injectEntryCard();
})();

"use strict";

// Color by Number owns its gallery and board, but uses the app's existing
// flood-region helper, tiny interaction sound, and download pattern.
(() => {
  const galleryScreen = document.querySelector("#cbnGalleryScreen");
  const screen = document.querySelector("#cbnScreen");
  const gallery = document.querySelector("#cbnGallery");
  const canvas = document.querySelector("#cbnCanvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const palette = document.querySelector("#cbnPalette");
  const message = document.querySelector("#cbnCelebration");
  const clearButton = document.querySelector("#cbnClear");
  const undoButton = document.querySelector("#cbnUndo");

  const speak = typeof window.speak === "function" ? window.speak : () => {};
  const pop = typeof window.tinyPop === "function" ? window.tinyPop : () => {};

  let manifest = null;
  let picture = null;
  let lineImage = null;
  let linePixels = null;
  let selectedNumber = null;
  let filledRegions = new Map();
  let missesByRegion = new Map();
  let clearArmed = false;
  let clearArmTimer = null;
  let clearedBackup = null;

  function hideAllScreens() {
    document.querySelectorAll(".screen").forEach((element) => {
      element.hidden = true;
    });
  }

  function storageKey() {
    return `little-color-garden:cbn:${picture.id}`;
  }

  function saveProgress() {
    localStorage.setItem(storageKey(), JSON.stringify([...filledRegions]));
  }

  function disarmClear() {
    clearArmed = false;
    clearButton.classList.remove("is-armed");
    if (clearArmTimer) {
      window.clearTimeout(clearArmTimer);
      clearArmTimer = null;
    }
  }

  function armClear() {
    clearArmed = true;
    clearButton.classList.add("is-armed");
    if (clearArmTimer) window.clearTimeout(clearArmTimer);
    clearArmTimer = window.setTimeout(disarmClear, 6000);
    pop(360);
    speak("app.clear-arm");
  }

  function updateUndoButton() {
    undoButton.disabled = !(clearedBackup && clearedBackup.size > 0);
  }

  function restoreClearedRegions() {
    if (!clearedBackup || !clearedBackup.size) return;
    filledRegions = clearedBackup;
    clearedBackup = null;
    saveProgress();
    render();
    pop(560, 0.09);
    speak("app.undo-restore");
    updateUndoButton();
  }

  function clearPicture() {
    clearedBackup = new Map(filledRegions);
    filledRegions = new Map();
    saveProgress();
    render();
    pop(320, 0.07);
    window.setTimeout(() => pop(240, 0.09), 90);
    speak("app.clear-done");
    updateUndoButton();
  }

  function handleClearTap() {
    if (!filledRegions.size) {
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

  function downloadPicture() {
    if (!picture) return;
    const link = document.createElement("a");
    link.download = `color-by-number-${picture.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function hexToRgb(hex) {
    const channels = hex.match(/[a-f\d]{2}/gi);
    return channels.map((channel) => Number.parseInt(channel, 16));
  }

  // The cell under a point, bounded by the line art exactly as the app-wide
  // colorGardenFloodRegion bounds it, but without that helper's tiny-pocket
  // filter: a thin "number beside the shape" cell can be narrower than the
  // pocket rule and must still fill (owner, 2026-10-02: "Number beside the shape").
  function floodCell(point) {
    const width = canvas.width;
    const height = canvas.height;
    const startX = Math.max(0, Math.min(width - 1, Math.round(point.x)));
    const startY = Math.max(0, Math.min(height - 1, Math.round(point.y)));
    const visited = new Uint8Array(width * height);
    const indices = [];
    const stack = [startY * width + startX];
    const isBoundary = (index) => {
      const offset = index * 4;
      return linePixels[offset + 3] > 90
        && linePixels[offset] + linePixels[offset + 1] + linePixels[offset + 2] < 430;
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
    return indices;
  }

  function paintArea(seedPoint, color) {
    const indices = floodCell(seedPoint);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const [red, green, blue] = hexToRgb(color);

    indices.forEach((pixelIndex) => {
      const offset = pixelIndex * 4;
      imageData.data[offset] = red;
      imageData.data[offset + 1] = green;
      imageData.data[offset + 2] = blue;
      imageData.data[offset + 3] = 255;
    });
    context.putImageData(imageData, 0, 0);
  }

  // A group cell (several thin parts of one object, e.g. all rays of one sun)
  // lists its parts in "members"; one tap fills them all.
  function seedsOf(region) {
    return region.members ? region.members.map((member) => member.labelPoint) : [region.labelPoint];
  }

  function paintRegion(region, color) {
    seedsOf(region).forEach((seed) => paintArea(seed, color));
  }

  function labelFontSize(region) {
    const rect = canvas.getBoundingClientRect();
    const displayScale = rect.width > 0 ? rect.width / canvas.width : 1;
    const minimumCanvasSize = 14 / displayScale;
    const preferredCanvasSize = 24 / displayScale;
    return Math.max(minimumCanvasSize, Math.min(preferredCanvasSize, region.inscribedRadius * 1.4));
  }

  // A thin cell's number sits in a round bubble beside the shape, with a short
  // pointer touching it. Geometry comes from build-cbn.py (data/cbn.json), which
  // keeps every bubble clear of lines, numerals and the other bubbles.
  function drawBubble(region) {
    const { x, y, r, font, tip } = region.bubble;
    const distance = Math.max(1e-6, Math.hypot(tip.x - x, tip.y - y));
    const startX = x + (tip.x - x) / distance * r;
    const startY = y + (tip.y - y) / distance * r;
    context.save();
    context.strokeStyle = "#20202b";
    context.fillStyle = "#20202b";
    context.lineCap = "round";
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(tip.x, tip.y);
    context.stroke();
    context.beginPath();
    context.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fillStyle = "#fff";
    context.fill();
    context.lineWidth = 2.5;
    context.stroke();
    context.font = `900 ${font}px system-ui`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#20202b";
    context.fillText(region.number, x, y + 1);
    context.restore();
  }

  function drawLabel(region) {
    if (region.bubble) {
      drawBubble(region);
      return;
    }
    const fontSize = labelFontSize(region);
    context.font = `900 ${fontSize}px system-ui`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.lineWidth = Math.max(2, fontSize * 0.18);
    context.strokeStyle = "#fff";
    context.fillStyle = "#20202b";
    context.strokeText(region.number, region.labelPoint.x, region.labelPoint.y);
    context.fillText(region.number, region.labelPoint.x, region.labelPoint.y);
  }

  function render() {
    if (!picture || !lineImage || !linePixels) return;

    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    picture.decor.forEach((decoration) => {
      paintArea(decoration.seedPoint, decoration.color);
    });

    filledRegions.forEach((color, regionId) => {
      const region = picture.regions.find((candidate) => candidate.id === regionId);
      if (region) paintRegion(region, color);
    });

    context.globalCompositeOperation = "multiply";
    context.drawImage(lineImage, 0, 0);
    context.globalCompositeOperation = "source-over";

    picture.regions.forEach((region) => {
      if (!filledRegions.has(region.id)) drawLabel(region);
    });
  }

  function chooseNumber(number) {
    selectedNumber = number;
    palette.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-selected", Number(button.dataset.number) === number);
    });
  }

  function buildPalette() {
    const buttons = picture.palette.map((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.number = entry.number;
      button.style.setProperty("--swatch", entry.hex);
      button.textContent = entry.number;
      button.setAttribute("aria-label", `${entry.number}, ${entry.name}`);
      button.addEventListener("click", () => chooseNumber(entry.number));
      return button;
    });
    palette.replaceChildren(...buttons);
  }

  function restoreProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || "[]");
      // Drop saved fills whose cell is gone or now wants another colour (cell
      // ids can change when a picture's outlines are corrected).
      const colourOf = new Map(picture.regions.map((region) => [
        region.id,
        (picture.palette.find((entry) => entry.number === region.number) || {}).hex
      ]));
      filledRegions = new Map((Array.isArray(saved) ? saved : [])
        .filter(([id, color]) => colourOf.has(id) && colourOf.get(id) === color));
    } catch {
      filledRegions = new Map();
    }
  }

  function openPicture(nextPicture) {
    picture = nextPicture;
    disarmClear();
    clearedBackup = null;
    updateUndoButton();
    restoreProgress();
    missesByRegion = new Map();
    selectedNumber = picture.palette[0].number;
    linePixels = null;

    buildPalette();
    chooseNumber(selectedNumber);
    document.querySelector("#cbnTitle").textContent = picture.title;
    hideAllScreens();
    screen.hidden = false;

    lineImage = new Image();
    lineImage.addEventListener("load", () => {
      canvas.width = picture.width;
      canvas.height = picture.height;
      context.drawImage(lineImage, 0, 0);
      linePixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      render();
    });
    lineImage.src = `./${picture.lineArt}`;
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height
    };
  }

  function bubbleAtPoint(point, radius) {
    let nearest = null;
    let nearestDistance = Infinity;
    picture.regions.forEach((region) => {
      if (!region.bubble || filledRegions.has(region.id)) return;
      const distance = Math.hypot(point.x - region.bubble.x, point.y - region.bubble.y);
      if (distance <= Math.max(region.bubble.r + 3, radius) && distance < nearestDistance) {
        nearest = region;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  function regionAtPoint(point) {
    // A bubble is drawn on top of whatever it sits on, so a tap on it is a tap
    // on its thin cell -- checked before the cell under the finger.
    const onBubble = bubbleAtPoint(point, 0);
    if (onBubble) return onBubble;
    const regionPixels = new Set(floodCell(point));
    const direct = picture.regions.find((region) => {
      if (filledRegions.has(region.id)) return false;
      return seedsOf(region).some((seed) => regionPixels.has(
        Math.round(seed.y) * canvas.width + Math.round(seed.x)
      ));
    });
    if (direct) return direct;

    // Near a bubble (48px target, like every other assist): its cell.
    const nearBubble = bubbleAtPoint(point, 24 * canvas.width / Math.max(1, canvas.getBoundingClientRect().width));
    if (nearBubble) return nearBubble;

    // A tap on a numeral stroke or boundary gets the same 48px assist as Mosaic.
    // Nearest label is the canonical seed for the region, so assistance cannot map
    // a cell to a different number or colour. Already-filled cells are excluded.
    const rect = canvas.getBoundingClientRect();
    const radius = 24 * canvas.width / Math.max(1, rect.width);
    let nearest = null;
    let nearestSquared = radius * radius;
    picture.regions.forEach((region) => {
      if (filledRegions.has(region.id)) return;
      seedsOf(region).forEach((seed) => {
        const dx = point.x - seed.x;
        const dy = point.y - seed.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= nearestSquared) {
          nearest = region;
          nearestSquared = distanceSquared;
        }
      });
    });
    return nearest;
  }

  function pulseWrongAnswer(region) {
    const missCount = (missesByRegion.get(region.id) || 0) + 1;
    missesByRegion.set(region.id, missCount);
    canvas.classList.remove("number-pulse");
    void canvas.offsetWidth;
    canvas.classList.add("number-pulse");
    window.tinyPop(190, 0.05);

    const correctButton = palette.querySelector(`[data-number="${region.number}"]`);
    if (missCount >= 2) correctButton.classList.add("hint-glow");
    if (missCount >= 3) chooseNumber(region.number);
  }

  function celebrateCompletion() {
    message.textContent = "You finished it! ✨";
    window.tinyPop(720, 0.1);
    window.setTimeout(() => {
      message.textContent = "";
    }, 2400);
  }

  function fillCorrectRegion(region) {
    if (clearArmed) disarmClear();
    const color = picture.palette.find((entry) => entry.number === selectedNumber).hex;
    filledRegions.set(region.id, color);
    missesByRegion.delete(region.id);
    palette.querySelector(`[data-number="${region.number}"]`).classList.remove("hint-glow");
    saveProgress();
    render();
    pop(520, 0.06);
    if (filledRegions.size === picture.regions.length) celebrateCompletion();
  }

  function handleCanvasPointer(event) {
    event.preventDefault();
    if (!linePixels) return;
    const region = regionAtPoint(canvasPoint(event));
    if (!region) return;
    if (region.number === selectedNumber) {
      fillCorrectRegion(region);
    } else {
      pulseWrongAnswer(region);
    }
  }

  function buildGallery() {
    manifest.pictures.forEach((entry) => {
      const button = document.createElement("button");
      button.className = "activity-card";
      button.type = "button";
      button.setAttribute("aria-label", `Color ${entry.title} by number`);

      const image = document.createElement("img");
      image.src = `./${entry.preview}`;
      image.alt = "";
      const title = document.createElement("b");
      title.textContent = entry.title;
      button.append(image, title);
      button.addEventListener("click", () => openPicture(entry));
      gallery.appendChild(button);
    });
  }

  async function initialise() {
    const response = await fetch("./data/cbn.json");
    manifest = await response.json();
    buildGallery();
  }

  canvas.addEventListener("pointerdown", handleCanvasPointer);
  new ResizeObserver(() => render()).observe(canvas);

  window.openCbnGallery = () => {
    hideAllScreens();
    galleryScreen.hidden = false;
  };

  document.querySelector("#cbnGalleryBack").addEventListener("click", () => window.showModeMenu());
  document.querySelector("#cbnBack").addEventListener("click", () => window.openCbnGallery());
  document.querySelector("#cbnSave").addEventListener("click", downloadPicture);
  clearButton.addEventListener("click", handleClearTap);
  undoButton.addEventListener("click", restoreClearedRegions);

  initialise().catch(() => {
    message.textContent = "Pictures could not load.";
  });
})();

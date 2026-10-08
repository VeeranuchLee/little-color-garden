"use strict";

// Stamping is free play: no scores or wrong answers. Every visible change is
// an undoable action, including moving a stamp and clearing the page.
(() => {
  const galleryScreen = document.querySelector("#stampGalleryScreen");
  const screen = document.querySelector("#stampScreen");
  const gallery = document.querySelector("#stampGallery");
  const canvas = document.querySelector("#stampCanvas");
  const context = canvas.getContext("2d");
  const categoryTray = document.querySelector("#stampCategoryTray");
  const tray = document.querySelector("#stampTray");
  const undoButton = document.querySelector("#stampUndo");
  const clearButton = document.querySelector("#stampClear");

  let manifest = null;
  let scene = null;
  let sceneImage = null;
  let selectedStampId = null;
  let selectedSizeRatio = 0.18;
  let items = [];
  let history = [];
  let drag = null;
  let clearArmed = false;
  let clearTimer = null;
  const stampImages = new Map();

  const STAMP_CATEGORIES = [
    { id: "plants", title: "Plants", cover: "stamp-fern" },
    { id: "animals", title: "Animal Friends", cover: "stamp-butterfly" },
    { id: "sky", title: "Sky", cover: "stamp-sun" },
    { id: "fun", title: "Fun", cover: "stamp-heart" },
    { id: "weather", title: "Weather & Sky", cover: "stamp-weather-rain-cloud" },
    { id: "garden-friends", title: "Bugs & Garden Friends", cover: "stamp-garden-ladybird" }
  ];
  const ANIMAL_STAMPS = new Set([
    "stamp-bee", "stamp-bird", "stamp-bunny", "stamp-butterfly", "stamp-cat",
    "stamp-dog", "stamp-fish", "stamp-ladybug", "stamp-snail", "stamp-turtle"
  ]);
  const SKY_STAMPS = new Set([
    "stamp-cloud", "stamp-moon", "stamp-rainbow", "stamp-star", "stamp-sun"
  ]);

  function hideAllScreens() {
    document.querySelectorAll(".screen").forEach((element) => {
      element.hidden = true;
    });
  }

  function sceneKey() {
    return scene ? scene.id : "blank";
  }

  function storageKey() {
    return `little-color-garden:stamps:${sceneKey()}`;
  }

  function cloneItems(source = items) {
    return source.map((item) => ({ ...item }));
  }

  function persist() {
    localStorage.setItem(storageKey(), JSON.stringify(items));
    undoButton.disabled = history.length === 0;
  }

  function rememberState() {
    history.push(cloneItems());
  }

  function stampDefinition(stampId) {
    return manifest.stamps.find((stamp) => stamp.id === stampId);
  }

  function drawStamp(item) {
    const image = stampImages.get(item.id);
    const definition = stampDefinition(item.id);
    if (!image || !definition) return;
    const ratio = definition.width / definition.height;
    const width = ratio >= 1 ? item.size : item.size * ratio;
    const height = ratio >= 1 ? item.size / ratio : item.size;
    context.drawImage(image, item.x - width / 2, item.y - height / 2, width, height);
  }

  function draw() {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (sceneImage) context.drawImage(sceneImage, 0, 0, canvas.width, canvas.height);
    items.forEach(drawStamp);
  }

  function restoreItems() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || "[]");
      items = Array.isArray(saved) ? saved : [];
    } catch {
      items = [];
    }
  }

  function openScene(nextScene) {
    scene = nextScene;
    sceneImage = null;
    history = [];
    disarmClear();
    restoreItems();

    canvas.width = scene ? scene.width : 1000;
    canvas.height = scene ? scene.height : 700;
    hideAllScreens();
    screen.hidden = false;
    document.querySelector("#stampTitle").textContent = scene ? scene.title : "Blank Page";
    undoButton.disabled = true;

    if (!scene) {
      draw();
      return;
    }

    sceneImage = new Image();
    sceneImage.addEventListener("load", draw);
    sceneImage.src = `./${scene.file}`;
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height
    };
  }

  function stampAtPoint(point) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (Math.hypot(point.x - item.x, point.y - item.y) <= item.size / 2) {
        return index;
      }
    }
    return -1;
  }

  function placeStamp(point) {
    if (!selectedStampId) return;
    rememberState();
    items.push({
      id: selectedStampId,
      x: point.x,
      y: point.y,
      size: selectedSizeRatio * Math.min(canvas.width, canvas.height)
    });
    draw();
    persist();
    window.tinyPop(420, 0.05);
  }

  function beginPointer(event) {
    event.preventDefault();
    disarmClear();
    const point = canvasPoint(event);
    const itemIndex = stampAtPoint(point);
    if (itemIndex < 0) {
      placeStamp(point);
      return;
    }

    const item = items[itemIndex];
    drag = {
      index: itemIndex,
      dx: point.x - item.x,
      dy: point.y - item.y,
      before: cloneItems(),
      moved: false
    };
    canvas.setPointerCapture(event.pointerId);
  }

  function movePointer(event) {
    if (!drag) return;
    event.preventDefault();
    const point = canvasPoint(event);
    const item = items[drag.index];
    item.x = point.x - drag.dx;
    item.y = point.y - drag.dy;
    drag.moved = true;
    draw();
  }

  function endPointer(event) {
    if (!drag) return;
    event.preventDefault();
    if (drag.moved) {
      history.push(drag.before);
      persist();
    }
    drag = null;
  }

  function undo() {
    if (!history.length) return;
    items = history.pop();
    draw();
    persist();
    disarmClear();
    window.tinyPop(300, 0.08);
  }

  function disarmClear() {
    clearArmed = false;
    clearButton.classList.remove("is-armed");
    if (clearTimer) {
      window.clearTimeout(clearTimer);
      clearTimer = null;
    }
  }

  function clearPage() {
    if (!items.length) {
      disarmClear();
      return;
    }
    if (!clearArmed) {
      clearArmed = true;
      clearButton.classList.add("is-armed");
      clearTimer = window.setTimeout(disarmClear, 6000);
      window.tinyPop(360, 0.05);
      return;
    }

    rememberState();
    items = [];
    draw();
    persist();
    disarmClear();
    window.tinyPop(320, 0.07);
  }

  function savePicture() {
    const link = document.createElement("a");
    link.download = `my-stamp-picture-${sceneKey()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function stampCategory(stampId) {
    if (stampId.startsWith("stamp-weather-")) return "weather";
    if (stampId.startsWith("stamp-garden-")) return "garden-friends";
    if (ANIMAL_STAMPS.has(stampId)) return "animals";
    if (SKY_STAMPS.has(stampId)) return "sky";
    if (stampId === "stamp-heart") return "fun";
    return "plants";
  }

  function selectStamp(stampId, button, feedback = true) {
    selectedStampId = stampId;
    tray.querySelectorAll("button").forEach((candidate) => {
      candidate.classList.toggle("is-selected", candidate === button);
    });
    if (feedback) window.tinyPop(260, 0.04);
  }

  function showStampCategory(categoryId, categoryButton, feedback = true) {
    categoryTray.querySelectorAll("button").forEach((candidate) => {
      candidate.classList.toggle("is-selected", candidate === categoryButton);
    });
    tray.querySelectorAll("button").forEach((button) => {
      button.hidden = button.dataset.category !== categoryId;
    });
    const firstVisible = tray.querySelector("button:not([hidden])");
    if (firstVisible) selectStamp(firstVisible.dataset.id, firstVisible, feedback);
  }

  function buildStampTray() {
    manifest.stamps.forEach((stamp) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.id = stamp.id;
      button.dataset.category = stampCategory(stamp.id);
      button.setAttribute("aria-label", `${stamp.title} stamp`);

      const image = document.createElement("img");
      image.src = `./${stamp.file}`;
      image.alt = "";
      button.appendChild(image);
      button.addEventListener("click", () => selectStamp(stamp.id, button));
      tray.appendChild(button);
    });
  }

  function buildCategoryTray() {
    STAMP_CATEGORIES.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.category = category.id;
      button.setAttribute("aria-label", category.title);
      const cover = stampDefinition(category.cover);
      const image = document.createElement("img");
      image.src = `./${cover.file}`;
      image.alt = "";
      button.appendChild(image);
      button.addEventListener("click", () => showStampCategory(category.id, button));
      categoryTray.appendChild(button);
    });
    const firstCategory = categoryTray.querySelector("button");
    if (firstCategory) showStampCategory(firstCategory.dataset.category, firstCategory, false);
  }

  function buildGallery() {
    const blankButton = document.createElement("button");
    blankButton.className = "activity-card";
    blankButton.type = "button";
    blankButton.setAttribute("aria-label", "Start with a blank stamping page");
    const blankTile = document.createElement("span");
    blankTile.className = "blank-tile";
    const blankIcon = document.createElement("span");
    blankIcon.className = "blank-tile-icon";
    blankIcon.setAttribute("aria-hidden", "true");
    blankIcon.textContent = "✏️ ✨";
    const blankTitle = document.createElement("b");
    blankTitle.textContent = "Blank Page";
    blankTile.append(blankIcon, blankTitle);
    blankButton.appendChild(blankTile);
    blankButton.addEventListener("click", () => openScene(null));
    gallery.appendChild(blankButton);

    manifest.scenes.forEach((entry) => {
      const button = document.createElement("button");
      button.className = "activity-card";
      button.type = "button";
      button.setAttribute("aria-label", `Stamp on the ${entry.title} scene`);
      const image = document.createElement("img");
      image.src = `./${entry.file}`;
      image.alt = "";
      const title = document.createElement("b");
      title.textContent = entry.title;
      button.append(image, title);
      button.addEventListener("click", () => openScene(entry));
      gallery.appendChild(button);
    });
  }

  async function loadStampImages() {
    await Promise.all(manifest.stamps.map((stamp) => new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", resolve);
      image.addEventListener("error", reject);
      image.src = `./${stamp.file}`;
      stampImages.set(stamp.id, image);
    })));
  }

  async function initialise() {
    const response = await fetch("./data/stamps.json");
    manifest = await response.json();
    await loadStampImages();
    buildStampTray();
    buildCategoryTray();
    buildGallery();
  }

  canvas.addEventListener("pointerdown", beginPointer);
  canvas.addEventListener("pointermove", movePointer);
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  undoButton.addEventListener("click", undo);
  clearButton.addEventListener("click", clearPage);
  document.querySelector("#stampSave").addEventListener("click", savePicture);

  document.querySelectorAll(".stamp-sizes button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedSizeRatio = Number(button.dataset.size);
      button.parentElement.querySelectorAll("button").forEach((candidate) => {
        candidate.classList.toggle("is-selected", candidate === button);
      });
    });
  });

  window.openStampGallery = () => {
    hideAllScreens();
    galleryScreen.hidden = false;
  };

  document.querySelector("#stampGalleryBack").addEventListener("click", () => {
    window.showModeMenu();
  });
  document.querySelector("#stampBack").addEventListener("click", () => window.openStampGallery());

  initialise().catch(() => {
    gallery.textContent = "Stamp pictures could not load.";
  });
})();

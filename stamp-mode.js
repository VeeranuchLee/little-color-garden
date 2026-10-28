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

  // Owner rule, 2026-10-20: no emoji in the UI -- the blank-page card's mark is
  // a drawn pencil and sparkle in the app's own rounded style. The svg's
  // <title> keeps the tile's text content non-empty (what the smoke checks).
  const BLANK_TILE_MARK =
    '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><title>Draw your own picture</title>' +
    '<path d="M17.1 3.2a2.7 2.7 0 0 1 3.8 3.8L8 19.9l-5.6 1.7 1.7-5.6z" fill="currentColor"/></svg>' +
    '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" fill="currentColor"/></svg>';

  let manifest = null;
  let definitions = [];
  let scene = null;
  let sceneImage = null;
  let selectedStampId = null;
  let selectedSizeRatio = 0.18;
  let items = [];
  let history = [];
  let drag = null;
  let clearArmed = false;
  let clearTimer = null;
  let selectedUid = null;
  let uidSeq = 1;
  const stampImages = new Map();
  const rotateButton = document.querySelector("#stampRotate");
  const flipButton = document.querySelector("#stampFlip");
  const turn = window.cgTurn;
  const holdTurn = window.cgHoldTurn;
  const packs = window.cgStickerPacks || {};
  const tileArt = window.cgTileArt;

  // Owner request 2026-10-25: "i want more bg and stamps for 'stamping'
  // (space, princess, unicorn, under the sea, normal school life bg. with
  // number and letter stamping)". The first six groups are Stamping's own
  // art; Space, Princess, Under the Sea and Magic Castle reuse Blank Page's
  // sticker packs from where they live (assets/blank-stamps/); Unicorn and
  // School are the new stamp art; Letters and Numbers are the shared tiles.
  // Every group has a cover picture -- the tabs are pictures, not words.
  const STAMP_CATEGORIES = [
    { id: "plants", title: "Plants", cover: "stamp-fern" },
    { id: "animals", title: "Animal Friends", cover: "stamp-butterfly" },
    { id: "sky", title: "Sky", cover: "stamp-sun" },
    { id: "fun", title: "Fun", cover: "stamp-heart" },
    { id: "weather", title: "Weather & Sky", cover: "stamp-weather-rain-cloud" },
    { id: "garden-friends", title: "Bugs & Garden Friends", cover: "stamp-garden-ladybird" },
    { id: "space", title: "Space", cover: "pack-space-rocket" },
    { id: "princess", title: "Princess", cover: "pack-princess-crown" },
    { id: "unicorn", title: "Unicorn", cover: "stamp-unicorn-unicorn-head" },
    { id: "under-the-sea", title: "Under the Sea", cover: "pack-mermaid-tail" },
    { id: "castle", title: "Magic Castle", cover: "pack-castle-rainbow-castle" },
    { id: "school", title: "School", cover: "stamp-school-backpack" },
    { id: "home", title: "Home & Tea Party", cover: "pack-home-teapot" },
    { id: "dinosaurs", title: "Dinosaurs", cover: "pack-dinosaurs-t-rex" },
    { id: "effects", title: "Magic Effects", cover: "pack-effects-campfire-flames" },
    { id: "letters", title: "Letters", coverTile: "ABC" },
    { id: "numbers", title: "Numbers", coverTile: "123" }
  ];
  // Under the Sea is the Ocean pack plus the Mermaid stickers that are not a
  // second drawing of something Ocean already has (seahorse, coral, starfish,
  // dolphin, shell), so one tray never shows two of the same animal.
  const SEA_REPEATS = new Set(["seahorse", "coral", "starfish", "dolphin", "seashell"]);
  const PACK_GROUPS = [
    ["space", "space"],
    ["princess", "princess"],
    ["ocean", "under-the-sea"],
    ["mermaid", "under-the-sea"],
    ["castle", "castle"],
    ["home", "home"],
    ["dinosaurs", "dinosaurs"],
    ["effects", "effects"]
  ];
  // The scene gallery's order and names, and the group each scene opens on.
  // Every group stays one tap away; the default only saves a hunt.
  const SCENE_INFO = {
    "scene-garden": { group: "plants" },
    "scene-sea": { group: "under-the-sea" },
    "scene-sky": { group: "sky" },
    "scene-space": { group: "space" },
    "scene-princess": { group: "princess" },
    "scene-unicorn": { group: "unicorn" },
    "scene-undersea": { title: "Under the Sea", group: "under-the-sea" },
    "scene-school": { title: "School", group: "school" }
  };
  const SCENE_ORDER = Object.keys(SCENE_INFO);
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
    try {
      localStorage.setItem(storageKey(), JSON.stringify(items));
    } catch (_) {
      // Private browsing or a full store: the picture still works, unsaved.
    }
    undoButton.disabled = history.length === 0;
  }

  function rememberState() {
    history.push(cloneItems());
  }

  function stampDefinition(stampId) {
    return definitions.find((stamp) => stamp.id === stampId);
  }

  // The art's own width and height. A reused sticker pack carries no size in
  // the manifest, so it is read from the picture once it has loaded.
  function artSize(definition) {
    if (definition.width && definition.height) return definition;
    const image = stampImages.get(definition.id);
    if (image && image.naturalWidth) {
      definition.width = image.naturalWidth;
      definition.height = image.naturalHeight;
      return definition;
    }
    return null;
  }

  // Blank Page's sticker art keeps a clear margin around each picture (up to
  // 60% of its height on the tall ones), which is right for a sticker but made
  // the same art a small stamp. Each reused picture is measured once by its
  // visible pixels; Stamping draws and shows only that part, so a reused
  // rocket is as big as Stamping's own stamps. The files are unchanged.
  function trimToArt(definition, image) {
    try {
      const probe = document.createElement("canvas");
      probe.width = image.naturalWidth;
      probe.height = image.naturalHeight;
      const probeContext = probe.getContext("2d", { willReadFrequently: true });
      probeContext.drawImage(image, 0, 0);
      const { data, width, height } = probeContext.getImageData(0, 0, probe.width, probe.height);
      let left = width, top = height, right = -1, bottom = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (data[(y * width + x) * 4 + 3] > 8) {
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
      }
      if (right < left || bottom < top) return;
      const crop = { sx: left, sy: top, sw: right - left + 1, sh: bottom - top + 1 };
      definition.crop = crop;
      definition.width = crop.sw;
      definition.height = crop.sh;
      const thumbScale = Math.min(1, 144 / Math.max(crop.sw, crop.sh));
      const thumb = document.createElement("canvas");
      thumb.width = Math.max(1, Math.round(crop.sw * thumbScale));
      thumb.height = Math.max(1, Math.round(crop.sh * thumbScale));
      thumb.getContext("2d").drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, thumb.width, thumb.height);
      const url = thumb.toDataURL("image/png");
      document.querySelectorAll(`img[data-stamp-id="${definition.id}"]`).forEach((picture) => { picture.src = url; });
      definition.thumb = url;
    } catch (_) {
      // Unreadable pixels: keep the whole picture, margin and all.
    }
  }

  function stampBox(item) {
    const definition = stampDefinition(item.id);
    const size = definition && artSize(definition);
    if (!size) return null;
    const ratio = size.width / size.height;
    return {
      width: ratio >= 1 ? item.size : item.size * ratio,
      height: ratio >= 1 ? item.size / ratio : item.size
    };
  }

  // Owner report 2026-10-25: "i see stickers that cut off at the edges."
  // The scene is the whole picture -- what Save exports and nothing beyond it
  // -- so a stamp is kept whole on it: its centre is held at least half a
  // stamp in from every edge, whether it is placed, dragged, turned or
  // restored. A turned stamp is measured by the box it really covers.
  function keepOnPage(item) {
    const box = stampBox(item);
    if (!box) return item;
    const covered = turn ? turn.box(box.width, box.height, item.rot || 0) : box;
    const halfWidth = Math.min(covered.width, canvas.width) / 2;
    const halfHeight = Math.min(covered.height, canvas.height) / 2;
    item.x = Math.min(canvas.width - halfWidth, Math.max(halfWidth, item.x));
    item.y = Math.min(canvas.height - halfHeight, Math.max(halfHeight, item.y));
    return item;
  }

  // Mirror first, in the stamp's own frame, then turn -- the same order as the
  // Blank Page sticker's CSS (sticker-kit.js), so both modes agree.
  function drawStamp(item) {
    const image = stampImages.get(item.id);
    const box = stampBox(item);
    if (!image || !box) return;
    context.save();
    context.translate(item.x, item.y);
    context.rotate((item.rot || 0) * Math.PI / 180);
    if (item.flip) context.scale(-1, 1);
    const crop = stampDefinition(item.id).crop;
    if (crop) context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, -box.width / 2, -box.height / 2, box.width, box.height);
    else context.drawImage(image, -box.width / 2, -box.height / 2, box.width, box.height);
    context.restore();
  }

  function selectedItem() {
    return items.find((item) => item.uid === selectedUid) || null;
  }

  // The selected stamp wears a dashed ring on screen only: Save draws the
  // picture without it.
  function drawSelection(item) {
    const box = stampBox(item);
    if (!box) return;
    const pad = Math.max(8, canvas.width * 0.008);
    context.save();
    context.translate(item.x, item.y);
    context.rotate((item.rot || 0) * Math.PI / 180);
    context.lineWidth = Math.max(5, canvas.width * 0.006);
    context.setLineDash([context.lineWidth * 2.4, context.lineWidth * 1.6]);
    context.strokeStyle = "#ffd83d";
    context.shadowColor = "rgba(64, 48, 109, .45)";
    context.shadowBlur = 6;
    context.strokeRect(-box.width / 2 - pad, -box.height / 2 - pad, box.width + pad * 2, box.height + pad * 2);
    context.restore();
  }

  function updateTransformButtons() {
    const visible = Boolean(selectedItem());
    [rotateButton, flipButton].forEach((button) => {
      if (!button) return;
      button.classList.toggle("is-hidden", !visible);
      button.disabled = !visible;
    });
  }

  function draw(showSelection = true) {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (sceneImage) context.drawImage(sceneImage, 0, 0, canvas.width, canvas.height);
    items.forEach(drawStamp);
    const selected = showSelection && selectedItem();
    if (selected) drawSelection(selected);
    updateTransformButtons();
  }

  function restoreItems() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || "[]");
      items = Array.isArray(saved)
        ? saved
          .filter((item) => item && stampDefinition(item.id) && [item.x, item.y, item.size].every(Number.isFinite))
          .map((item) => ({
            uid: uidSeq++,
            id: item.id,
            x: item.x,
            y: item.y,
            size: item.size,
            rot: turn ? turn.normalise(item.rot || 0) : 0,
            flip: item.flip === true
          }))
        : [];
    } catch {
      items = [];
    }
  }

  function openScene(nextScene) {
    scene = nextScene;
    sceneImage = null;
    history = [];
    selectedUid = null;
    disarmClear();
    restoreItems();

    canvas.width = scene ? scene.width : 1000;
    canvas.height = scene ? scene.height : 700;
    // Pictures saved before 2026-10-25 may hold stamps hanging off the edge.
    items.forEach(keepOnPage);
    hideAllScreens();
    screen.hidden = false;
    document.querySelector("#stampTitle").textContent = scene ? sceneTitle(scene) : "Blank Page";
    undoButton.disabled = true;
    openGroup(scene && SCENE_INFO[scene.id] ? SCENE_INFO[scene.id].group : STAMP_CATEGORIES[0].id);

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
    const item = keepOnPage({
      uid: uidSeq++,
      id: selectedStampId,
      x: point.x,
      y: point.y,
      size: selectedSizeRatio * Math.min(canvas.width, canvas.height),
      rot: 0,
      flip: false
    });
    items.push(item);
    // The new stamp arrives selected, so Turn and Flip are right there.
    selectedUid = item.uid;
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
    if (selectedUid !== item.uid) {
      selectedUid = item.uid;
      draw();
      window.tinyPop(620, 0.03);
    }
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
    keepOnPage(item);
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
    if (!selectedItem()) selectedUid = null;
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
    selectedUid = null;
    draw();
    persist();
    disarmClear();
    window.tinyPop(320, 0.07);
  }

  function savePicture() {
    // Exactly the picture as shown, turns and mirrors included, minus the
    // selection ring.
    draw(false);
    const link = document.createElement("a");
    link.download = `my-stamp-picture-${sceneKey()}.png`;
    link.href = canvas.toDataURL("image/png");
    draw();
    link.click();
  }

  function transformSelected(change, tone) {
    const item = selectedItem();
    if (!item) return;
    disarmClear();
    rememberState();
    change(item);
    keepOnPage(item);
    draw();
    persist();
    window.tinyPop(tone, 0.05);
  }

  function flipSelected() {
    transformSelected((item) => { item.flip = !item.flip; }, 500);
  }

  function stampCategory(stampId) {
    const definition = stampDefinition(stampId);
    if (definition && definition.group) return definition.group;
    if (stampId.startsWith("stamp-weather-")) return "weather";
    if (stampId.startsWith("stamp-garden-")) return "garden-friends";
    if (stampId.startsWith("stamp-school-")) return "school";
    if (stampId.startsWith("stamp-unicorn-")) return "unicorn";
    if (ANIMAL_STAMPS.has(stampId)) return "animals";
    if (SKY_STAMPS.has(stampId)) return "sky";
    if (stampId === "stamp-heart") return "fun";
    return "plants";
  }

  function sceneTitle(entry) {
    const info = SCENE_INFO[entry.id];
    return info && info.title ? info.title : entry.title;
  }

  // Everything a child can stamp: this mode's manifest, the reused sticker
  // packs, then the letter and number tiles.
  function buildDefinitions() {
    definitions = manifest.stamps.map((stamp) => ({ ...stamp }));
    PACK_GROUPS.forEach(([pack, group]) => {
      (packs[pack] || []).forEach((name) => {
        if (pack === "mermaid" && SEA_REPEATS.has(name)) return;
        definitions.push({
          id: `pack-${pack}-${name}`,
          title: name.replaceAll("-", " "),
          file: `assets/blank-stamps/${pack}-${name}.webp`,
          group
        });
      });
    });
    if (tileArt) {
      [["letters", tileArt.LETTERS], ["numbers", tileArt.NUMBERS]].forEach(([group, values]) => {
        values.forEach((value) => {
          definitions.push({ id: `tile-${value}`, title: value, tile: value, width: 1, height: 1, group });
        });
      });
    }
  }

  function imageSource(definition) {
    if (definition.tile) return tileArt.url(definition.tile);
    return definition.thumb || `./${definition.file}`;
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
    tray.scrollTo({ left: 0, top: 0 });
    const firstVisible = tray.querySelector("button:not([hidden])");
    if (firstVisible) selectStamp(firstVisible.dataset.id, firstVisible, feedback);
  }

  function buildStampTray() {
    definitions.forEach((stamp) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.id = stamp.id;
      button.dataset.category = stampCategory(stamp.id);
      if (stamp.tile) button.classList.add("stamp-tile");
      button.setAttribute("aria-label", `${stamp.title} stamp`);

      const image = document.createElement("img");
      image.src = imageSource(stamp);
      image.alt = "";
      image.dataset.stampId = stamp.id;
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
      const image = document.createElement("img");
      image.src = category.coverTile ? tileArt.url(category.coverTile) : imageSource(stampDefinition(category.cover));
      image.alt = "";
      if (category.cover) image.dataset.stampId = category.cover;
      button.appendChild(image);
      button.addEventListener("click", () => showStampCategory(category.id, button));
      categoryTray.appendChild(button);
    });
    const firstCategory = categoryTray.querySelector("button");
    if (firstCategory) showStampCategory(firstCategory.dataset.category, firstCategory, false);
  }

  // Open a scene on its own group, and bring that group's tab into view in
  // the tray (a whole tab, never one half under the "more" cue).
  function openGroup(categoryId) {
    const button = categoryTray.querySelector(`button[data-category="${categoryId}"]`);
    if (!button) return;
    showStampCategory(categoryId, button, false);
    if (typeof categoryTray.revealWhole === "function") categoryTray.revealWhole(button);
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
    blankIcon.innerHTML = BLANK_TILE_MARK;
    const blankTitle = document.createElement("b");
    blankTitle.textContent = "Blank Page";
    blankTile.append(blankIcon, blankTitle);
    blankButton.appendChild(blankTile);
    blankButton.addEventListener("click", () => openScene(null));
    gallery.appendChild(blankButton);

    const scenes = [...manifest.scenes].sort((first, second) => {
      const rank = (entry) => (SCENE_ORDER.includes(entry.id) ? SCENE_ORDER.indexOf(entry.id) : SCENE_ORDER.length);
      return rank(first) - rank(second);
    });
    scenes.forEach((entry) => {
      const button = document.createElement("button");
      button.className = "activity-card";
      button.type = "button";
      button.setAttribute("aria-label", `Stamp on the ${sceneTitle(entry)} scene`);
      const image = document.createElement("img");
      image.src = `./${entry.file}`;
      image.alt = "";
      const title = document.createElement("b");
      title.textContent = sceneTitle(entry);
      button.append(image, title);
      button.addEventListener("click", () => openScene(entry));
      gallery.appendChild(button);
    });
  }

  // Stamping's own art is loaded before the gallery opens, as before. The
  // reused packs load behind it; a stamp placed before its picture arrives is
  // drawn (and kept whole) the moment it does. Tiles are painted on the spot.
  function loadImage(definition) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", reject);
      image.src = `./${definition.file}`;
      stampImages.set(definition.id, image);
    });
  }

  async function loadStampImages() {
    definitions.filter((stamp) => stamp.tile).forEach((stamp) => {
      stampImages.set(stamp.id, tileArt.canvas(stamp.tile));
    });
    definitions.filter((stamp) => stamp.group && !stamp.tile).forEach((stamp) => {
      loadImage(stamp).then((image) => {
        trimToArt(stamp, image);
        let touched = false;
        items.forEach((item) => {
          if (item.id === stamp.id) {
            keepOnPage(item);
            touched = true;
          }
        });
        if (touched && !screen.hidden) draw();
      }).catch(() => {});
    });
    await Promise.all(manifest.stamps.map((stamp) => loadImage(stamp)));
  }

  async function initialise() {
    const response = await fetch("./data/stamps.json");
    manifest = await response.json();
    buildDefinitions();
    await loadStampImages();
    buildStampTray();
    buildCategoryTray();
    buildGallery();
    if (window.wholeItemTray) {
      window.wholeItemTray(tray);
      window.wholeItemTray(categoryTray);
    }
  }

  canvas.addEventListener("pointerdown", beginPointer);
  canvas.addEventListener("pointermove", movePointer);
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  undoButton.addEventListener("click", undo);
  clearButton.addEventListener("click", clearPage);
  document.querySelector("#stampSave").addEventListener("click", savePicture);
  if (rotateButton && holdTurn) {
    let heldItem = null;
    let heldBefore = null;
    let heldStart = 0;
    holdTurn(rotateButton, {
      begin() {
        heldItem = selectedItem();
        if (!heldItem) return false;
        disarmClear(); heldBefore = cloneItems(); heldStart = heldItem.rot || 0;
        return true;
      },
      turn(degrees) {
        if (!heldItem) return;
        heldItem.rot = heldStart + degrees;
        keepOnPage(heldItem); draw();
      },
      end({ tap }) {
        if (!heldItem) return;
        if (tap) heldItem.rot = heldStart + (turn ? turn.STEP : 15);
        keepOnPage(heldItem); history.push(heldBefore); draw(); persist();
        window.tinyPop(560, 0.05);
        heldItem = null; heldBefore = null;
      }
    });
  }
  if (flipButton) flipButton.addEventListener("click", flipSelected);
  document.querySelectorAll(".stamp-music").forEach((button) => {
    button.addEventListener("click", () => {
      if (window.cgStampMusic) window.cgStampMusic.toggle();
    });
  });

  // Only the three size buttons: Turn and Flip share the row but not this job.
  document.querySelectorAll(".stamp-sizes button[data-size]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedSizeRatio = Number(button.dataset.size);
      button.parentElement.querySelectorAll("button[data-size]").forEach((candidate) => {
        candidate.classList.toggle("is-selected", candidate === button);
      });
    });
  });

  // Calm music while in Stamping (owner request 2026-10-25): it starts on the
  // tap that opens Stamping and fades when the child goes back to the menu.
  window.openStampGallery = () => {
    hideAllScreens();
    galleryScreen.hidden = false;
    if (window.cgStampMusic) window.cgStampMusic.enter();
  };

  document.querySelector("#stampGalleryBack").addEventListener("click", () => {
    if (window.cgStampMusic) window.cgStampMusic.leave();
    window.showModeMenu();
  });
  document.querySelector("#stampBack").addEventListener("click", () => window.openStampGallery());

  initialise().catch(() => {
    gallery.textContent = "Stamp pictures could not load.";
  });
})();

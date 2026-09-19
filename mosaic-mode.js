"use strict";

// Mosaic — card 3 of the Color Garden hub (owner decision, 2026-09-15):
// "pictures divided into many distinct enclosed shapes, like stained glass.
// No numbers." The spec is deliberate that Mosaic is a top-level card and not
// a content group inside a fill tool: to a child, "fill the shapes however
// you like" is a different activity from Coloring's brush, and from card 4's
// numbered regions. Tap-to-fill stays the *interaction*; it is not a
// destination of its own.
//
// That is why this file is only a doorway. The fill itself, the palette, the
// paper, undo, clear, the celebration and the saving are app.js's coloring
// machinery — a mosaic sheet enters through openPage with kind "mosaic" and
// takes the coloring screen's fill path exactly as a coloring page does. If a
// second flood fill ever grows here, that is the bug.
(() => {
  const screen = document.querySelector("#mosaicGalleryScreen");
  if (!screen) return;

  // Same entry shape as app.js's PAGES. `folder` points the page loader at
  // the mosaic art; `kind` is the branch openPage reads. There is no
  // `background` on purpose — the board keeps the coloring screen's own calm
  // gradient — and no references exist for these sheets, so there is no peek.
  const MOSAIC_PAGES = [
    { id: "happy-rocket", kind: "mosaic", folder: "mosaic", file: "happy-rocket.png", voice: "the happy rocket", card: "#cfe3ff" },
    { id: "sea-turtle", kind: "mosaic", folder: "mosaic", file: "sea-turtle.png", voice: "the sea turtle", card: "#cff3d3" },
    { id: "smiling-sunflower", kind: "mosaic", folder: "mosaic", file: "smiling-sunflower.png", voice: "the smiling sunflower", card: "#fff8c9" },
    { id: "abstract-bands", kind: "mosaic", folder: "mosaic", file: "abstract-bands.png", voice: "the rainbow bands", card: "#ffd9e3" },
    { id: "abstract-centerstone", kind: "mosaic", folder: "mosaic", file: "abstract-centerstone.png", voice: "the magic gem", card: "#e2d9ff" },
    { id: "abstract-crazy-paving", kind: "mosaic", folder: "mosaic", file: "abstract-crazy-paving.png", voice: "the puzzle stones", card: "#ffe6c9" },
    { id: "abstract-pebbles", kind: "mosaic", folder: "mosaic", file: "abstract-pebbles.png", voice: "the pebbles", card: "#d9efe4" },
    { id: "abstract-rings", kind: "mosaic", folder: "mosaic", file: "abstract-rings.png", voice: "the rainbow rings", card: "#d9ecff" },
    { id: "abstract-shards", kind: "mosaic", folder: "mosaic", file: "abstract-shards.png", voice: "the crystal pieces", card: "#f3e0ff" },
    { id: "space-planet", kind: "mosaic", folder: "mosaic", file: "space-planet.png", voice: "the planet", card: "#d7e8ff" },
    { id: "space-rocket", kind: "mosaic", folder: "mosaic", file: "space-rocket.png", voice: "the rocket", card: "#cfe0ff" },
    { id: "space-astronaut", kind: "mosaic", folder: "mosaic", file: "space-astronaut.png", voice: "the astronaut", card: "#e3e9ff" },
    { id: "princess-crown", kind: "mosaic", folder: "mosaic", file: "princess-crown.png", voice: "the princess crown", card: "#ffe3f1" },
    { id: "princess-mermaid", kind: "mosaic", folder: "mosaic", file: "princess-mermaid.png", voice: "the mermaid", card: "#d9f2f7" },
    { id: "princess-seashells", kind: "mosaic", folder: "mosaic", file: "princess-seashells.png", voice: "the seashells", card: "#ffeede" },
    { id: "sweet-ice-cream", kind: "mosaic", folder: "mosaic", file: "sweet-ice-cream.png", voice: "the ice cream", card: "#ffe9f0" },
    { id: "sweet-cake", kind: "mosaic", folder: "mosaic", file: "sweet-cake.png", voice: "the cake", card: "#fff1d9" },
    { id: "sweet-cupcake", kind: "mosaic", folder: "mosaic", file: "sweet-cupcake.png", voice: "the cupcake", card: "#ffe6ec" },
    { id: "abstract-fine-100", kind: "mosaic", folder: "mosaic", file: "abstract-fine-100.png", voice: "Little Pieces", card: "#e7f0e2" },
    { id: "abstract-fine-130", kind: "mosaic", folder: "mosaic", file: "abstract-fine-130.png", voice: "More Pieces", card: "#e2eef0" },
    { id: "abstract-fine-160", kind: "mosaic", folder: "mosaic", file: "abstract-fine-160.png", voice: "Tiny Pieces", card: "#eee6f5" },
    { id: "abstract-fine-180", kind: "mosaic", folder: "mosaic", file: "abstract-fine-180.png", voice: "Super Tiny Pieces", card: "#f5ebe0" },
    { id: "abstract-fine-200", kind: "mosaic", folder: "mosaic", file: "abstract-fine-200.png", voice: "Mosaic Challenge", card: "#e9e4f5" }
  ];

  // app.js's helpers are global function declarations; resolve them through
  // window so this IIFE's own names cannot shadow them mid-initialisation.
  const speak = typeof window.speak === "function" ? window.speak : () => {};
  const pop = typeof window.tinyPop === "function" ? window.tinyPop : () => {};
  const stopMusic = typeof window.stopGalleryMusic === "function" ? window.stopGalleryMusic : () => {};
  const openPage = typeof window.openPage === "function" ? window.openPage : null;
  const showModeMenu = typeof window.showModeMenu === "function" ? window.showModeMenu : null;

  const gallery = document.querySelector("#mosaicGallery");

  // The cards are the coloring gallery's own: same page-card, same line-art
  // preview, same "Color the..." label. Choosing a mosaic is choosing a
  // sheet, the way Coloring lets a child choose one.
  function buildMosaicGallery() {
    const fragment = document.createDocumentFragment();
    MOSAIC_PAGES.forEach((page) => {
      const button = document.createElement("button");
      button.className = "page-card";
      button.type = "button";
      button.setAttribute("aria-label", `Color ${page.voice}`);
      button.style.setProperty("--card-color", page.card);

      const image = document.createElement("img");
      image.src = `./assets/mosaic/${page.file}`;
      image.alt = "";
      image.draggable = false;
      button.appendChild(image);
      button.addEventListener("click", () => {
        if (!openPage) return;
        screen.hidden = true;
        openPage(page);
      });
      fragment.appendChild(button);
    });
    gallery.appendChild(fragment);
  }

  function showMosaicGallery() {
    stopMusic();
    document.querySelector("#modeMenuScreen").hidden = true;
    screen.hidden = false;
    document.body.style.background = "#6fa4dc";
    speak("mosaic.gallery");
  }

  function backToMenu() {
    screen.hidden = true;
    // app.js's showModeMenu hides the coloring gallery, brings the menu back
    // and speaks the three-card line; this screen is hidden on the line above
    // because that function does not know it exists.
    if (showModeMenu) showModeMenu();
  }

  document.querySelector("#mosaicGalleryBack").addEventListener("click", backToMenu);
  document.querySelector("#mosaicGalleryVoice").addEventListener("click", () =>
    speak("mosaic.directions")
  );

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !screen.hidden) backToMenu();
  });

  // app.js's goHome comes back to the first door; the mode menu's Mosaic card
  // calls the second — the same pair of doors pixel-mode.js publishes, for the
  // same reason: this file loads after the one that owns the menu.
  window.showMosaicGallery = showMosaicGallery;
  window.openMosaicGallery = () => {
    showMosaicGallery();
    pop(520, 0.06);
  };

  buildMosaicGallery();
})();

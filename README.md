# Little Color Garden

**Structure:** `COLOR-GARDEN-SPEC.md` is the current five-card mini-hub
(Pixel Art, Coloring Book, Mosaic, Color by Number, Stamping). Two are built.


A touch-first, voice-guided coloring app designed for preschool children. It is a static HTML/CSS/JavaScript site that can be hosted directly with GitHub Pages.

The app is designed landscape-first for tablets: in landscape the toolbar and colors sit in side columns, and the installed app (Add to Home Screen) asks the system for landscape via `manifest.webmanifest`. iPadOS ignores the manifest orientation hint, so on iPads the app simply follows how the tablet is held.

## Two modes

The app opens on a **mode menu** with two large choices, **Pixel** and **Coloring** (owner brief, 2026-09-14). The two activities are no longer mixed in one gallery. Back arrows climb one level at a time: a workspace goes to its gallery, a gallery goes to the mode menu, and the mode menu's arrow goes back to the children's hub.

**Coloring** is the coloring-book side: a gallery of line-art pages plus a
**Blank Page** as its first card — free drawing on a white page with exactly
brush, eraser and clear (`blank-page.js`). The coloring palette is **48
colors**, 12 hue families × 4 shades light-to-dark, pastel-leaning, with the
app's original ten colors kept as the classic row and white, greys, browns and
black for line art. The swatches are 48 px in both orientations: portrait lays
them as a 12 × 4 band under the tools; landscape stands them up as a 4 × 12
shelf in a right-hand column beside the studio tools, so the canvas keeps the
screen's full height.

**Pixel Mosaic** is a pegboard-style 20 × 15 grid the child fills by tapping or
dragging, with a challenge-card system — small pattern pictures (fruit, hearts,
flowers, animals, faces, vehicles) to copy, plus a free board.

- **Palette and cards are one system.** The palette is exactly 36 colors in
  3 rows × 12 columns — hue families in light / medium / dark (the medium
  row is the app's original ten colors), including **white / brown / dark
  brown** and **light grey / grey / black** columns and the lime and peach
  families the owner added on 2026-08-28. Every card is authored *in palette
  indices*, so no card can ask for a shade the child cannot pick.
  `tools/check-pixel-cards.js` holds that promise mechanically — run it after
  editing `pixel-cards.js`.
- **Board data** lives in `pixel-cards.js`; the mode's behaviour in
  `pixel-mode.js` (self-contained — it never touches the brush mode's state,
  and reuses only `speak()` / `tinyPop()` from `app.js`).
- A finished copy of a card celebrates, earns a ♥ on its gallery card, and is
  remembered in `localStorage`, one saved board per card (plus the free board).
- On a challenge card, empty cells that belong to the picture carry a **tinted
  region** — the area to fill, in the colours it wants — so copying is about
  colors, not counting cells. The free board shows no region.

## Artwork

Each picture has two assets that share a page id:

- `assets/pages/<id>.png` — the black-and-white line art the child colors.
- `assets/references/<id>.jpg` — a finished, professionally colored version. The reference (picture-frame) button in the toolbar toggles it on and off beside the child's canvas, and the choice is remembered across pages and visits.

Both are cut from the same source render, where the colored version and the line art sit side by side in one image. Add a new picture by dropping both files in and appending an entry to `PAGES` in `app.js` (and to `PAGE_IDS` in `service-worker.js` for offline caching).

The finished reference opens beside the child's canvas in portrait, and as a small card below the studio tools in landscape — beside the colours, never over the art or the swatches. Watercolor scene backgrounds in `assets/backgrounds/` are selected by page theme and cached for offline play.

## GitHub Pages

Publish the repository from the root of the `main` branch in **Settings → Pages**.

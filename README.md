# Little Color Garden

A touch-first, voice-guided coloring app designed for preschool children. It is a static HTML/CSS/JavaScript site that can be hosted directly with GitHub Pages.

The app is designed landscape-first for tablets: in landscape the toolbar and colors sit in side columns, and the installed app (Add to Home Screen) asks the system for landscape via `manifest.webmanifest`. iPadOS ignores the manifest orientation hint, so on iPads the app simply follows how the tablet is held.

## Use locally

Open `index.html` directly, or run any small static file server in this directory.

## Artwork

Each picture has two assets that share a page id:

- `assets/pages/<id>.png` — the black-and-white line art the child colors.
- `assets/references/<id>.jpg` — a finished, professionally colored version. The reference (picture-frame) button in the toolbar toggles it on and off beside the child's canvas, and the choice is remembered across pages and visits.

Both are cut from the same source render, where the colored version and the line art sit side by side in one image. Add a new picture by dropping both files in and appending an entry to `PAGES` in `app.js` (and to `PAGE_IDS` in `service-worker.js` for offline caching).

The finished reference opens on the left of the child's canvas. Watercolor scene backgrounds in `assets/backgrounds/` are selected by page theme and cached for offline play.

## GitHub Pages

Publish the repository from the root of the `main` branch in **Settings → Pages**.

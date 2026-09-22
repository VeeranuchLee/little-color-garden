#!/usr/bin/env python3
"""Mosaic fill safety harness -- the fill cannot escape, the mask cannot swallow.

Run:
    python3 coloring-app/tools/check-mosaic-fill.py                       # full, all sheets
    python3 coloring-app/tools/check-mosaic-fill.py --fast                # seconds-scale gate
    python3 coloring-app/tools/check-mosaic-fill.py --refresh-calibration # full + rewrite record

Requires Pillow (pip install pillow); preflight warns and skips when it is absent
locally, and CI installs it (pr.yml / main.yml / mosaic-certification.yml).

MEASURED COST, 2026-09-19 (measure, don't assume): the FULL certification is ~8.6 s
on this Mac (9 sheets, 3 passes each, pure Python). The "11m34s" sometimes attributed
to it was the ENTIRE preflight job of PR #768 across all its suites; the mosaic
portion of that job's 159 s suite step is a small slice. The split below is
architecture, not rescue: preflight carries the fast gate, full certification runs
where its inputs can change the answer (workflow paths + release + manual).

FULL certification proves, per sheet, over the whole corpus (owner-commissioned
2026-09-19, after "after fill color in, the color is out of the area often"):

  1. NO LEAK            a flood from inside any enclosed region paints exactly that
                        region and nothing else -- the fill never crosses a line.
  2. NO SWALLOW         the exterior mask (the corner-seeded flood the app builds at
                        load, same predicate) contains ZERO pixels of any enclosed
                        region -- masking the margin can never eat a legitimate edge
                        cell. The mask must equal the outside component exactly.
  3. EXTERIOR TAP       the app's floodFill seeded at exterior points (canvas corners,
                        mid edges, points just outside the card border) paints 0 px.
  4. POCKET RULE        a region paints iff it is over POCKET_MAX in area OR its
                        inscribed square is at least TAPPABLE_RADIUS wide-half -- so
                        compact cells (the sunflower's tongue, rocket segments,
                        turtle shell scales) fill, while thin interstitial slivers
                        (every measured one inscribes at most radius 2) paint 0 px.
                        No region may sit within CLEAR (5%) of POCKET_MAX -- a new
                        sheet forces a conscious re-measure.
  5. REGISTRATION       app.js computes one stored line-art draw rectangle per load,
                        and both the mask raster and displayed line art consume that
                        exact rectangle. Every sheet is evaluated through app.js's
                        real function, so a second transform cannot hide here.
  6. PAGES CORPUS       the same floodFill governs the Coloring Pages at their
                        natural size with NO exterior mask (app.js builds the mask
                        for mosaics only). Every enclosed region is classified by the
                        same rule 4 and its fill exactness proven. Before 2026-09-22
                        not one enclosed region filled on bird-princess, pink-princess,
                        hibiscus, ginger-lily, ylang-ylang or magic-princess -- the
                        Fill tool painted only the background there.

FAST gate (seconds): the calibration record is consistent (app.js constant == harness
constant == record), the corpus is exactly what was calibrated (every sheet present,
hash-identical -- changed or new art fails CONSCIOUSLY with the refresh instruction),
the representative sheet (happy-rocket, the photographed overflow case) still builds
a sane mask, refuses exterior taps (including just outside the border), fills its
largest cell exactly, and honours the threshold band, and the representative page
(hibiscus, the smallest pages sheet) honours the same classification.

POCKET_MAX PROVENANCE (Part C, 2026-09-19): 1815 is CORPUS/RASTER CALIBRATION DATA,
not a timeless UX constant. It is calibrated against: this nine-sheet corpus, the
724x1086 canvas, the min-scale centered bilinear pipeline, and the alpha>90 /
R+G+B<430 boundary predicate. Measured basis: largest pocket 1,685 px, smallest
region above it 1,943 px (both sea-turtle, the one sheet where they come close).
The machine-readable record lives at tools/mosaic-calibration.json and is the single
source the fast gate checks art against; refresh it only via --refresh-calibration
after a deliberate re-measure. Do not move the number because another number looks
cleaner.

TAPPABLE_RADIUS PROVENANCE (2026-09-22): 3 is CORPUS/RASTER CALIBRATION DATA for the
same predicate, measured by tools/measure-fill-regions.py over all 23 mosaic sheets
AND all 17 coloring pages. Every measured anti-aliasing sliver (the pockets POCKET_MAX
exists to refuse) inscribes at most a 5x5 square, radius 2; the smallest region a
child reads as a colorable dot inscribes 7x7, radius 3; and every owner-named
unfillable cell -- sunflower tongue r=13, happy-rocket segments r=13, space-planet
banded details r=10-14, space-rocket segments r=8-12, sea-turtle shell scales r=4,
astronaut face cells r=4-10 -- is at or above it. Radius is resolution-independent,
which is why one constant now serves both the 724x1086 mosaic canvas and the pages'
natural-size canvases. The measured basis is re-proven on every full run and lives in
the calibration record beside POCKET_MAX's.

The pipeline mirrors app.js exactly: canvas 724x1086, art scaled by
min(724/w, 1086/h) and centered (app.js loadPage onload), boundary predicate
alpha>90 AND R+G+B<430 (app.js isBoundary), exterior mask from the four corners
(app.js buildExteriorMask), pocket no-op at <=POCKET_MAX (app.js floodFill).
If either side changes, update the other in the same turn and say so here.
"""
import sys
from collections import deque

try:
    from PIL import Image
except ImportError:
    sys.stderr.write("WARNING: Pillow is not installed, so the mosaic fill harness was "
                     "skipped here. Install it with: python3 -m pip install --user pillow\n")
    sys.exit(0)  # preflight treats 0-with-warning as a skip; CI installs Pillow.

import glob
import hashlib
import json
import os
import re
import subprocess
import time

W, H = 724, 1086
POCKET_MAX = 1815   # MUST equal POCKET_MAX in coloring-app/app.js AND in mosaic-calibration.json
TAPPABLE_RADIUS = 3  # MUST equal TAPPABLE_RADIUS in app.js AND the record; see provenance above
CLEAR = 0.05        # no region may sit within 5% of POCKET_MAX, above or below
FAST_SHEET = "happy-rocket.png"  # the photographed overflow case: pockets + edge cells
FAST_PAGE = "hibiscus.png"       # smallest pages sheet; its r=3 dots sit on the rule's edge
HERE = os.path.dirname(os.path.abspath(__file__))
SHEETS_DIR = os.path.join(HERE, "..", "assets", "mosaic")
PAGES_DIR = os.path.join(HERE, "..", "assets", "pages")
CALIBRATION = os.path.join(HERE, "mosaic-calibration.json")

failures = []


def fail(sheet, msg):
    failures.append("%s: %s" % (sheet, msg))


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def app_js_constant(name):
    path = os.path.join(HERE, "..", "app.js")
    text = open(path, encoding="utf-8").read()
    m = re.search(r"const\s+%s\s*=\s*(\d+)\s*;" % re.escape(name), text)
    return int(m.group(1)) if m else None


def app_js_pocket_max():
    return app_js_constant("POCKET_MAX")


def app_js_tappable_radius():
    return app_js_constant("TAPPABLE_RADIUS")


def app_js_source():
    path = os.path.join(HERE, "..", "app.js")
    return open(path, encoding="utf-8").read()


def extract_js_function(text, name):
    """Return one complete ordinary JS function, balancing its braces."""
    match = re.search(r"function\s+%s\s*\([^)]*\)\s*\{" % re.escape(name), text)
    if not match:
        return None
    depth = 0
    for pos in range(match.end() - 1, len(text)):
        if text[pos] == "{":
            depth += 1
        elif text[pos] == "}":
            depth -= 1
            if depth == 0:
                return text[match.start():pos + 1]
    return None


def app_js_draw_rects(sheets):
    """Evaluate app.js's real draw-rect function and prove both consumers share it."""
    text = app_js_source()
    function = extract_js_function(text, "computeLineDrawRect")
    if function is None:
        fail("registration", "app.js has no computeLineDrawRect() single source")
        return {}
    if not re.search(r"let\s+lineDrawRect\s*=\s*null\s*;", text):
        fail("registration", "app.js does not store one lineDrawRect per page load")
    if len(re.findall(r"lineDrawRect\s*=\s*computeLineDrawRect\s*\(", text)) != 1:
        fail("registration", "app.js must compute lineDrawRect exactly once per page load")
    shared_draw = re.compile(
        r"drawImage\s*\(\s*lineImage\s*,\s*lineDrawRect\.x\s*,\s*"
        r"lineDrawRect\.y\s*,\s*lineDrawRect\.width\s*,\s*"
        r"lineDrawRect\.height\s*\)")
    if len(shared_draw.findall(text)) != 2:
        fail("registration", "mask and display must both draw lineImage through the stored lineDrawRect")
    if len(re.findall(r"drawImage\s*\(\s*lineImage\s*,", text)) != 2:
        fail("registration", "app.js has an extra lineImage draw path outside the shared rectangle")

    payload = []
    for name, path in sheets:
        with Image.open(path) as src:
            payload.append({"file": name, "width": src.width, "height": src.height})
    program = (function + "\n" +
               "const sheets = " + json.dumps(payload) + ";\n" +
               "console.log(JSON.stringify(sheets.map((sheet) => ({"
               "file: sheet.file, rect: computeLineDrawRect("
               "{naturalWidth: sheet.width, naturalHeight: sheet.height}, "
               "{width: %d, height: %d}, true)}))));\n" % (W, H))
    try:
        out = subprocess.run(["node", "-e", program], capture_output=True, text=True,
                             timeout=10, check=True)
        return {entry["file"]: entry["rect"] for entry in json.loads(out.stdout)}
    except (OSError, subprocess.SubprocessError, ValueError, KeyError) as exc:
        fail("registration", "could not evaluate app.js computeLineDrawRect(): %s" % exc)
        return {}


def check_registration(sheets):
    rects = app_js_draw_rects(sheets)
    for name, path in sheets:
        rect = rects.get(name)
        if rect is None:
            fail(name, "no draw rectangle returned by app.js")
            continue
        values = [rect.get(key) for key in ("x", "y", "width", "height")]
        if any(not isinstance(value, (int, float)) for value in values):
            fail(name, "app.js returned an invalid draw rectangle %r" % rect)
            continue
        if rect["width"] <= 0 or rect["height"] <= 0:
            fail(name, "app.js returned a non-positive draw rectangle %r" % rect)
            continue
        print("%-28s registration mask == display  rect=(%.2f, %.2f, %.2f, %.2f)" %
              (name, rect["x"], rect["y"], rect["width"], rect["height"]))


def git_commit():
    try:
        out = subprocess.run(["git", "rev-parse", "HEAD"], cwd=os.path.join(HERE, ".."),
                             capture_output=True, text=True, timeout=10)
        return out.stdout.strip()
    except Exception:
        return "unknown"


def raster(path):
    src = Image.open(path).convert("RGBA")
    scale = min(W / src.width, H / src.height)
    dw, dh = round(src.width * scale), round(src.height * scale)
    art = src.resize((dw, dh), Image.BILINEAR)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(art, ((W - dw) // 2, (H - dh) // 2))
    return canvas.load()


def is_line(px, x, y):
    r, g, b, a = px[x, y]
    return a > 90 and (r + g + b) < 430


def flood(px, seeds, blocked, w=W, h=H):
    """App-style traversal. blocked is an extra boundary layer (the mask)."""
    seen = set()
    stack = list(seeds)
    while stack:
        i = stack.pop()
        if i in seen:
            continue
        x, y = i % w, i // w
        if is_line(px, x, y) or (blocked is not None and i in blocked):
            continue
        seen.add(i)
        if x: stack.append(i - 1)
        if x < w - 1: stack.append(i + 1)
        if i >= w: stack.append(i - w)
        if i < w * (h - 1): stack.append(i + w)
    return seen


def inscribed_radius(region, w, h):
    """Max Chebyshev distance from a region pixel to the nearest non-region pixel
    (8-neighbour BFS seeded from just outside the region) -- mirrors app.js
    inscribedRadius(), which the fill consults for area-refused regions."""
    dist = {}
    frontier = deque()
    for i in region:
        x, y = i % w, i // w
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if not dx and not dy:
                    continue
                nx, ny = x + dx, y + dy
                if nx < 0 or nx >= w or ny < 0:
                    continue
                j = ny * w + nx
                if j not in region and j not in dist:
                    dist[j] = 0
                    frontier.append(j)
    best = 0
    while frontier:
        i = frontier.popleft()
        depth = dist[i] + 1
        x, y = i % w, i // w
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if not dx and not dy:
                    continue
                nx, ny = x + dx, y + dy
                if nx < 0 or nx >= w or ny < 0:
                    continue
                j = ny * w + nx
                if j in region and j not in dist:
                    dist[j] = depth
                    if depth > best:
                        best = depth
                    frontier.append(j)
    return best


def load_calibration():
    if not os.path.exists(CALIBRATION):
        return None
    try:
        return json.load(open(CALIBRATION, encoding="utf-8"))
    except ValueError:
        return None


def check_consistency():
    """Shared by fast and full: the constants' homes agree, and the record exists."""
    rec = load_calibration()
    if rec is None:
        fail("calibration", "mosaic-calibration.json is missing or unreadable -- run: "
             "python3 coloring-app/tools/check-mosaic-fill.py --refresh-calibration")
        return None
    if rec.get("pocket_max") != POCKET_MAX:
        fail("calibration", "record pocket_max %r != harness POCKET_MAX %d -- refresh "
             "the record after a deliberate re-measure" % (rec.get("pocket_max"), POCKET_MAX))
    appv = app_js_pocket_max()
    if appv != POCKET_MAX:
        fail("calibration", "app.js POCKET_MAX %r != harness POCKET_MAX %d -- the two "
             "must move together, with a re-measure" % (appv, POCKET_MAX))
    if rec.get("tappable_radius") != TAPPABLE_RADIUS:
        fail("calibration", "record tappable_radius %r != harness TAPPABLE_RADIUS %d -- "
             "refresh the record after a deliberate re-measure"
             % (rec.get("tappable_radius"), TAPPABLE_RADIUS))
    appr = app_js_tappable_radius()
    if appr != TAPPABLE_RADIUS:
        fail("calibration", "app.js TAPPABLE_RADIUS %r != harness TAPPABLE_RADIUS %d -- "
             "the two must move together, with a re-measure" % (appr, TAPPABLE_RADIUS))
    return rec


def check_corpus(rec, deep_geometry_for=None):
    """Every corpus entry exists and is hash-identical to what was calibrated.

    Any new or changed sheet fails CONSCIOUSLY here (fast and full alike): the
    calibration is corpus data, so the corpus changing invalidates it, and the honest
    response is a full re-measure and a refreshed record -- never a silent pass.
    Returns [(name, path)] on success.
    """
    entries = rec.get("corpus") or []
    names = [e.get("file") for e in entries]
    if len(names) != len(set(names)):
        fail("calibration", "duplicate corpus entry")
    if sorted(glob.glob(os.path.join(SHEETS_DIR, "*.png"))) != sorted(
            os.path.join(SHEETS_DIR, n) for n in names):
        fail("calibration", "assets/mosaic contents do not match the calibrated corpus "
             "(%d files on disk, %d in the record) -- new or removed art must be "
             "re-measured and the record refreshed" % (
                 len(glob.glob(os.path.join(SHEETS_DIR, "*.png"))), len(names)))
    live = []
    for e in entries:
        p = os.path.join(SHEETS_DIR, e.get("file", ""))
        if not os.path.exists(p):
            fail("calibration", "corpus sheet %s is missing" % e.get("file"))
            continue
        if sha256(p) != e.get("sha256"):
            fail("calibration", "%s changed since calibration -- run the FULL harness, "
                 "re-measure, and refresh the record: --refresh-calibration" % e.get("file"))
            continue
        live.append((e.get("file"), p))
    return live


def full_checks(name, path, census):
    """The four full-certification proofs for one sheet. Extends census."""
    px = raster(path)

    # -- label every region once (component pass over non-line pixels) ----------
    comp = {}
    margin = None
    regions = []  # (frozenset of indices, seed index)
    for sy in range(H):
        for sx in range(W):
            i = sy * W + sx
            if i in comp or is_line(px, sx, sy):
                continue
            rid = len(regions)
            bag = flood(px, [i], None)
            for j in bag:
                comp[j] = rid
            regions.append((bag, i))
    margin = comp.get(0, None)
    if margin is None:
        fail(name, "the canvas corner is not in any region (unexpected)")
        return
    inner = [(bag, seed) for r, (bag, seed) in enumerate(regions) if r != margin]
    margin_bag = regions[margin][0]

    # -- 2. the exterior mask: corner-seeded, exactly the outside component -----
    mask = flood(px, [0, W - 1, W * (H - 1), W * H - 1], None)
    if mask != margin_bag:
        fail(name, "exterior mask (%d px) != outside component (%d px) -- the mask "
                   "reaches somewhere the margin flood did not, or vice versa"
             % (len(mask), len(margin_bag)))
    for bag, _ in inner:
        swallowed = mask & bag
        if swallowed:
            fail(name, "exterior mask swallows %d px of an enclosed region -- "
                       "a legitimate cell would be un-fillable" % len(swallowed))
            break
    if not (100000 < len(mask) < 260000):
        fail(name, "exterior mask size %d px outside the sane band -- check the art"
             % len(mask))

    # -- 3. exterior taps paint nothing (app floodFill WITH the mask) -----------
    # Corners and mid edges sit in the art margin / letterbox. Two more probes sit
    # JUST OUTSIDE the card border, next to an edge cell -- the exact tap the
    # owner photographed -- derived from the mask itself: the rightmost masked
    # pixel left of centre on the middle row, and the lowest masked pixel above
    # centre on the middle column.
    left_edge = max((x for x in range(W // 2) if (H // 2) * W + x in mask), default=2)
    top_edge = max((y for y in range(H // 2) if y * W + W // 2 in mask), default=2)
    probes = [(2, 2), (W - 3, 2), (2, H - 3), (W - 3, H - 3),
              (W // 2, 2), (2, H // 2), (W - 3, H // 2), (W // 2, H - 3),
              (left_edge, H // 2), (W // 2, top_edge)]
    for x, y in probes:
        painted = flood(px, [y * W + x], mask)
        if painted:
            fail(name, "exterior tap at (%d,%d) painted %d px -- the mask failed"
                 % (x, y, len(painted)))

    # -- 1 + 4. every region fills exactly itself; pockets split by shape ---------
    # A region paints iff area > POCKET_MAX OR inscribed radius >= TAPPABLE_RADIUS.
    # Big cells and compact pockets must both flood to exactly themselves; thin
    # pockets are the app's no-ops, and their measured radii feed the calibration.
    pockets = cells = compact_fills = 0
    sizes = []
    refused_radii = []
    compact_radii = []
    for bag, seed in inner:
        size = len(bag)
        sizes.append(size)
        distance = abs(size - POCKET_MAX) / POCKET_MAX
        if distance < CLEAR:
            fail(name, "region of %d px sits within %.0f%% of POCKET_MAX (%d) -- "
                       "pocket/cell classification is ambiguous; re-measure before "
                       "the constant moves" % (size, CLEAR * 100, POCKET_MAX))
        radius = inscribed_radius(bag, W, H)
        if size > POCKET_MAX:
            cells += 1
        elif radius >= TAPPABLE_RADIUS:
            compact_fills += 1
            compact_radii.append(radius)
        else:
            pockets += 1
            refused_radii.append(radius)
            continue
        painted = flood(px, [seed], mask)
        if painted != bag:
            fail(name, "cell of %d px painted %d px -- the fill escaped or was "
                       "clipped" % (size, len(painted)))
    above = [s for s in sizes if s > POCKET_MAX]
    below = [s for s in sizes if s <= POCKET_MAX]
    census.append({
        "file": name, "sha256": sha256(path), "mask_px": len(mask),
        "cells": cells, "pockets": pockets,
        "compact_fills": compact_fills,
        "largest_refused_radius": max(refused_radii) if refused_radii else 0,
        "smallest_compact_radius": min(compact_radii) if compact_radii else None,
        "largest_pocket_px": max(below) if below else 0,
        "smallest_cell_px": min(above) if above else 0,
    })
    print("%-28s mask=%6d  cells=%2d  compact=%2d  thin-pockets=%2d  smallest cell=%5d"
          % (name, len(mask), cells, compact_fills, pockets, min(above) if above else 0))


def page_checks(name, path, census):
    """Rule-4 classification + fill exactness for one Coloring Page.

    Pages draw at their natural size with NO exterior mask (app.js line ~595:
    `exteriorMask = mosaic ? buildExteriorMask() : null`), and the background
    region that touches the canvas corner is fillable by design -- it is the
    page's paper, not a margin. The same POCKET_MAX/TAPPABLE_RADIUS rule governs
    them; before 2026-09-22 that meant detailed pages had no fillable enclosed
    region at all, because their cells sit under a constant calibrated for the
    mosaic canvas."""
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()
    comp = {}
    regions = []
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if i in comp or is_line(px, sx, sy):
                continue
            bag = flood(px, [i], None, w, h)
            for j in bag:
                comp[j] = len(regions)
            regions.append((bag, i))
    margin = comp.get(0)
    if margin is None:
        fail(name, "page corner is not in any region (unexpected)")
        return
    fills = compact_fills = refused = 0
    refused_radii = []
    compact_radii = []
    for rid, (bag, seed) in enumerate(regions):
        if rid == margin:
            continue
        size = len(bag)
        # No 5% clearance band here, deliberately: that band guards POCKET_MAX as a
        # MOSAIC-corpus classification boundary (where it was measured); on pages the
        # constant is an imported size heuristic, and the pages' own classification
        # boundary is the radius rule below. Failing a page because a region happens
        # to sit near 1815 px would demand "re-measuring" a constant the mosaic
        # corpus owns -- noise, not safety.
        radius = inscribed_radius(bag, w, h)
        if size > POCKET_MAX or radius >= TAPPABLE_RADIUS:
            if size <= POCKET_MAX:
                compact_fills += 1
                compact_radii.append(radius)
            else:
                fills += 1
            painted = flood(px, [seed], None, w, h)
            if painted != bag:
                fail(name, "page region of %d px painted %d px -- the fill escaped "
                           "or was clipped" % (size, len(painted)))
        else:
            refused += 1
            refused_radii.append(radius)
    census.append({
        "file": name, "sha256": sha256(path), "width": w, "height": h,
        "regions": len(regions) - 1, "fills": fills, "compact_fills": compact_fills,
        "refused": refused,
        "largest_refused_radius": max(refused_radii) if refused_radii else 0,
        "smallest_compact_radius": min(compact_radii) if compact_radii else None,
    })
    print("%-28s %dx%d  fills=%3d  compact=%3d  thin-pockets=%3d"
          % (name, w, h, fills, compact_fills, refused))


def check_pages_corpus(rec):
    """The pages corpus is calibration data exactly like the mosaic corpus."""
    entries = rec.get("pages_corpus") or []
    names = [e.get("file") for e in entries]
    if len(names) != len(set(names)):
        fail("calibration", "duplicate pages_corpus entry")
    if sorted(glob.glob(os.path.join(PAGES_DIR, "*.png"))) != sorted(
            os.path.join(PAGES_DIR, n) for n in names):
        fail("calibration", "assets/pages contents do not match the calibrated corpus "
             "(%d files on disk, %d in the record) -- new or removed art must be "
             "re-measured and the record refreshed" % (
                 len(glob.glob(os.path.join(PAGES_DIR, "*.png"))), len(names)))
        return []
    live = []
    for e in entries:
        p = os.path.join(PAGES_DIR, e.get("file", ""))
        if not os.path.exists(p):
            fail("calibration", "corpus page %s is missing" % e.get("file"))
            continue
        if sha256(p) != e.get("sha256"):
            fail("calibration", "%s changed since calibration -- run the FULL harness, "
                 "re-measure, and refresh the record: --refresh-calibration" % e.get("file"))
            continue
        live.append((e.get("file"), p))
    return live


def write_calibration(census, pages_census=None):
    corpus = []
    for c in census:
        corpus.append({"file": c["file"], "sha256": c["sha256"], "mask_px": c["mask_px"],
                       "cells": c["cells"], "pockets": c["pockets"],
                       "compact_fills": c["compact_fills"],
                       "largest_refused_radius": c["largest_refused_radius"],
                       "smallest_compact_radius": c["smallest_compact_radius"],
                       "largest_pocket_px": c["largest_pocket_px"],
                       "smallest_cell_px": c["smallest_cell_px"]})
    pages_corpus = []
    for c in pages_census:
        pages_corpus.append({"file": c["file"], "sha256": c["sha256"],
                             "width": c["width"], "height": c["height"],
                             "regions": c["regions"], "fills": c["fills"],
                             "compact_fills": c["compact_fills"], "refused": c["refused"],
                             "largest_refused_radius": c["largest_refused_radius"],
                             "smallest_compact_radius": c["smallest_compact_radius"]})
    largest_pocket = max(census, key=lambda c: c["largest_pocket_px"])
    smallest_cell = min(census, key=lambda c: c["smallest_cell_px"] or 10 ** 9)
    pages_census = pages_census or []
    thin_radii = ([c["largest_refused_radius"] for c in census if c["largest_refused_radius"]] +
                  [c["largest_refused_radius"] for c in pages_census if c["largest_refused_radius"]])
    compact_radii = ([c["smallest_compact_radius"] for c in census if c["smallest_compact_radius"] is not None] +
                     [c["smallest_compact_radius"] for c in pages_census if c["smallest_compact_radius"] is not None])
    record = {
        "$purpose": ("Corpus/raster CALIBRATION for the coloring fill's POCKET_MAX and "
                     "TAPPABLE_RADIUS. Not UX constants and not timeless: valid for "
                     "exactly these corpora (sha256 below), the 724x1086 mosaic canvas "
                     "with the min-scale centered bilinear pipeline, the pages' natural "
                     "sizes, and the alpha>90 / R+G+B<430 boundary predicate. Refresh "
                     "ONLY via: python3 coloring-app/tools/check-mosaic-fill.py "
                     "--refresh-calibration, after the full harness passes on new art."),
        "canvas": {"width": W, "height": H},
        "pipeline": "art scaled by min(724/w, 1086/h), centered, bilinear (mirrors app.js loadPage)",
        "boundary_predicate": {"min_alpha": 90, "max_channel_sum": 430},
        "pocket_max": POCKET_MAX,
        "pocket_max_provenance": {
            "measured_basis": {
                "largest_pocket_px": largest_pocket["largest_pocket_px"],
                "largest_pocket_sheet": largest_pocket["file"],
                "smallest_region_above_px": smallest_cell["smallest_cell_px"],
                "smallest_region_above_sheet": smallest_cell["file"],
            },
            "clearance_band": {"min_ratio": CLEAR,
                               "meaning": "no region may sit within this ratio of pocket_max"},
        },
        "tappable_radius": TAPPABLE_RADIUS,
        "tappable_radius_provenance": {
            "measured_basis": {
                "largest_thin_refused_radius": max(thin_radii) if thin_radii else 0,
                "smallest_compact_fill_radius": min(compact_radii) if compact_radii else None,
                "owner_named_cells_2026_09_21": {
                    "smiling-sunflower-tongue": {"px": 1293, "radius": 13},
                    "happy-rocket-segments": {"px": 1304, "radius": 13},
                    "space-planet-details": {"px": 1165, "radius": 14},
                    "sea-turtle-shell-scales": {"px": 229, "radius": 4},
                },
            },
            "meaning": ("a region at or under pocket_max still fills when its inscribed "
                        "radius reaches this value; every measured thin sliver is below it"),
        },
        "corpus": sorted(corpus, key=lambda e: e["file"]),
        "pages_corpus": sorted(pages_corpus, key=lambda e: e["file"]),
        "generated": {"date": time.strftime("%Y-%m-%d"),
                      "by": "tools/check-mosaic-fill.py --refresh-calibration",
                      "commit": git_commit()},
    }
    with open(CALIBRATION, "w", encoding="utf-8") as fh:
        json.dump(record, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print("\ncalibration record refreshed: %s" % os.path.relpath(CALIBRATION, HERE + "/.."))


def main():
    args = set(sys.argv[1:])
    fast = "--fast" in args
    refresh = "--refresh-calibration" in args
    started = time.time()

    if refresh:
        # Bootstrap-safe: refresh WRITES the record, so a missing or stale record is
        # the reason we are here, not a failure. The harness's own constants and the
        # app.js constant must still agree -- those are the two homes the record is
        # generated FROM.
        for cname, cval in (("POCKET_MAX", app_js_pocket_max()),
                            ("TAPPABLE_RADIUS", app_js_tappable_radius())):
            if cval != globals()[cname]:
                fail("calibration", "app.js %s %r != harness %s %d -- the two must "
                     "move together, with a re-measure" % (cname, cval, cname, globals()[cname]))
        sheets = sorted(glob.glob(os.path.join(SHEETS_DIR, "*.png")))
        pages = sorted(glob.glob(os.path.join(PAGES_DIR, "*.png")))
        if not sheets:
            fail("calibration", "no sheets under assets/mosaic/")
        if not pages:
            fail("calibration", "no pages under assets/pages/")
        check_registration([(os.path.basename(path), path) for path in sheets])
        if failures:
            sys.stderr.write("\nFAIL (%d):\n  " % len(failures) + "\n  ".join(failures) + "\n")
            return 1
        census = []
        for p in sheets:
            full_checks(os.path.basename(p), p, census)
        pages_census = []
        for p in pages:
            page_checks(os.path.basename(p), p, pages_census)
        if failures:
            sys.stderr.write("\nFAIL (%d):\n  " % len(failures) + "\n  ".join(failures) + "\n")
            return 1
        write_calibration(census, pages_census)
        print("\nPASS  every sheet and page (full certification for refresh): no leak, no "
              "swallow, exterior taps paint nothing, thin pockets are no-ops while "
              "compact cells fill, threshold clear by %.0f%% (%.1fs)"
              % (CLEAR * 100, time.time() - started))
        return 0

    rec = check_consistency()
    if rec is None:
        sys.stderr.write("\nFAIL (%d):\n  " % len(failures) + "\n  ".join(failures) + "\n")
        return 1
    live = check_corpus(rec)
    pages_live = check_pages_corpus(rec)
    check_registration(live)

    if fast:
        # -- the representative sheet and page only --------------------------------
        target = [(n, p) for n, p in live if n == FAST_SHEET]
        if not target:
            fail(FAST_SHEET, "representative sheet absent from the calibrated corpus")
        else:
            full_checks(FAST_SHEET, target[0][1], census := [])
        ptarget = [(n, p) for n, p in pages_live if n == FAST_PAGE]
        if not ptarget:
            fail(FAST_PAGE, "representative page absent from the calibrated corpus")
        else:
            page_checks(FAST_PAGE, ptarget[0][1], pcensus := [])
        if failures:
            sys.stderr.write("\nFAIL (%d):\n  " % len(failures) + "\n  ".join(failures) + "\n")
            return 1
        print("PASS fast gate (%.1fs): calibration consistent, corpora hash-identical, "
              "%s mask/exterior/cell and %s classification proven"
              % (time.time() - started, FAST_SHEET, FAST_PAGE))
        return 0

    # -- FULL certification: every calibrated sheet and page, unchanged strength --
    census = []
    for name, path in live:
        full_checks(name, path, census)
    pages_census = []
    for name, path in pages_live:
        page_checks(name, path, pages_census)
    if failures:
        sys.stderr.write("\nFAIL (%d):\n  " % len(failures) + "\n  ".join(failures) + "\n")
        return 1
    if refresh:
        write_calibration(census, pages_census)
    print("\nPASS  every sheet and page: no leak, no swallow, exterior taps (incl. just "
          "outside the border) paint nothing, thin pockets are no-ops while compact "
          "cells fill, threshold clear by %.0f%% (%.1fs)"
          % (CLEAR * 100, time.time() - started))
    return 0


if __name__ == "__main__":
    sys.exit(main())

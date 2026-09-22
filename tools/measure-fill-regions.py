#!/usr/bin/env python3
"""Region census for BOTH coloring surfaces, through each mode's real pipeline.

Mosaic sheets: 724x1086 canvas, min-scale centered bilinear letterbox, corner-seeded
exterior mask -- the same pipeline tools/check-mosaic-fill.py certifies.

Coloring pages: identity transform at the art's natural size, NO exterior mask
(app.js line 595: mosaic ? buildExteriorMask() : null) -- the same floodFill code,
so the same POCKET_MAX applies at a resolution it was never calibrated for.

For every region (connected non-line component that is not the exterior): area,
max inscribed Chebyshev radius (the largest finger-sized square that fits inside),
and the bounding box. The radius discriminates "compact region a child aims at"
(tongue, dot, hole) from "thin interstitial sliver between strokes" at ANY canvas
resolution, which area alone cannot.

Run:  python3 coloring-app/tools/measure-fill-regions.py [--sheet NAME]
"""
import os
import sys
from collections import deque

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MOSAIC_DIR = os.path.join(HERE, "..", "assets", "mosaic")
PAGES_DIR = os.path.join(HERE, "..", "assets", "pages")
POCKET_MAX = 1815
MOSAIC_W, MOSAIC_H = 724, 1086


def is_line_rgba(r, g, b, a):
    return a > 90 and (r + g + b) < 430


class Raster:
    def __init__(self, path, letterbox):
        src = Image.open(path).convert("RGBA")
        if letterbox:
            scale = min(MOSAIC_W / src.width, MOSAIC_H / src.height)
            dw, dh = round(src.width * scale), round(src.height * scale)
            art = src.resize((dw, dh), Image.BILINEAR)
            self.w, self.h = MOSAIC_W, MOSAIC_H
            canvas = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
            canvas.paste(art, ((self.w - dw) // 2, (self.h - dh) // 2))
        else:
            self.w, self.h = src.width, src.height
            canvas = src
        self.px = canvas.load()

    def line(self, x, y):
        r, g, b, a = self.px[x, y]
        return is_line_rgba(r, g, b, a)


def neighbours(i, w, h):
    x, y = i % w, i // w
    if x:
        yield i - 1
    if x < w - 1:
        yield i + 1
    if y:
        yield i - w
    if y < h - 1:
        yield i + w


def flood(ras, seeds, blocked):
    seen = set()
    stack = list(seeds)
    while stack:
        i = stack.pop()
        if i in seen:
            continue
        x, y = i % ras.w, i // ras.w
        if ras.line(x, y) or (blocked is not None and i in blocked):
            continue
        seen.add(i)
        stack.extend(neighbours(i, ras.w, ras.h))
    return seen


def inscribed_radius(region, w, h):
    """Max Chebyshev distance from a region pixel to the nearest non-region pixel,
    via 8-neighbour BFS seeded from everything outside the region that borders it."""
    INF = 1 << 30
    dist = {}
    frontier = deque()
    region_set = region
    for i in region_set:
        for j in neighbours(i, w, h):
            if j not in region_set and j not in dist:
                dist[j] = 0
                frontier.append(j)
    best = 0
    while frontier:
        i = frontier.popleft()
        d = dist[i]
        x, y = i % w, i // w
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if not dx and not dy:
                    continue
                nx, ny = x + dx, y + dy
                if not (0 <= nx < w and 0 <= ny < h):
                    continue
                j = ny * w + nx
                if j in region_set and j not in dist:
                    dist[j] = d + 1
                    if dist[j] > best:
                        best = dist[j]
                    frontier.append(j)
    return best


def census(path, letterbox):
    ras = Raster(path, letterbox)
    w, h = ras.w, ras.h
    mask = None
    if letterbox:
        mask = flood(ras, [0, w - 1, w * (h - 1), w * h - 1], None)
    comp = {}
    regions = []
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if i in comp or ras.line(sx, sy):
                continue
            bag = flood(ras, [i], None)
            for j in bag:
                comp[j] = len(regions)
            regions.append(bag)
    margin_id = comp.get(0)
    rows = []
    for rid, bag in enumerate(regions):
        if rid == margin_id:
            continue
        # Radius matters only where the area rule might refuse the region; huge
        # regions fill regardless, and their BFS is the expensive one.
        r = inscribed_radius(bag, w, h) if len(bag) <= 25000 else 99
        xs = [i % w for i in bag]
        ys = [i // w for i in bag]
        rows.append({
            "px": len(bag), "radius": r,
            "bbox": (min(xs), min(ys), max(xs), max(ys)),
            "seed": sorted(bag)[len(bag) // 2],
            "w": w, "h": h,
        })
    return rows


def report(name, rows):
    fillable = [r for r in rows if r["px"] > POCKET_MAX]
    refused = [r for r in rows if r["px"] <= POCKET_MAX]
    print("%s  (%d regions: %d fill, %d refused-by-area)" % (name, len(rows), len(fillable), len(refused)))
    for r in sorted(rows, key=lambda r: r["px"])[:12]:
        state = "FILL" if r["px"] > POCKET_MAX else "refuse"
        print("   %6d px  r=%2d  %-6s bbox=%s  seed=(%d,%d)"
              % (r["px"], r["radius"], state, r["bbox"], r["seed"] % r["w"], r["seed"] // r["w"]))
    compact_refused = [r for r in refused if r["radius"] >= 3]
    thin_refused = [r for r in refused if r["radius"] < 3]
    print("   refused with radius>=3 (compact, looks intended): %d; radius<3 (thin sliver): %d"
          % (len(compact_refused), len(thin_refused)))
    print()


def main():
    only = None
    if "--sheet" in sys.argv:
        only = sys.argv[sys.argv.index("--sheet") + 1]
    for label, folder, letterbox in (("MOSAIC", MOSAIC_DIR, True), ("PAGE", PAGES_DIR, False)):
        for fn in sorted(os.listdir(folder)):
            if not fn.endswith(".png"):
                continue
            if only and only not in fn:
                continue
            report("[%s] %s" % (label, fn), census(os.path.join(folder, fn), letterbox))


if __name__ == "__main__":
    main()

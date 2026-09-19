#!/usr/bin/env python3
"""Generate an abstract mosaic sheet: black lines on white, exactly two colours.

    python3 coloring-app/tools/make-mosaic-sheet.py <cells> <seed> <relax> <out.png> [floor]

This produced the five shipped abstract-fine-*.png sheets (2026-09-19). It is kept
because those sheets cannot otherwise be reproduced or extended, and because the
reason it exists is not aesthetic.

WHY GENERATED RATHER THAN DRAWN. app.js's POCKET_MAX makes any region at or under
1815 canvas px deliberately unfillable, and tools/check-mosaic-fill.py refuses a
region within 5% of that constant. So the number that decides whether a sheet ships
is the SMALLEST cell, not the average, and an image model cannot promise a floor --
three attempts failed here at 1900, 1881 and 1829 px. A centroidal Voronoi
tessellation can: Lloyd relaxation drives the minimum up towards the mean, and the
rebalance pass below moves a seed out of the largest cell into the smallest until
every cell clears, so the cell count stays exactly what was asked for.

`floor` is in FILE pixels (745x964). The harness measures in CANVAS pixels after the
letterbox, which is smaller -- see MOSAIC-ART-SPEC.md section 4 for the conversion.
The shipped sheets used floors of 3000 (180 cells) and 3800 (200 cells) to land at
2450 and 2026 canvas px.

LINE is 2px, not 3: at 200 cells a 3px line ate enough area to push cells under the
floor. Raising it again will cost cells.
"""
import numpy as np
from PIL import Image

W, H = 745, 964
MARGIN, RADIUS, FRAME, LINE = 22, 30, 4, 2


def rounded_mask(w, h, m, r):
    yy, xx = np.mgrid[0:h, 0:w]
    inside = (xx >= m) & (xx < w - m) & (yy >= m) & (yy < h - m)
    for cx, cy, sx, sy in ((m + r, m + r, -1, -1), (w - 1 - m - r, m + r, 1, -1),
                           (m + r, h - 1 - m - r, -1, 1), (w - 1 - m - r, h - 1 - m - r, 1, 1)):
        corner = ((xx - cx) * sx > 0) & ((yy - cy) * sy > 0)
        inside &= ~(corner & ((xx - cx) ** 2 + (yy - cy) ** 2 > r * r))
    return inside


def tessellate(n, seed, relax, floor=0):
    rng = np.random.default_rng(seed)
    inside = rounded_mask(W, H, MARGIN, RADIUS)
    ys, xs = np.nonzero(inside)
    pick = rng.choice(len(xs), n, replace=False)
    pts = np.stack([xs[pick], ys[pick]], 1).astype(float)
    # Lloyd relaxation on a subsampled grid: cheap and converges fast.
    step = 3
    gy, gx = np.nonzero(inside[::step, ::step])
    grid = np.stack([gx * step, gy * step], 1).astype(float)
    for _ in range(relax):
        d = ((grid[:, None, :] - pts[None, :, :]) ** 2).sum(2)
        lab = d.argmin(1)
        for i in range(n):
            owned = grid[lab == i]
            if len(owned):
                pts[i] = owned.mean(0)
    # Rebalance: a cell clipped by the rounded corners can end up far under the
    # mean, and the app's POCKET_MAX floor makes such a cell untappable. Move the
    # smallest cell's seed into the largest cell and re-relax. The count never
    # changes, so the sheet still has exactly the cells asked for.
    for _ in range(120):
        d = ((grid[:, None, :] - pts[None, :, :]) ** 2).sum(2)
        lab = d.argmin(1)
        counts = np.bincount(lab, minlength=n)
        if counts.min() * step * step >= floor:
            break
        small, big = counts.argmin(), counts.argmax()
        owned = grid[lab == big]
        pts[small] = owned[rng.integers(len(owned))] if len(owned) else pts[small]
        for _ in range(6):
            d = ((grid[:, None, :] - pts[None, :, :]) ** 2).sum(2)
            lab = d.argmin(1)
            for i in range(n):
                o = grid[lab == i]
                if len(o):
                    pts[i] = o.mean(0)
    # Final full-resolution labelling.
    yy, xx = np.mgrid[0:H, 0:W]
    flat = np.stack([xx.ravel(), yy.ravel()], 1).astype(np.float32)
    lab = np.empty(len(flat), dtype=np.int32)
    chunk = 200000
    for s in range(0, len(flat), chunk):
        part = flat[s:s + chunk]
        d = ((part[:, None, :] - pts[None, :, :].astype(np.float32)) ** 2).sum(2)
        lab[s:s + chunk] = d.argmin(1)
    return lab.reshape(H, W), inside


def render(n, seed, relax, path, floor=0):
    lab, inside = tessellate(n, seed, relax, floor)
    edge = np.zeros((H, W), bool)
    edge[:, :-1] |= lab[:, :-1] != lab[:, 1:]
    edge[:-1, :] |= lab[:-1, :] != lab[1:, :]
    # Thicken to LINE px by dilation.
    thick = edge.copy()
    k = LINE // 2
    for dy in range(-k, k + 1):
        for dx in range(-k, k + 1):
            thick |= np.roll(np.roll(edge, dy, 0), dx, 1)
    img = np.ones((H, W), np.uint8) * 255
    img[thick & inside] = 0
    # The frame: a black band just inside the rounded mask edge.
    shrunk = rounded_mask(W, H, MARGIN + FRAME, RADIUS - FRAME)
    img[inside & ~shrunk] = 0
    img[~inside] = 255
    Image.fromarray(img).convert("RGB").save(path)
    return img


if __name__ == "__main__":
    import sys
    n, seed, relax, path = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    floor = int(sys.argv[5]) if len(sys.argv) > 5 else 0
    render(n, seed, relax, path, floor)
    print("wrote", path)

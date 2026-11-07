"""Clean the outlines of cut-out product photos without a model.

A segmentation model nibbles the corners of a box, and the outline then looks torn. Most packs are boxes, cards or flat pouches, so this
script fits the smallest four-sided shape around the cut. If the shape fills that quadrilateral, the pack is treated as flat and the photo
is warped to a straight-on rectangle, which also removes the camera angle. Anything else, such as a bottle or a can, keeps its outline with
the stair-steps smoothed away. A person reviews every result before it reaches the site.

Usage: <venv>/bin/python -I squareup.py <list.json> <out-dir> [--flat names.txt]
<list.json> is {"<file>": "<path of the accepted cut png>"}. Writes <out-dir>/<file>.png and <out-dir>/kinds.json.
A first run squares up everything that passes the shape tests, for review. Warping boxes in a bottle or a can with its background, so the
second run takes --flat, the names a person accepted, and only smooths the rest.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.spatial import ConvexHull

MIN_FILL = 0.84  # hull area / quadrilateral area: below this the pack isn't flat and four-sided
MAX_CORNER_OFF = 28  # degrees a corner may differ from square
SMOOTH_SHARE = 0.006


def area(poly):
    x, y = np.asarray(poly, dtype="float64").T
    return 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))


def intersect(a1, a2, b1, b2):
    d1, d2 = a2 - a1, b2 - b1
    cross = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(cross) < 1e-6:
        return None
    t = ((b1[0] - a1[0]) * d2[1] - (b1[1] - a1[1]) * d2[0]) / cross
    return a1 + t * d1


def enclosing_quad(hull):
    """Shrink a convex polygon to four sides, each time replacing the edge whose removal adds the least area."""
    poly = [np.asarray(p, dtype="float64") for p in hull]
    while len(poly) > 4:
        best = None
        n = len(poly)
        for i in range(n):
            # Drop the edge from i to i+1 by extending its two neighbouring edges until they meet.
            a, b, c, d = poly[i - 1], poly[i], poly[(i + 1) % n], poly[(i + 2) % n]
            meet = intersect(a, b, d, c)
            if meet is None:
                continue
            # The two edges must meet beyond the dropped edge, or the shape would turn inside out.
            if np.dot(meet - b, b - a) < 0 or np.dot(meet - c, c - d) < 0:
                continue
            added = area([b, meet, c])
            if best is None or added < best[0]:
                best = (added, i, meet)
        if best is None:
            return None
        _, i, meet = best
        poly[i] = meet
        del poly[(i + 1) % n]
    return np.array(poly) if len(poly) == 4 else None


def order(quad):
    """Top-left, top-right, bottom-right, bottom-left."""
    centre = quad.mean(axis=0)
    ring = quad[np.argsort(np.arctan2(quad[:, 1] - centre[1], quad[:, 0] - centre[0]))]
    return np.roll(ring, -int(np.argmin(ring.sum(axis=1))), axis=0)


def corner_angles(q):
    out = []
    for i in range(4):
        u, v = q[i - 1] - q[i], q[(i + 1) % 4] - q[i]
        cos = float(np.dot(u, v) / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-9))
        out.append(np.degrees(np.arccos(np.clip(cos, -1, 1))))
    return out


def perspective_coeffs(target, source):
    """PIL wants the mapping from output to input as eight numbers."""
    rows, values = [], []
    for (x, y), (u, v) in zip(target, source):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        values += [u, v]
    return np.linalg.solve(np.array(rows, dtype="float64"), np.array(values, dtype="float64")).tolist()


def main_shape(alpha):
    labels, count = ndimage.label(alpha)
    if not count:
        return None
    sizes = ndimage.sum(alpha, labels, range(1, count + 1))
    return labels == int(np.argmax(sizes)) + 1


def square_up(im):
    rgba = np.asarray(im)
    alpha = rgba[:, :, 3] > 128
    h, w = alpha.shape
    shape = main_shape(alpha)
    if shape is None:
        return None
    edge = shape & ~ndimage.binary_erosion(shape)
    ys, xs = np.nonzero(edge)
    if len(xs) < 8:
        return None
    points = np.column_stack([xs, ys]).astype("float64")
    hull = points[ConvexHull(points).vertices]
    quad = enclosing_quad(hull)
    if quad is None:
        return None
    quad = order(quad)
    if area(hull) / max(1.0, area(quad)) < MIN_FILL:
        return None
    if any(abs(a - 90) > MAX_CORNER_OFF for a in corner_angles(quad)):
        return None
    # A corner far outside the picture means the photographer cropped the pack, and warping would only stretch the edge pixels.
    margin = 0.02 * max(h, w)
    if quad[:, 0].min() < -margin or quad[:, 1].min() < -margin or quad[:, 0].max() > w + margin or quad[:, 1].max() > h + margin:
        return None
    top, bottom = np.linalg.norm(quad[1] - quad[0]), np.linalg.norm(quad[2] - quad[3])
    left, right = np.linalg.norm(quad[3] - quad[0]), np.linalg.norm(quad[2] - quad[1])
    out_w, out_h = int(round((top + bottom) / 2)), int(round((left + right) / 2))
    if min(out_w, out_h) < 80:
        return None
    target = [(0, 0), (out_w - 1, 0), (out_w - 1, out_h - 1), (0, out_h - 1)]
    flat = im.convert("RGB").transform((out_w, out_h), Image.PERSPECTIVE, perspective_coeffs(target, quad.tolist()), Image.BICUBIC)
    return flat.convert("RGBA")


def smooth(im):
    rgba = np.asarray(im)
    alpha = rgba[:, :, 3] > 128
    sigma = max(1.5, min(alpha.shape) * SMOOTH_SHARE)
    final = ndimage.gaussian_filter(alpha.astype("float32"), sigma) > 0.5
    soft = np.clip(ndimage.gaussian_filter(final.astype("float32"), 1.0) * 255, 0, 255).astype("uint8")
    return Image.fromarray(np.dstack([rgba[:, :, :3], soft]), "RGBA")


def main():
    listing, out = sys.argv[1:3]
    os.makedirs(out, exist_ok=True)
    reviewed = None
    if "--flat" in sys.argv:
        reviewed = {line.strip() for line in open(sys.argv[sys.argv.index("--flat") + 1]) if line.strip()}
    kinds = {}
    for name, path in json.load(open(listing)).items():
        try:
            with Image.open(path) as source:
                im = source.convert("RGBA")
                flat = square_up(im) if reviewed is None or name in reviewed else None
                kinds[name] = "flat" if flat is not None else "smooth"
                (flat if flat is not None else smooth(im)).save(os.path.join(out, f"{name}.png"))
        except Exception as e:  # noqa: BLE001
            print("failed", name, str(e)[:120], flush=True)
    with open(os.path.join(out, "kinds.json"), "w") as fh:
        json.dump(kinds, fh, indent=0)
    print("flat", sum(k == "flat" for k in kinds.values()), "smooth", sum(k == "smooth" for k in kinds.values()), flush=True)


if __name__ == "__main__":
    main()

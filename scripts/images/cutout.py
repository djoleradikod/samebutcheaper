"""Cut product photos out of their backgrounds, so a kitchen-table snapshot reads as a clean pack on white.

Uses rembg (MIT, github.com/danielgatis/rembg) with BiRefNet lite (MIT), run locally. A separate venv holds it; nothing in the site
imports it. Open Facts photos are CC BY-SA, which allows this adaptation under the same licence, so the credit says the background
was removed.

A model reads printed white and pale areas as background and eats holes in a pack. Only the outline is taken from the model: holes
are filled, and when the shape is still eaten away the convex hull is used, because a pack's outline is nearly convex.

Usage: <venv>/bin/python -I cutout.py <data/images.json> <downloads-dir> <out-dir> [--limit N] [--union] [--only names.txt]
Writes <out-dir>/<file>.png with transparency, and skips any already done. Downloads are untrusted: only Pillow reads them.
--union is for photos a single model got wrong: it takes the union of three models' masks and always uses the hull.
--only limits the run to the record file names listed in a text file, one per line.
"""
import json
import os
import sys

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageChops, ImageFilter, ImageOps
from rembg import new_session, remove
from scipy import ndimage
from skimage.morphology import convex_hull_image

MAX_SIDE = 1400
MODEL = "birefnet-general-lite"
UNION_MODELS = ["birefnet-general-lite", "isnet-general-use", "u2net"]
SOLID_ENOUGH = 0.86  # area of the filled mask / area of its convex hull
SMOOTH_SHARE = 0.006  # blur of the outline, as a share of the picture's short side


def outline(mask, always_hull=False):
    """The pack's outline from a mask: the main shape and whatever touches it, solid inside."""
    on = np.asarray(mask) > 128
    labels, count = ndimage.label(on)
    if not count:
        return mask
    sizes = ndimage.sum(on, labels, range(1, count + 1))
    main = int(np.argmax(sizes)) + 1
    ys, xs = np.where(labels == main)
    h, w = on.shape
    pad_y, pad_x = int(h * 0.04), int(w * 0.04)
    top, bottom, left, right = ys.min() - pad_y, ys.max() + pad_y, xs.min() - pad_x, xs.max() + pad_x
    keep = np.zeros_like(on)
    for i in range(1, count + 1):
        part = labels == i
        py, px = np.where(part)
        # Parts of the label left stranded by the model sit inside or against the main shape. Stray bits elsewhere go.
        if py.min() >= top and py.max() <= bottom and px.min() >= left and px.max() <= right:
            keep |= part
    filled = ndimage.binary_fill_holes(keep)
    hull = convex_hull_image(filled)
    solid = filled.sum() / max(1, hull.sum())
    final = hull if always_hull or solid < SOLID_ENOUGH else filled
    # A pack's edge is smooth, so blur the outline and cut it again: stair-steps and small bites go, and real corners stay close.
    sigma = max(1.5, min(h, w) * SMOOTH_SHARE)
    final = ndimage.gaussian_filter(final.astype("float32"), sigma) > 0.5
    return Image.fromarray((final * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.2))


def session_for(model):
    # The memory cage is shared, so keep onnxruntime from holding a big arena.
    opts = ort.SessionOptions()
    opts.enable_cpu_mem_arena = False
    opts.enable_mem_pattern = False
    opts.intra_op_num_threads = 4
    return new_session(model, sess_opts=opts)


def main():
    records_path, downloads, out = sys.argv[1:4]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    union = "--union" in sys.argv
    only = None
    if "--only" in sys.argv:
        only = {line.strip() for line in open(sys.argv[sys.argv.index("--only") + 1]) if line.strip()}
    os.makedirs(out, exist_ok=True)
    model = sys.argv[sys.argv.index("--model") + 1] if "--model" in sys.argv else MODEL
    sessions = [session_for(m) for m in (UNION_MODELS if union else [model])]
    records = json.load(open(records_path))
    done = failed = 0
    for key, rec in records.items():
        if not rec.get("reviewed") or rec.get("source") == "dailymed":
            continue
        name = rec["file"]
        if only is not None and name not in only:
            continue
        target = os.path.join(out, f"{name}.png")
        if os.path.exists(target):
            continue
        orig = os.path.join(downloads, name.rsplit("-", 1)[-1], "orig")
        if not os.path.exists(orig):
            print("no original", key, flush=True)
            failed += 1
            continue
        try:
            with Image.open(orig) as im:
                im = ImageOps.exif_transpose(im).convert("RGB")
                im.thumbnail((MAX_SIDE, MAX_SIDE))
                mask = None
                for session in sessions:
                    m = remove(im, session=session, only_mask=True, post_process_mask=True).convert("L")
                    mask = m if mask is None else ImageChops.lighter(mask, m)
                im.putalpha(outline(mask, always_hull=union))
                im.save(target)
            done += 1
            if done % 25 == 0:
                print("cut", done, flush=True)
        except Exception as e:  # noqa: BLE001
            print("failed", key, str(e)[:100], flush=True)
            failed += 1
        if limit and done >= limit:
            break
    print("done", done, "failed", failed, flush=True)


if __name__ == "__main__":
    main()

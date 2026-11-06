"""Cut product photos out of their backgrounds, so a kitchen-table snapshot reads as a clean pack on white.

Uses rembg (MIT, github.com/danielgatis/rembg) with BiRefNet lite (MIT), run locally. A separate venv holds it; nothing in the site
imports it. Open Facts photos are CC BY-SA, which allows this adaptation under the same licence, so the credit says the background
was removed.

A model reads printed white and pale areas as background and eats holes in a pack. Only the outline is taken from the model: holes
are filled, and when the shape is still eaten away the convex hull is used, because a pack's outline is nearly convex.

Usage: <venv>/bin/python -I cutout.py <data/images.json> <downloads-dir> <out-dir> [--limit N] [--model NAME]
Writes <out-dir>/<file>.png with transparency, and skips any already done. Downloads are untrusted: only Pillow reads them.
"""
import json
import os
import sys

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter, ImageOps
from rembg import new_session, remove
from scipy import ndimage
from skimage.morphology import convex_hull_image

MAX_SIDE = 1400
MODEL = "birefnet-general-lite"
SOLID_ENOUGH = 0.86  # area of the filled mask / area of its convex hull


def outline(mask):
    """The pack's outline from the model's mask: the main shape and whatever touches it, solid inside."""
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
    final = filled if solid >= SOLID_ENOUGH else hull
    return Image.fromarray((final * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.2))


def main():
    records_path, downloads, out = sys.argv[1:4]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    model = sys.argv[sys.argv.index("--model") + 1] if "--model" in sys.argv else MODEL
    os.makedirs(out, exist_ok=True)
    # The lane's memory cage is shared, so keep onnxruntime from holding a big arena.
    opts = ort.SessionOptions()
    opts.enable_cpu_mem_arena = False
    opts.enable_mem_pattern = False
    opts.intra_op_num_threads = 4
    session = new_session(model, sess_opts=opts)
    records = json.load(open(records_path))
    done = failed = 0
    for key, rec in records.items():
        if not rec.get("reviewed") or rec.get("source") == "dailymed":
            continue
        name = rec["file"]
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
                mask = remove(im, session=session, only_mask=True, post_process_mask=True)
                im.putalpha(outline(mask.convert("L")))
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

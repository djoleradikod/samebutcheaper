"""Pull nutrition and ingredients for catalogue products out of the Open Food Facts dump, for the swap page's comparison table.

Usage: python3 -I scripts/qa/extract_nutrition.py <en.openfoodfacts.org.products.csv.gz> <out.json>   (run from the repo root)

A side matches a record through the barcode of its reviewed photo, or through its own gtin. Values are per 100 g or 100 ml, as the dump
states them. Implausible values are dropped. The data is ODbL, so the site credits Open Food Facts and links each record.
"""
import csv
import glob
import gzip
import json
import os
import re
import sys
import time

dump, out = sys.argv[1], sys.argv[2]
csv.field_size_limit(10_000_000)

images = json.load(open("data/images.json"))
wanted = {}
for key, rec in images.items():
    m = re.search(r"openfoodfacts\.org/product/(\d+)", rec.get("page", ""))
    if m and rec.get("reviewed"):
        wanted.setdefault(m.group(1), set()).add(key)
for path in glob.glob("data/pairs/*.json"):
    for pair in json.load(open(path)):
        for side in (pair["brand"], pair["alternative"]):
            key = f"{side['brand']}|{side['product']}"
            if side.get("gtin") and key not in images:
                wanted.setdefault(str(side["gtin"]), set()).add(key)
print("barcodes wanted", len(wanted))

FIELDS = {
    "kcal": ("energy-kcal_100g", 900),
    "fat": ("fat_100g", 100),
    "saturates": ("saturated-fat_100g", 100),
    "sugars": ("sugars_100g", 100),
    "salt": ("salt_100g", 100),
    "protein": ("proteins_100g", 100),
    "fibre": ("fiber_100g", 100),
}


def number(raw, top):
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return None
    return round(v, 2) if 0 <= v <= top else None


def clean_ingredients(text):
    """Keep a list only if it reads as text. OCR'd lists are often garbled, and a garbled list isn't worth showing."""
    text = re.sub(r"\s+", " ", (text or "").replace("_", "")).strip()
    if len(text) < 8:
        return None
    letters = sum(c.isalpha() or c in " ,.()%-:;'" or c.isdigit() for c in text)
    return text[:600] if letters / len(text) > 0.95 else None


items = {}
started = time.time()
rows = 0
with gzip.open(dump, "rt", encoding="utf8", errors="replace", newline="") as f:
    reader = csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE)
    for row in reader:
        rows += 1
        keys = wanted.get(row.get("code") or "")
        if not keys:
            continue
        values = {name: number(row.get(col), top) for name, (col, top) in FIELDS.items()}
        if values["saturates"] is not None and values["fat"] is not None and values["saturates"] > values["fat"]:
            values["saturates"] = None
        if sum(v is not None for v in values.values()) < 3:
            continue
        record = {
            "code": row["code"],
            "page": f"https://world.openfoodfacts.org/product/{row['code']}",
            "name": (row.get("product_name") or "")[:120],
            "modified": (row.get("last_modified_datetime") or "")[:10],
            **values,
            "ingredients": clean_ingredients(row.get("ingredients_text")),
        }
        for key in keys:
            items[key] = record
meta = {
    "source": "Open Food Facts",
    "license": "ODbL 1.0",
    "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
    "dump": time.strftime("%Y-%m-%d", time.gmtime(os.path.getmtime(dump))),
}
with open(out, "w") as fh:
    json.dump({**meta, "items": dict(sorted(items.items()))}, fh, ensure_ascii=False, indent=1)
    fh.write("\n")
print("rows", rows, "matched sides", len(items), "with ingredients", sum(1 for r in items.values() if r["ingredients"]), "seconds", round(time.time() - started))

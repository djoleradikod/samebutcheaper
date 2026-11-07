"""List Open Facts candidates for every product side in data/ that has no reviewed photo.

Usage: python -I scripts/images/gather.py <out.json> [--all]
Reads the local index built from the Open Facts dumps (see docs/research/R2-reuse.md).
Output: [{key, category, market, brand, product, unit, candidates: [{db, code, name, brands, quantity, countries, image, page}]}]
"""
import json
import os
import re
import sqlite3
import sys

INDEX = "/mnt/fast-storage/samebutcheaper-qa/openfacts/index.sqlite"
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
HOST = {
    "food": "https://world.openfoodfacts.org",
    "beauty": "https://world.openbeautyfacts.org",
    "petfood": "https://world.openpetfoodfacts.org",
    "products": "https://world.openproductsfacts.org",
}
STOP = set(
    """the and for with of a an in on to by pack packs count ct oz fl ml l g kg lb lbs mg mcg tablets tablet capsules capsule softgels
    caplets size value family bottle box bag each per x new original store brand plus super ultra extra""".split()
)


def words(s):
    s = re.sub(r"\([^)]*\)", " ", s.lower())
    s = re.sub(r"\b\d+([.,]\d+)?\s*(oz|fl|ml|l|g|kg|lb|lbs|mg|mcg|ct|count|pack|pk|x|in|inch|ft|m|mm|cm|w|v|mah|sheets|rolls|loads)\b", " ", s)
    toks = re.findall(r"[^\W\d_]{3,}", s, re.UNICODE)
    return [t for t in toks if t not in STOP]


def fts(toks):
    return " ".join(f'"{t}"' for t in toks)


def sides():
    seen = {}
    for dirname in ("pairs", "bundles"):
        d = os.path.join(ROOT, "data", dirname)
        for f in sorted(os.listdir(d)):
            if not f.endswith(".json"):
                continue
            for item in json.load(open(os.path.join(d, f))):
                market = item.get("market", "US")
                cat = item.get("category")
                if dirname == "pairs":
                    prods = [item["brand"], item["alternative"]]
                else:
                    prods = list(item["components"])
                for p in prods:
                    key = f"{p['brand']}|{p['product']}"
                    seen.setdefault(key, {"key": key, "category": cat, "market": market, "brand": p["brand"], "product": p["product"], "unit": p.get("unit"), "gtin": p.get("gtin")})
    return list(seen.values())


def main():
    out, everything = sys.argv[1], "--all" in sys.argv
    records = {}
    rp = os.path.join(ROOT, "data", "images.json")
    if os.path.exists(rp):
        records = json.load(open(rp))
    con = sqlite3.connect(f"file:{INDEX}?mode=ro", uri=True)
    result = []
    for side in sides():
        rec = records.get(side["key"])
        if rec and rec.get("reviewed") and not everything:
            continue
        brand = words(side["brand"]) or re.findall(r"[^\W_]+", side["brand"].lower())
        brand_q = "brands : (" + fts(brand[:3]) + ")"
        prod = [w for w in words(side["product"]) if w not in brand]
        rows = []
        seen = set()
        for take in (5, 3, 2, 1, 0):
            q = brand_q + ((" AND name : (" + " OR ".join(f'"{t}"' for t in prod[:take]) + ")") if take and prod else "")
            try:
                found = con.execute(
                    "SELECT db, code, name, brands, quantity, countries, image FROM items WHERE items MATCH ? ORDER BY bm25(items, 5.0, 2.0) LIMIT 12",
                    (q,),
                ).fetchall()
            except sqlite3.OperationalError:
                found = []
            for r in found:
                if r[1] in seen:
                    continue
                seen.add(r[1])
                rows.append(r)
            if len(rows) >= 12:
                break
        side["candidates"] = [
            {"db": r[0], "code": r[1], "name": r[2], "brands": r[3], "quantity": r[4], "countries": r[5][:60], "image": r[6], "page": f"{HOST[r[0]]}/product/{r[1]}"}
            for r in rows[:12]
        ]
        result.append(side)
    json.dump(result, open(out, "w"), ensure_ascii=False, indent=0)
    have = sum(1 for s in result if s["candidates"])
    print(f"{len(result)} sides, {have} with at least one candidate")


if __name__ == "__main__":
    main()

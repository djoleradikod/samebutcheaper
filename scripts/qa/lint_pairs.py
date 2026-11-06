"""Checks research output before it joins data/pairs. Usage: python -I lint_pairs.py <file.json> [...]

Fails a pair when the record can't be right: units differ, fewer than 2 distinct sources, not 5% cheaper, a price that
isn't in Open Prices when the pair says it came from there, or a photo that doesn't belong to the stated barcode.
Prints one line per problem and a summary. Exit code 1 if anything failed.
"""
import json
import os
import re
import sqlite3
import sys
from urllib.parse import urlparse

PRICES = "/mnt/fast-storage/samebutcheaper-qa/openprices/openprices.sqlite"
FACTS = "/mnt/fast-storage/samebutcheaper-qa/openfacts/index.sqlite"
CATEGORIES = set(
    "food-pantry household skincare-personal-care beauty-hair baby pet kitchen tech-tools batteries tools-diy office car garden supplements otc-medicine".split()
)
MATCH = {"identical_active", "identical_formula", "same_manufacturer", "equivalent_spec"}
MARKETS = {"US", "GB", "CA", "DE"}
REQUIRED = ["slug", "market", "category", "subcategory", "title", "brand", "alternative", "match_type", "confidence", "summary", "evidence", "sources", "price_checked"]

prices = sqlite3.connect(f"file:{PRICES}?mode=ro", uri=True) if os.path.exists(PRICES) else None
facts = sqlite3.connect(f"file:{FACTS}?mode=ro", uri=True) if os.path.exists(FACTS) else None


def norm_unit(u):
    u = u.lower().strip().rstrip(".")
    u = re.sub(r"s$", "", u)
    return {"fluid ounce": "fl oz", "ounce": "oz"}.get(u, u)


def check_side(p, label, side, market, problems):
    for k in ("brand", "product", "size", "unit", "price", "retailer", "url"):
        if side.get(k) in (None, ""):
            problems.append(f"{label}: missing {k}")
    if not isinstance(side.get("price"), (int, float)) or side.get("price", 0) <= 0:
        problems.append(f"{label}: bad price")
    if not isinstance(side.get("size"), (int, float)) or side.get("size", 0) <= 0:
        problems.append(f"{label}: bad size")
    gtin = side.get("gtin")
    from_open_prices = any("prices.openfoodfacts.org" in s for s in p.get("sources", []))
    if gtin and prices and from_open_prices:
        rows = prices.execute("SELECT price, date, store FROM prices WHERE code = ? AND country = ?", (gtin, market)).fetchall()
        if rows and not any(abs(r[0] - side.get("price", -1)) < 0.006 for r in rows):
            problems.append(f"{label}: price {side.get('price')} not among Open Prices records {sorted(set(r[0] for r in rows))[:6]}")
        elif not rows:
            problems.append(f"{label}: barcode {gtin} has no Open Prices record in {market}")
        elif not any(r[1].startswith(p.get("price_checked", "?")) for r in rows):
            problems.append(f"{label}: price_checked {p.get('price_checked')} doesn't match record dates {sorted(set(r[1][:7] for r in rows))[-3:]}")
    if side.get("image") and facts:
        if not gtin:
            problems.append(f"{label}: photo without a barcode")
        else:
            row = facts.execute("SELECT image FROM products WHERE code = ?", (gtin,)).fetchone()
            if not row:
                problems.append(f"{label}: barcode {gtin} isn't in the Open Facts index")
            elif row[0] != side["image"]:
                problems.append(f"{label}: photo URL doesn't match the barcode's record")


def main():
    total = bad = 0
    seen = set()
    for path in sys.argv[1:]:
        data = json.load(open(path))
        for p in data:
            total += 1
            problems = []
            slug = p.get("slug", "(no slug)")
            for k in REQUIRED:
                if k not in p:
                    problems.append(f"missing {k}")
            if problems:
                bad += 1
                print(f"{os.path.basename(path)} {slug}: " + "; ".join(problems))
                continue
            if slug in seen:
                problems.append("duplicate slug")
            seen.add(slug)
            if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
                problems.append("slug not kebab-case")
            market = p["market"]
            if market not in MARKETS:
                problems.append("bad market")
            if market != "US" and not slug.endswith(f"-{market.lower()}"):
                problems.append(f"slug should end -{market.lower()}")
            if p["category"] not in CATEGORIES:
                problems.append(f"bad category {p['category']}")
            if p["match_type"] not in MATCH:
                problems.append("bad match_type")
            if p["confidence"] not in ("high", "medium"):
                problems.append("bad confidence")
            b, a = p["brand"], p["alternative"]
            check_side(p, "brand", b, market, problems)
            check_side(p, "alternative", a, market, problems)
            if norm_unit(str(b.get("unit"))) != norm_unit(str(a.get("unit"))):
                problems.append(f"units differ: {b.get('unit')} vs {a.get('unit')}")
            try:
                saving = 1 - (a["price"] / a["size"]) / (b["price"] / b["size"])
                if saving < 0.05:
                    problems.append(f"only {saving*100:.0f}% cheaper per unit")
                if saving > 0.92:
                    problems.append(f"{saving*100:.0f}% cheaper per unit looks wrong: check pack sizes")
            except Exception:  # noqa: BLE001
                problems.append("can't compute saving")
            hosts = {urlparse(s).netloc for s in p["sources"]}
            if len(p["sources"]) < 2 or len(set(p["sources"])) < 2:
                problems.append("fewer than 2 sources")
            if len(hosts) < 2:
                problems.append(f"sources all on one site: {hosts}")
            if not re.fullmatch(r"\d{4}-\d{2}(-\d{2})?", p["price_checked"]):
                problems.append("price_checked must be YYYY-MM")
            if b.get("brand", "").lower() == a.get("brand", "").lower():
                problems.append("same brand on both sides")
            if problems:
                bad += 1
                print(f"{os.path.basename(path)} {slug}: " + "; ".join(problems))
    print(f"{total} pairs checked, {bad} with problems")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

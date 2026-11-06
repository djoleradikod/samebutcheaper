"""The gauntlet's number half, read from the built catalogue. Usage: python -I scripts/qa/audit_catalog.py [--json]

Prints the share of swaps with a real photo, the medicine share, and every swap whose claim backing or units fall short.
A swap counts as medicine when it's in otc-medicine, or when a medicine sits in another aisle (children's fever syrup, minoxidil,
acne actives, infant gas relief, rehydration salts), so a move between aisles can't flatter the number.
"""
import collections
import json
import re
import sys
from urllib.parse import urlparse

MEDICINE_ELSEWHERE = re.compile(r"children's pain|hair regrowth|acne|gas relief|rehydration|diaper rash", re.I)


def is_medicine(p):
    return p["category"] == "otc-medicine" or bool(MEDICINE_ELSEWHERE.search(p.get("subcategory") or ""))


def norm_unit(u):
    u = str(u).lower().strip().rstrip(".")
    return re.sub(r"s$", "", u)


def main():
    c = json.load(open("src/generated/catalog.json"))
    pairs = c["pairs"]
    n = len(pairs)
    both = [p for p in pairs if p["brand"].get("photo") and p["alternative"].get("photo")]
    any_side = [p for p in pairs if p["brand"].get("photo") or p["alternative"].get("photo")]
    sides = sum(1 for p in pairs for s in ("brand", "alternative") if p[s].get("photo"))
    med = [p for p in pairs if is_medicine(p)]
    non_med = [p for p in pairs if not is_medicine(p)]
    thin = []
    mixed = []
    for p in pairs:
        hosts = {urlparse(s).netloc.removeprefix("www.") for s in p.get("sources", [])}
        if len(hosts) < 2:
            thin.append((p["slug"], sorted(hosts)))
        if norm_unit(p["brand"]["unit"]) != norm_unit(p["alternative"]["unit"]):
            mixed.append((p["slug"], p["brand"]["unit"], p["alternative"]["unit"]))
    by_cat = collections.Counter(p["category"] for p in pairs)
    by_market = collections.Counter(p.get("market", "US") for p in pairs)
    out = {
        "swaps": n,
        "both_photos": len(both),
        "both_share": round(len(both) / n * 100, 1),
        "any_photo": len(any_side),
        "any_share": round(len(any_side) / n * 100, 1),
        "sides_with_photo_share": round(sides / (2 * n) * 100, 1),
        "non_medicine_both_share": round(sum(1 for p in both if not is_medicine(p)) / max(1, len(non_med)) * 100, 1),
        "medicine": len(med),
        "medicine_share": round(len(med) / n * 100, 1),
        "under_two_sites": len(thin),
        "mixed_units": len(mixed),
        "presets": len(c.get("presets", [])),
        "by_category": dict(by_cat.most_common()),
        "by_market": dict(by_market.most_common()),
    }
    if "--json" in sys.argv:
        print(json.dumps(out, indent=1))
        return
    for k, v in out.items():
        print(f"{k}: {v}")
    print("\nunder two sites:")
    for s, h in thin:
        print(" ", s, h)
    print("\nmixed units:")
    for row in mixed:
        print(" ", *row)


if __name__ == "__main__":
    main()

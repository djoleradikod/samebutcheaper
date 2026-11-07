"""Build swap records from mined candidates and a judge's decisions. All numbers come from the mined records.

Usage: python -I scripts/qa/assemble_pairs.py <mined.json> <decisions.json> [...] --out <pairs.json>
Decision: {id, keep, category, subcategory, brand_short, alt_short, match_type, summary, evidence, differences, why, claims, key_ingredients}
"""
import json
import re
import sys
from urllib.parse import quote_plus

HOST = {
    "food": "https://world.openfoodfacts.org",
    "beauty": "https://world.openbeautyfacts.org",
    "petfood": "https://world.openpetfoodfacts.org",
    "products": "https://world.openproductsfacts.org",
}
STORES = [
    (r"safeway", "safeway", "https://www.safeway.com/shop/search-results.html?q={q}"),
    (r"whole foods", "wholefoods", "https://www.wholefoodsmarket.com/search?text={q}"),
    (r"target", "target", "https://www.target.com/s?searchTerm={q}"),
    (r"walmart", "walmart", "https://www.walmart.com/search?q={q}"),
    (r"sprouts", "sprouts", "https://shop.sprouts.com/search?search_term={q}"),
    (r"winco", "winco", "https://www.wincofoods.com/search?q={q}"),
    (r"walgreens", "walgreens", "https://www.walgreens.com/search/results.jsp?Ntt={q}"),
    (r"kroger", "kroger", "https://www.kroger.com/search?query={q}"),
    (r"costco", "costco", "https://www.costco.com/CatalogSearch?keyword={q}"),
    (r"netto", "netto", "https://www.netto-online.de/search?query={q}"),
    (r"lidl", "lidl", "https://www.lidl.de/q/search?q={q}"),
    (r"kaufland", "kaufland", "https://www.kaufland.de/s/?search_value={q}"),
    (r"edeka", "edeka", "https://www.edeka.de/suche?q={q}"),
    (r"rewe", "rewe", "https://shop.rewe.de/productList?search={q}"),
    (r"aldi", "aldi", "https://www.aldi-sued.de/de/suchergebnisse.html?search={q}"),
    (r"penny", "penny", "https://www.penny.de/suche?q={q}"),
    (r"tegut", "tegut", "https://www.tegut.com/suche.html?q={q}"),
    (r"tesco", "tesco", "https://www.tesco.com/groceries/en-GB/search?query={q}"),
    (r"sainsbury", "sainsburys", "https://www.sainsburys.co.uk/gol-ui/SearchResults/{q}"),
    (r"asda", "asda", "https://groceries.asda.com/search/{q}"),
    (r"morrisons", "morrisons", "https://groceries.morrisons.com/search?q={q}"),
    (r"co-?op", "coop", "https://www.coop.co.uk/products?q={q}"),
    (r"marks & spencer", "marksandspencer", "https://www.ocado.com/search?entry={q}"),
]


def slugify(s):
    s = s.lower().replace("&", " and ").replace("'", "")
    s = re.sub(r"[äÄ]", "ae", s)
    s = re.sub(r"[öÖ]", "oe", s)
    s = re.sub(r"[üÜ]", "ue", s)
    s = s.replace("ß", "ss")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def store_of(name, query, market):
    for pattern, slug, url in STORES:
        if re.search(pattern, name or "", re.I):
            if slug == "aldi" and market == "GB":
                return slug, f"https://www.aldi.co.uk/results?q={query}"
            if slug == "lidl" and market == "GB":
                return slug, f"https://www.lidl.co.uk/q/search?q={query}"
            if slug == "aldi" and market == "US":
                return slug, f"https://www.aldi.us/results?q={query}"
            return slug, url.format(q=query)
    return "other", f"https://www.google.com/search?tbm=shop&q={query}"


def size_unit(amount, unit, market):
    if market in ("US",) and unit == "g":
        return round(amount / 28.3495, 2), "oz"
    if market in ("US",) and unit == "ml":
        return round(amount / 29.5735, 2), "fl oz"
    if unit.startswith("count:"):
        return round(amount), {"roll": "roll", "roll": "roll", "st": "piece", "stüc": "piece", "stk": "piece", "coun": "piece", "ct": "piece", "pack": "pack", "pk": "pack", "tabs": "tablet", "tab": "tablet", "tabl": "tablet", "pcs": "piece", "piec": "piece", "blat": "sheet", "shee": "sheet", "wl": "load", "wasc": "load", "load": "load"}.get(unit[6:], "piece")
    return round(amount, 1), unit


def side(rec, short, market, ingredients):
    brand = rec["brand"].strip().split(",")[0].strip()
    q = quote_plus(f"{brand} {short}")
    slug, url = store_of(rec["store"], q, market)
    size, unit = size_unit(rec["amount"], rec["unit"], market)
    label = rec["quantity"].strip()
    return {
        "brand": brand,
        "product": f"{brand} {short}, {label}",
        "size": size,
        "unit": unit,
        "price": rec["price"],
        "retailer": slug,
        "asin": None,
        "url": url,
        "gtin": rec["code"],
        "image": rec["image"],
        "key_ingredients": [{"name": i, "amount": ""} for i in ingredients],
    }


def main():
    args = sys.argv[1:]
    out = args[args.index("--out") + 1]
    mined = json.load(open(args[0]))
    decisions = []
    for path in args[1:args.index("--out")]:
        decisions += json.load(open(path))
    pairs = []
    kept = 0
    for d in decisions:
        if not d.get("keep"):
            continue
        kept += 1
        c = mined[d["id"]]
        market = c["market"]
        b, a = c["brand"], c["alt"]
        ing = d.get("key_ingredients") or []
        brand_side = side(b, d["brand_short"], market, ing)
        alt_side = side(a, d["alt_short"], market, ing)
        suffix = "" if market == "US" else f"-{market.lower()}"
        months = sorted([b["date"][:7], a["date"][:7]])
        sources = [
            f"https://prices.openfoodfacts.org/products/{b['code']}",
            f"https://prices.openfoodfacts.org/products/{a['code']}",
            f"{HOST.get(b['db'], HOST['food'])}/product/{b['code']}",
            f"{HOST.get(a['db'], HOST['food'])}/product/{a['code']}",
        ]
        pairs.append(
            {
                "slug": slugify(f"{brand_side['brand']} {d['brand_short']} vs {alt_side['brand']} {d['alt_short']}") + suffix,
                "market": market,
                "category": d["category"],
                "subcategory": d["subcategory"],
                "title": f"{brand_side['brand']} {d['brand_short']} vs {alt_side['brand']} {d['alt_short']}",
                "brand": brand_side,
                "alternative": alt_side,
                "match_type": d.get("match_type", "equivalent_spec"),
                "confidence": "medium",
                "summary": d["summary"],
                "evidence": d["evidence"],
                "differences": d.get("differences", ""),
                "why": d.get("why"),
                "claims": d.get("claims", []),
                "sources": sources,
                "price_checked": months[0],
            }
        )
    json.dump(pairs, open(out, "w"), ensure_ascii=False, indent=1)
    open(out, "a").write("\n")
    print(f"{len(decisions)} decisions, kept {kept}, wrote {len(pairs)} to {out}")


if __name__ == "__main__":
    main()

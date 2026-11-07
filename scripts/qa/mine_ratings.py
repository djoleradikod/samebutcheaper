#!/usr/bin/env python3
"""Write data/evidence/ratings.json: scores the catalogue already quotes for its cheaper products, as ratings.

Two kinds. Researched rows ("Auto Express score", "Shopper rating", "zooplus rating") are parsed. Scores quoted only in a swap's
written text are listed below by hand, each read from that text. Run after changing either: python3 -I scripts/qa/mine_ratings.py
"""
import glob
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]

# slug start: (score, scale, publisher, part of the link that carries the score, then optionally the source's own word and the test's date)
QUOTED = {
    "nescafe-gold-blend-vs-aldi": (68, "percent", "Which?", "which.co.uk"),
    "fairy-max-power-eucalyptus-vs-aldi": (78, "percent", "Which?", "own-brand-best-buys"),
    "fairy-max-power-original-vs-aldi": (78, "percent", "Which?", "own-brand-best-buys"),
    "heinz-tomato-ketchup-vs-waitrose": (77, "percent", "Which?", "which.co.uk"),
    "lurpak-spreadable-vs-aldi": (75, "percent", "Which?", "which.co.uk"),
    "baxters-cream-of-tomato-soup-vs-tesco": (78, "percent", "Which?", "which.co.uk"),
    "heinz-tomato-ketchup-vs-co-op": (76, "percent", "Which?", "which.co.uk"),
    "yorkshire-tea-vs-waitrose": (75, "percent", "Which?", "which.co.uk"),
    "heinz-beanz-vs-aldi": (77, "percent", "Which?", "which.co.uk"),
    "hellmanns-real-mayonnaise-vs-s": (73, "percent", "Which?", "which.co.uk"),
    "heineken-0-0-vs-lidl": (71, "percent", "Which?", "which.co.uk"),
    "haagen-dazs-vanilla-vs-aldi": (77, "percent", "Which?", "which.co.uk"),
    "heinz-cream-of-tomato-soup-vs-s": (78, "percent", "Which?", "which.co.uk"),
    "tetley-original-vs-morrisons": (73, "percent", "Which?", "which.co.uk"),
    "duracell-recharge-ultra-aa": (84, "percent", "Which?", "own-brand-best-buys"),
    "fairy-original-washing-up-liquid-vs-aldi": (78, "percent", "Which?", "own-brand-best-buys"),
    "tims-dairy-greek-yogurt-vs-aldi": (77, "percent", "Which?", "which.co.uk"),
    "aunt-bessies-beef-dripping": (76, "percent", "Which?", "which.co.uk"),
    "pg-tips-original-vs-sainsburys": (75, "percent", "Which?", "which.co.uk"),
    "nutella-vs-tesco": (81, "percent", "Which?", "which.co.uk"),
    "hotel-chocolat-classic-70-vs-tesco": (70, "percent", "Which?", "which.co.uk"),
    "jolly-hog-proper-porkers-vs-lidl": (73, "percent", "Which?", "which.co.uk"),
    "manilife-original-roast-smooth": (70, "percent", "Which?", "which.co.uk"),
    "bertinet-rustic-country-white": (62, "percent", "Which?", "which.co.uk"),
    "plenty-original-kitchen-roll-vs-m": (95, "percent", "Which?", "which.co.uk"),
    # German grades: 1.0 is best. See "Ratings" in data/README.md.
    "avene-sonnenmilch-dry-touch-vs-dm": (1.5, "de-grade", "Stiftung Warentest", "test.de"),
    "sensodyne-sensitivitaet-zahnfleisch-vs-k": (1.5, "de-grade", "Stiftung Warentest", "joyn.de"),
    "oral-b-professional-sensitiv-pro-vs-k": (1.5, "de-grade", "Stiftung Warentest", "joyn.de"),
    "whiskas-mit-gefluegel-in-sauce-vs-lidl": (1.3, "de-grade", "Stiftung Warentest", "test.de"),
    "whiskas-1-plus-knackits-vs-netto": (1.3, "de-grade", "Stiftung Warentest", "t-online.de"),
    "lenor-universalwaschmittel-aprilfrisch": (2.5, "de-grade", "Stiftung Warentest", "mydealz.de"),
    "royal-canin-medium-adult-vs-4paws": (1.3, "de-grade", "Stiftung Warentest", "herz-fuer-tiere.de", None, "2025-08"),
    "blend-a-med-3d-white-luxe-charcoal-vs": (1.3, "de-grade", "Stiftung Warentest", "joyn.de"),
    "frosch-all-in-1-spuel-tabs-vs-rossmann": (2.1, "de-grade", "Stiftung Warentest", "joyn.de"),
    "persil-universal-megaperls-vs-denkmit": (1.6, "de-grade", "Stiftung Warentest", "mydealz.de"),
    "persil-universal-megaperls-vs-lidl": (1.6, "de-grade", "Stiftung Warentest", "mydealz.de"),
    "koelln-bluetenzarte-koellnflocken": (1.0, "de-grade", "Öko-Test", "oekotest.de", "very good"),
    "alnatura-haferflocken-feinblatt-vs": (1.0, "de-grade", "Öko-Test", "oekotest.de", "very good"),
    "fairy-konzentrat-vs-rewe-ja": (1.0, "de-grade", "Öko-Test", "echo24.de", "very good"),
}
TEST_ROWS = {"Auto Express score": "Auto Express", "Shopper rating": None, "zooplus rating": None}


def host(url):
    return re.sub(r"^www\.", "", url.split("/")[2])


pairs = []
for name in sorted(glob.glob(str(ROOT / "data" / "pairs" / "*.json"))):
    pairs.extend(json.load(open(name)))

out = {}
missing = []
for start, (score, scale, publisher, where, *extra) in QUOTED.items():
    found = [p for p in pairs if p["slug"].startswith(start)]
    if len(found) != 1:
        missing.append(f"{start}: {len(found)} records")
        continue
    p = found[0]
    source = next((s for s in p["sources"] if where in s), None)
    if not source:
        missing.append(f"{start}: no source at {where}")
        continue
    wording, date = (extra + [None, None])[:2]
    rating = {"score": score, "scale": scale, "publisher": publisher, "source": source, "date": date or p.get("price_checked")}
    if wording:
        rating["wording"] = wording
    out[p["slug"]] = rating

for p in pairs:
    if p["slug"] in out or (p["alternative"].get("rating") or {}).get("stars") is not None:
        continue
    for row in p.get("aspects") or []:
        if row["aspect"] not in TEST_ROWS:
            continue
        text = row["alternative"]
        score = re.search(r"(\d(?:\.\d+)?)\s*(?:/\s*5|stars?\b|of 5\b)", text)
        if not score:
            continue
        count = re.search(r"([\d,]+)\s*(?:ratings|reviews)|\((\d[\d,]*)\)", text)
        rating = {"score": float(score.group(1)), "scale": "stars-5", "source": row.get("source") or p["sources"][0], "date": p.get("price_checked")}
        publisher = TEST_ROWS[row["aspect"]]
        if publisher:
            rating["publisher"] = publisher
        if count:
            rating["count"] = int((count.group(1) or count.group(2)).replace(",", ""))
        out[p["slug"]] = rating
        break
    else:
        # Auto Express scores quoted in the text rather than a row: "around GBP 29 for Vonhaus (4 of 5)".
        brand = re.escape(p["alternative"]["brand"])
        quoted = re.search(rf"{brand}[^()]{{0,40}}\([^()]*?(\d(?:\.\d)?) of 5\)", p.get("evidence") or "")
        if quoted and any("autoexpress" in s for s in p["sources"]):
            source = next(s for s in p["sources"] if "autoexpress" in s)
            out[p["slug"]] = {"score": float(quoted.group(1)), "scale": "stars-5", "publisher": "Auto Express", "source": source, "date": p.get("price_checked")}

path = ROOT / "data" / "evidence" / "ratings.json"
path.write_text(json.dumps(dict(sorted(out.items())), indent=1, ensure_ascii=False) + "\n")
print(f"wrote {len(out)} ratings")
for line in missing:
    print("NOT WRITTEN", line)

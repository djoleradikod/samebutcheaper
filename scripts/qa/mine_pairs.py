"""Mine brand-versus-own-label candidates from recent Open Prices records joined to Open Facts.

Usage: python -I scripts/qa/mine_pairs.py <out.json> [--per-market 160]

Candidates are not swaps. A judge reads each one and keeps only real like-for-like pairs. This script only
finds pairs in the same market and shelf with readable pack sizes, a regular price and similar ingredients.
"""
import collections
import json
import re
import sqlite3
import sys

PRICES = "/mnt/fast-storage/samebutcheaper-qa/openprices/openprices.sqlite"
FACTS = "/mnt/fast-storage/samebutcheaper-qa/openfacts/index.sqlite"

OWN_LABEL = {
    "US": """signature select|signature selects|signature care|signature farms|open nature|o organics|lucerne|great value|market pantry|good & gather|good and gather|up & up|up&up|equate|365|whole foods market|kirkland|kirkland signature|trader joe's|trader joes|kroger|simple truth|safeway|sprouts|sprouts farmers market|winco|winco foods|member's mark|freshness guaranteed|parent's choice|millville|simply nature|specially selected|friendly farms|happy farms|l'oven fresh|best choice|essential everyday|food club|hy-vee|meijer|publix|wegmans|h-e-b|heb|target|walmart|aldi|signature reserve|waterfront bistro|primo taglio|ready meals|value corner|clancy's|barissimo|fit & active|burman's|casa mamita|chef's cupboard|dakota's pride|elevation|emporium selection|little salad bar|mama cozzi's|northern catch|priano|southern grove|stonemill|sundae shoppe|tuscan garden|favorite day|archer farms|simply balanced|wellsley farms|sam's choice|marketside|hill country fare|private selection|psst|smart way|clover valley|family gourmet|whole foods|wf""".split("|"),
    "DE": """ja!|ja|gut & günstig|gut&günstig|gut und günstig|edeka|k-classic|k classic|kaufland|milsani|combino|baresa|bellarom|vegola|nussetti|delikato|korn mühle|kornmühle|alesto|freshona|milbona|solevita|rewe|rewe beste wahl|rewe bio|penny|lidl|aldi|aldi süd|aldi nord|netto|netto marken-discount|gutbio|gut bio|moreno|tandil|fairglobe|crownfield|deluxe|sondey|choceur|favorina|favora|floralys|samelle|priva|savin|denkmit|domol|balea|isana|cien|elkos|today|mibell|landliebe|bio organic|enerbio|rapunzel_no|grana_no|lyttos|eridanous|pilos|chef select|oro di parma|lacura|w5|formil|grandessa|cucina|kania|hofburger|milfina|bio sonne|rewe feine welt|feine welt|edeka bio|k-bio|lyttos|mucci|snack day|tower gate|classic|cachet|alpenfest|belbake|dulano|pikok|sol & mar|nur nur natur|wonnemeyer|rio d'oro|golden seafood|hofmaier|gartenkrone|mama mancini|speisezeit|workzone|kokett|ombia|biotrend|mamia|river|freeway|vemondo|crivit|lupilu|silvercrest|bio bio|mondo italiano|bon-ri|mein bestes|rebell|herzstücke|k-favourites|k-take it veggie|alverde|dontodent|profissimo|babylove|sundance|mivolis|dmbio|das gesunde plus|alterra|babydream|prokudent|altapharma|sunozon|winston|ideenwelt|rio grande|gut&amp;günstig|milram_no""".split("|"),
    "GB": """aldi|lidl|tesco|sainsbury's|sainsburys|asda|morrisons|co-op|coop|waitrose|marks & spencer|m&s|iceland|freshona|deluxe|specially selected|stockwell & co|stockwell|harvest morn|bramwells|bramwell's|everyday essentials|just essentials|hearty food co|the grocer|savers|essential waitrose|by sainsbury's|asda smart price|smart price""".split("|"),
    "CA": """no name|president's choice|great value|kirkland|kirkland signature|compliments|selection|irresistibles|sans nom""".split("|"),
}
STORE_TIER_PREMIUM = re.compile(r"whole foods|sprouts|natural grocers|erewhon|bio company|alnatura|denn's|reformhaus|marks & spencer|waitrose", re.I)
CONFLICT_WORDS = """organic bio light zero sugar-free sugarfree "no sugar" vegan gluten decaf entkoffeiniert kids children baby reduced low-fat lactose laktosefrei
vollkorn wholewheat whole-wheat protein chocolate schoko spicy hot chili hot-chili""".replace('"', "").split()
STOP = set("""and or with of the a an contains less than from to und mit aus enthält kann spuren von en de la le les des et a b c d e f g h i j natural flavor flavors flavour aroma aromen natürliches
vitamin vitamins salt salz sugar zucker water wasser % percent""".split())


def num(s):
    return float(s.replace(",", "."))


def parse_qty(text):
    """Return (amount, unit) with unit g, ml, oz, floz or count. Prefers metric when both are given."""
    if not text:
        return None
    t = text.lower().replace(" ", " ")
    m = re.search(r"(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b", t)
    if m:
        n, each, u = int(m.group(1)), num(m.group(2)), m.group(3)
        factor = {"kg": (1000, "g"), "g": (1, "g"), "ml": (1, "ml"), "cl": (10, "ml"), "l": (1000, "ml")}[u]
        return (n * each * factor[0], factor[1])
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b", t)
    if m:
        v, u = num(m.group(1)), m.group(2)
        factor = {"kg": (1000, "g"), "g": (1, "g"), "ml": (1, "ml"), "cl": (10, "ml"), "l": (1000, "ml")}[u]
        return (v * factor[0], factor[1])
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(fl\.?\s*oz|floz)\b", t)
    if m:
        return (num(m.group(1)) * 29.5735, "ml")
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(oz|ounce|ounces)\b", t)
    if m:
        return (num(m.group(1)) * 28.3495, "g")
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(lb|lbs|pound|pounds)\b", t)
    if m:
        return (num(m.group(1)) * 453.592, "g")
    m = re.search(r"(\d+)\s*(st|stück|stk|count|ct|pack|pk|rolls?|rollen|tabs?|tablets?|pcs|pieces|blatt|sheets?|wl|waschladungen|loads?)\b", t)
    if m:
        return (float(m.group(1)), "count:" + m.group(2)[:4])
    return None


def tokens(ingredients):
    words = re.findall(r"[a-zà-ÿäöüß]{3,}", (ingredients or "").lower())
    return [w for w in words if w not in STOP]


def similarity(a, b):
    A, B = set(tokens(a)), set(tokens(b))
    if not A or not B:
        return None
    return round(len(A & B) / len(A | B), 2)


def conflict(a, b):
    a, b = a.lower(), b.lower()
    return [w for w in CONFLICT_WORDS if (w in a) != (w in b)]


def is_own(brand, market):
    labels = OWN_LABEL.get(market, [])
    parts = [p.strip().lower() for p in re.split(r",", brand)]
    return any(p in labels for p in parts)


def shelf(categories):
    cats = [c.strip() for c in (categories or "").split(",") if c.strip()]
    useful = [c for c in cats if not re.match(r"^(en|de|fr|nl|es|it|pt):", c.strip()) or True]
    return useful[-1].lower() if useful else ""


GENERIC_SHELVES = {"en:undefined", "en:groceries", "groceries", "en:unknown", "foods", "dairies", "snacks", "beverages", "sweet snacks",
                   "plant-based foods", "plant-based foods and beverages", "condiments", "sauces", "meals", "desserts", "breakfasts", "spreads", "cereals and potatoes",
                   "frozen foods", "canned foods", "fruits and vegetables based foods", "fruits based foods", "vegetables based foods"}


def main():
    out = sys.argv[1]
    per_market = int(sys.argv[sys.argv.index("--per-market") + 1]) if "--per-market" in sys.argv else 160
    con = sqlite3.connect(f"file:{PRICES}?mode=ro", uri=True)
    off = sqlite3.connect(f"file:{FACTS}?mode=ro", uri=True)
    result = []
    for market in ("US", "DE", "GB", "CA"):
        rows = con.execute(
            "SELECT code, name, quantity, image, store, city, price, currency, per, discounted, date, categories FROM prices WHERE country = ? AND name <> ''",
            (market,),
        ).fetchall()
        latest = {}
        for r in rows:
            code, name, qty, image, store, city, price, cur, per, disc, date, cats = r
            if disc or (per and per not in ("UNIT",)):
                continue
            key = (code, store)
            if key not in latest or latest[key]["date"] < date:
                latest[key] = dict(code=code, name=name, quantity=qty, image=image, store=store, city=city, price=price, currency=cur, date=date, categories=cats)
        by_shelf = collections.defaultdict(list)
        ing_cache = {}
        for e in latest.values():
            q = parse_qty(e["quantity"])
            if not q or not q[0] or not e["categories"]:
                continue
            e["amount"], e["unit"] = q
            brand = e["name"].split(":", 1)[0]
            e["brand"] = brand
            e["own"] = is_own(brand, market)
            e["ppu"] = e["price"] / e["amount"]
            if e["code"] not in ing_cache:
                row = off.execute("SELECT db, ingredients FROM products WHERE code = ?", (e["code"],)).fetchone()
                ing_cache[e["code"]] = row or ("", "")
            e["db"], e["ingredients"] = ing_cache[e["code"]]
            cats = [c.strip().lower() for c in e["categories"].split(",") if c.strip()]
            for c in cats[-2:]:
                if c not in GENERIC_SHELVES:
                    by_shelf[c].append(e)
        cands = []
        for s, items in by_shelf.items():
            brands = [i for i in items if not i["own"]]
            owns = [i for i in items if i["own"]]
            for b in brands:
                for a in owns:
                    if b["unit"] != a["unit"] or b["code"] == a["code"]:
                        continue
                    saving = 1 - a["ppu"] / b["ppu"]
                    if not 0.1 <= saving <= 0.72:
                        continue
                    if not 0.33 <= a["amount"] / b["amount"] <= 3:
                        continue
                    if conflict(b["name"], a["name"]):
                        continue
                    same_store = b["store"] == a["store"] and b["store"] != ""
                    if not same_store and (STORE_TIER_PREMIUM.search(b["store"] or "") and not STORE_TIER_PREMIUM.search(a["store"] or "")):
                        continue
                    sim = similarity(b["ingredients"], a["ingredients"])
                    is_food = b["db"] == "food" and a["db"] == "food"
                    if is_food and (sim is None or sim < 0.5):
                        continue
                    score = (2.0 if same_store else 1.0) * (sim if sim is not None else 0.6) * (0.5 + saving)
                    cands.append(dict(market=market, shelf=s, same_store=same_store, similarity=sim, saving=round(saving * 100), score=round(score, 3), brand=b, alt=a))
        cands.sort(key=lambda c: -c["score"])
        seen_pair, used_brand, used_alt, per_shelf, picked = set(), collections.Counter(), collections.Counter(), collections.Counter(), []
        for c in cands:
            key = (c["brand"]["code"], c["alt"]["code"])
            if key in seen_pair or used_brand[c["brand"]["code"]] >= 1 or used_alt[c["alt"]["code"]] >= 1 or per_shelf[c["shelf"]] >= 5:
                continue
            seen_pair.add(key)
            used_brand[c["brand"]["code"]] += 1
            used_alt[c["alt"]["code"]] += 1
            per_shelf[c["shelf"]] += 1
            picked.append(c)
            if len(picked) >= per_market:
                break
        print(market, "priced items", len(latest), "shelves", len(by_shelf), "raw candidates", len(cands), "picked", len(picked), flush=True)
        result += picked
    json.dump(result, open(out, "w"), ensure_ascii=False, indent=0)
    shelves = collections.Counter(c["shelf"] for c in result)
    print("top shelves", shelves.most_common(30))


if __name__ == "__main__":
    main()

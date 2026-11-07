#!/usr/bin/env python3
"""What a shopper in each country gets from the server, before any script runs.

Usage: python3 -I scripts/qa/country_http.py http://127.0.0.1:8851

Checks the visible text of each page (scripts and styles removed) and the whole response for a dollar
price or a US store. Exits 1 if anything fails. Needs no browser, so it doesn't wait for the lane.
"""
import html
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1].rstrip("/")
UA = "samebutcheaper-qa"


def get(path: str, country: str | None, lang: str | None = None):
    headers = {"User-Agent": UA, "Accept": "text/html"}
    if country:
        headers["Cookie"] = f"sbc_country={country}"
    if lang:
        headers["Accept-Language"] = lang
    req = urllib.request.Request(BASE + path, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode("utf-8", "replace"), r.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), e.headers


def visible(body: str) -> str:
    """Streamed content arrives in hidden templates that a browser moves into place, so those count as visible."""
    text = re.sub(r"<!--.*?-->", "", body, flags=re.S)  # React splits text with these.
    text = re.sub(r"<(script|style)\b.*?</\1>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text))


US_STORES = re.compile(r"\b(walmart|target\.com|costco|walgreens|cvs|kroger|safeway|sam's club|chewy)\b", re.I)
DOLLAR_PRICE = re.compile(r"(?<![A-Za-z])\$\s?\d")
# In the raw response, React's own references read "$2": a quote before the $ means it isn't a price.
# React's references never have cents, so "$12.34" after a quote is still a price, as it sits in the page's flight data.
RAW_DOLLAR_PRICE = re.compile(r"(?<![\"\\\w])\$\s?\d|\$\d+\.\d\d(?!\d)")
# Named by hand, apart from the site's own rules, because a check built on those rules can't see them being wrong.
# Both earlier versions of this file looked only for store names and $, and US products went straight past them.
# "Great Value" alone is also a Which? badge, so it needs a product name after it. "Best Buy" is too, so that store stays out.
US_ONLY = re.compile(r"\b(Charmin|Kirkland|Equate|Jif|Parent's Choice|Great Value [A-Z]\w+|Member's Mark|(?i:up&up)|Signature Select|Good & Gather|Market Pantry|Lucerne|Uline|Bounty|Target)\b")
# No sign these sell in the country, see data/sellers/footprint.json. A swap page may still cite them as evidence, so lists only.
ABSENT = {
    "IE": re.compile(r"\b(Sainsbury's|Asda|Morrisons|Waitrose|Ocado|Co-op|Crocus|7dayshop|Toolstation|Kaufland|Rewe|REWE|Edeka|EDEKA|Netto|Penny|Rossmann|myTime|Jeden Tag|Pollin|Alternate)\b"),
    "GB": re.compile(r"\b(Kaufland|Rewe|REWE|Edeka|EDEKA|Netto|Penny|Rossmann|myTime|Jeden Tag|Pollin|Alternate|Walmart)\b"),
    "DE": re.compile(r"\b(Sainsbury's|Asda|Morrisons|Waitrose|Ocado|Crocus|7dayshop|Toolstation|Tesco|Boots|Superdrug|Walmart)\b"),
    "HR": re.compile(r"\b(Sainsbury's|Asda|Morrisons|Waitrose|Ocado|Crocus|Toolstation|Tesco|Aldi|Boots|Superdrug|Rewe|REWE|Edeka|EDEKA|Netto|Penny|Rossmann|myTime|Jeden Tag|Pollin|Alternate|Walmart)\b"),
}
LIST_PAGES = ["/", "/category/household", "/category/food-pantry", "/bulk", "/bundles", "/biggest-savings", "/brands", "/ingredients", "/search", "/why", "/ingredient/loratadine", "/brand/heinz"]
failures = 0


def check(ok: bool, name: str, detail: str = "") -> None:
    global failures
    print("PASS" if ok else "FAIL", name, detail if not ok else "")
    if not ok:
        failures += 1


# Real slugs, from the served index: a UK swap, a German one and a US one.
index = json.loads(urllib.request.urlopen(urllib.request.Request(BASE + "/search/index.json", headers={"User-Agent": UA}), timeout=60).read())
by_market: dict[str, list] = {}
for p in index["pairs"]:
    by_market.setdefault(p["market"], []).append(p)
uk_swap = next(p["slug"] for p in by_market["GB"] if p["category"] != "otc-medicine")
de_swap = next(p["slug"] for p in by_market["DE"] if p["category"] != "otc-medicine")
us_swap = by_market["US"][0]["slug"]

PAGES = ["/", "/category/household", f"/compare/{uk_swap}", "/bulk", "/bundles", "/biggest-savings"]

for page in PAGES:
    status, body, _ = get(page, "IE")
    text = visible(body)
    check(status == 200, f"IE {page} opens", str(status))
    check(not DOLLAR_PRICE.search(text), f"IE {page}: no $ in what shows", str(DOLLAR_PRICE.findall(text)[:3]))
    check(not RAW_DOLLAR_PRICE.search(body), f"IE {page}: no $ price anywhere in the response", str(RAW_DOLLAR_PRICE.findall(body)[:3]))
    check("walmart" not in body.lower(), f"IE {page}: Walmart nowhere in the response, data included")
    found = US_STORES.findall(text)
    check(not found, f"IE {page}: no US store in what shows", str(sorted(set(found))))
    check("€" in text, f"IE {page}: shows euro")

status, body, _ = get("/", "IE")
text = visible(body)
check("started checking prices in Ireland" in text, "IE home: the band says most of these aren't Irish prices")
check("UK prices, shown in euro" in text, "IE home: the band names the market and the currency")
ie_swap = by_market.get("IE", [{}])[0].get("slug")
check(bool(ie_swap), "the catalogue has an Irish swap")
status, body, _ = get(f"/compare/{ie_swap}", "IE")
offers = visible(body).split("Prices checked")[0]
check(status == 200 and "€" in offers and not re.search(r"about\s*€\d", offers), "IE an Irish swap: plain euro, nothing to convert", offers[:300])
check("ECB rate of" in text, "IE home: the band names the rate and its date")

status, body, _ = get(f"/compare/{uk_swap}", "IE")
text = visible(body)
check(bool(re.search(r"about\s*€\d", text)), "IE UK swap: converted price reads about")
check(bool(re.search(r"\(£[\d.,]+ at a UK store, [A-Z][a-z]{2} \d{4}\)", text)), "IE UK swap: original price, UK store and date sit beside it", text[:0])
check("Search SuperValu" in text and "Search Amazon.ie" in text, "IE UK swap: Irish store searches on the page")

status, body, _ = get(f"/compare/{us_swap}", "IE")
text = visible(body)
check(status == 200, "IE opening a US swap by its link still works", str(status))
# The evidence further down may cite a US source. What matters is the part that tells someone where to buy.
check("Prices checked" in text, "IE US swap: the offers section is where this check looks for it")
offers = text[text.find("Prices checked") : text.find("Does the same job") if "Does the same job" in text else None]
check(not DOLLAR_PRICE.search(re.sub(r"\(\$[\d.,]+ at a US store[^)]*\)|\(\$1 = [^)]*\)", "", offers)), "IE US swap: in the offers, dollars only as the marked original", offers[:400])
check(not US_STORES.search(offers), "IE US swap: no US store offered", offers[:400])

# A German swap is already in euro, for Croatia as for Germany: nothing to convert or mark.
status, body, _ = get(f"/compare/{de_swap}", "HR")
text = visible(body)
check("€" in text and not re.search(r"about\s*€\d", text.split("Prices checked")[0]), "HR German swap: euro with no conversion")
status, body, _ = get("/", "HR")
text = visible(body)
check("German prices, shown in euro" in text, "HR home: the band names the fallback")
check(not DOLLAR_PRICE.search(text) and not US_STORES.search(text), "HR home: no $ and no US store")

status, body, _ = get("/", "DE")
text = visible(body)
check("€" in text and not DOLLAR_PRICE.search(text), "DE home: euro, no $")
check("yet, so these are" not in text, "DE home: no fallback band")

status, body, _ = get("/", "GB")
text = visible(body)
check("£" in text and not DOLLAR_PRICE.search(text), "GB home: pounds, no $")

status, body, _ = get("/", "US")
text = visible(body)
check(bool(DOLLAR_PRICE.search(text)), "US home: still dollars")
check("yet, so these are" not in text, "US home: no fallback band")

status, body, _ = get("/", "CH")
text = visible(body)
check("CHF" in text and "shown in Swiss francs" in text, "CH home: Swiss francs, and it says so")

status, body, _ = get("/", "RS")
text = visible(body)
check("no reference rate for the Serbian dinar" in text and "€" in text, "RS home: stated fallback to euro")

# No country at all: a UK record keeps its pounds and its store rather than turning into dollars.
status, body, _ = get(f"/compare/{uk_swap}", None)
text = visible(body)
check("£" in text and "about $" not in text, "no country: a UK swap stays in pounds")

# First visit: no cookie yet, so the detected country has to drive the very first render.
status, body, headers = get("/", None, "en-IE,en;q=0.9")
text = visible(body)
check("sbc_country=IE" in (headers.get("Set-Cookie") or ""), "first visit with en-IE: cookie set")
check("€" in text and not DOLLAR_PRICE.search(text), "first visit with en-IE: first page already in euro")

# Anyone can read a name off a list, so test the lists for what the shopper can't buy.
for country, absent in ABSENT.items():
    for page in LIST_PAGES:
        # A finding tagged for both the UK and Germany can name chains from each, for a shopper in either.
        if page == "/why" and country in ("GB", "DE"):
            continue
        status, body, _ = get(page, country)
        text = visible(body)
        found = sorted(set(US_ONLY.findall(text) + absent.findall(text)))
        check(not found, f"{country} {page}: no US-only brand or chain absent from the country", str(found))

# The controls: the same patterns have to fire where those names belong, or a green result above means nothing.
_, body, _ = get("/", "US")
check(bool(US_ONLY.search(visible(body))), "control: the US home page does trip the US-only pattern")
status, body, _ = get("/", "GB")
check(bool(ABSENT["IE"].search(visible(body))), "control: the UK home page does trip Ireland's absent-chain pattern")
status, body, _ = get("/bulk", "DE")
check(bool(ABSENT["IE"].search(visible(body))), "control: the German bulk page does trip Ireland's absent-chain pattern")

# The filter: fewer by default, the rest behind one control that works.
status, body, _ = get("/", "IE")
text = visible(body)
shown_ie = re.search(r"(\d+)\s*swaps, each with at least two sources", text)
check("Show " in text and "swaps from other countries" in text, "IE home: the band offers the hidden swaps")
status, body, _ = get("/", "IE; sbc_others=1")
text = visible(body)
shown_all = re.search(r"(\d+)\s*swaps, each with at least two sources", text)
check(bool(shown_ie and shown_all and int(shown_all.group(1)) > int(shown_ie.group(1))), "IE with the control on: more swaps", f"{shown_ie and shown_ie.group(1)} and {shown_all and shown_all.group(1)}")
check("Hide swaps from other countries" in text, "IE with the control on: the band offers to hide them")
check(not US_ONLY.search(text), "IE with the control on: still no US-only brand", str(sorted(set(US_ONLY.findall(text)))))

# One swap lists once. An Irish and a German record of the same swap used to sit side by side.
ROOT = pathlib.Path(__file__).resolve().parents[2]
catalog = json.loads((ROOT / "src" / "generated" / "catalog.json").read_text())
twins = [(p["slug"], p["twin"]["slug"]) for p in catalog["pairs"] if p.get("twin")]
check(len(twins) >= 20, "the catalogue links its twins", str(len(twins)))


def listed_twice(body: str) -> list:
    slugs = set(re.findall(r'href="/compare/([^"?#]+)"', body))
    return [a for a, b in twins if a in slugs and b in slugs]


# Pages where a twin really renders. A German shopper's pet aisle doesn't show Irish rows at all, so it couldn't fail here.
twin_slugs = {s for pair in twins for s in pair}
for path, country in (
    ("/category/pet", "IE"),
    ("/category/pet", "GB"),
    ("/brand/royal-canin", "IE"),
    ("/brand/royal-canin", "GB"),
    ("/brand/royal-canin", None),
    ("/dupe/royal-canin-wet-cat-food", None),
    ("/dupe/royal-canin-wet-cat-food", "US"),
    ("/dupe/dulcolax-bisacodyl", "DE"),
    ("/dupe/dulcolax-bisacodyl", None),
):
    status, body, _ = get(path, country)
    check(status == 200 and not listed_twice(body), f"{path} for {country}: no swap twice", str(listed_twice(body)[:2]))
    check(bool(twin_slugs & set(re.findall(r'href="/compare/([^"?#]+)"', body))), f"{path} for {country}: the page does show a twinned swap, so this can fail")
different = len(catalog["pairs"]) - len(twins) // 2
for path in ("/how-we-verify", "/about"):
    _, body, _ = get(path, "IE")
    check(f"{different} swaps" in visible(body) and f"{len(catalog['pairs'])} swaps" not in visible(body), f"{path} counts a swap in two markets once", str(different))
check(bool(listed_twice(f'<a href="/compare/{twins[0][0]}"></a><a href="/compare/{twins[0][1]}"></a>')), "control: a page with both twins does trip the check")

ie_only, de_only = next((a, b) for a, b in twins if a.endswith("-ie") and b.endswith("-de"))
_, body, _ = get(f"/compare/{de_only}", "IE")
text = visible(body)
check("See the same swap at Irish prices" in text, "IE on the German record of a swap: points to the Irish one")
check("couldn't confirm you can buy it" not in text, "IE on the German record of a swap: doesn't say it can't be bought there")

# Unknown slugs are real 404s.
for missing in ["/brand/nope", "/ingredient/nope", "/category/nope", "/compare/nope", "/dupe/nope", "/bundle/nope", "/basket/nope"]:
    status, _, _ = get(missing, "IE")
    check(status == 404, f"{missing} answers 404", str(status))

print(f"failed {failures}")
sys.exit(1 if failures else 0)

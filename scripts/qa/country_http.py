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

# Text the server sends straight into the page, before any script. React parks streamed content in <div hidden id="S:n"> at the end
# of the body and a script moves it into place, so a shopper without scripts and a crawler that doesn't run them never see it.
def outside_hidden(body: str) -> str:
    """The HTML with every hidden streaming wrapper and script cut out."""
    out = re.sub(r"<(script|style)\b.*?</\1>", " ", body, flags=re.S | re.I)
    while True:
        start = re.search(r'<div hidden id="S:[^"]*">', out)
        if not start:
            break
        depth, i = 1, start.end()
        for tag in re.finditer(r"<(/?)div\b[^>]*>", out[i:]):
            depth += -1 if tag.group(1) else 1
            if depth == 0:
                i += tag.end()
                break
        else:
            i = len(out)
        out = out[: start.start()] + out[i:]
    return visible(out)


ABOUT_TEXT = "A price comparison site shows who sells one product for the least."
PRIVACY_H1 = re.compile(r"<h1\b[^>]*>(.*?)</h1>", re.S)
for country in ("IE", "US", None):
    _, body, _ = get("/about", country)
    check(ABOUT_TEXT in outside_hidden(body), f"/about for {country}: its text is in the HTML, outside any hidden wrapper")
    _, body, _ = get("/privacy", country)
    check(bool(PRIVACY_H1.search(body)) and len(outside_hidden(body)) > 1500, f"/privacy for {country}: its text is in the HTML, outside any hidden wrapper", str(len(outside_hidden(body))))
# The control: the shape this check exists to catch, the whole page parked in a hidden wrapper, has to fail it.
parked = f'<main><!--$?--><template id="B:0"></template><div class="min-h-[70vh]"></div><!--/$--></main><div hidden id="S:0"><div><h1>About</h1><p>{ABOUT_TEXT}</p></div></div><script>$RC("B:0","S:0")</script>'
check(ABOUT_TEXT not in outside_hidden(parked), "control: a page parked in a hidden wrapper does fail the /about check")
check(ABOUT_TEXT in visible(parked), "control: that same page still counts as visible once scripts run")

# On list and swap pages, the heading and intro don't wait for the country. Named by hand, for the same reason as US_ONLY.
for page, expected in (
    ("/", "Same job. Lower price."),
    ("/category/household", "Cheaper household"),
    ("/bulk", "A bigger pack only saves money if you use it before it goes off."),
    ("/brand/heinz", "Cheaper alternatives to Heinz"),
    ("/search", "Find it cheaper"),
    (f"/compare/{uk_swap}", " vs "),
):
    for country in ("IE", "US"):
        _, body, _ = get(page, country)
        shell = outside_hidden(body)
        check(expected in shell, f"{page} for {country}: the heading is in the HTML, outside any hidden wrapper")
        # What's outside a wrapper is the same for every country, so it can't carry a price or a list of swaps.
        main = shell[shell.find("Skip to content") :]
        check(not re.search(r"[$£€]\s?\d", main), f"{page} for {country}: no price outside a hidden wrapper", str(re.findall(r"[$£€]\s?\d", main)[:3]))
_, body, _ = get("/", "IE")
check("swaps, each with at least two sources" in visible(body) and "swaps, each with at least two sources" not in outside_hidden(body), "IE home: the count, which depends on the country, is behind its own boundary")

# ---------------------------------------------------------------------------------------------------------------------
# Every country, every kind of page: is every store link one that delivers there, is every price in the shopper's currency
# (another currency only as a marked original in brackets), and does every list hold only what can be bought there?
# The rules are written again here from data/sellers/footprint.json and markets.ts, apart from the site's code, so a fault
# in localize.ts or sellers.ts can't pass by agreeing with itself.
FOOT = json.loads((ROOT / "data" / "sellers" / "footprint.json").read_text())
SOLD: dict[str, set] = {}
for table in (FOOT["sellers"], FOOT["manual"]):
    for chain, countries in table.items():
        SOLD.setdefault(chain, set()).update(countries)
MARKETS_TS = (ROOT / "src" / "lib" / "markets.ts").read_text()
AMAZON = {m.group(1) for m in re.finditer(r'^\s+([A-Z]{2}): \{ name: "[^"]+",? *(?:amazon:|\.\.\.EU_VIA_DE)', MARKETS_TS, re.M)}
check({"US", "GB", "DE", "AT", "AU"} <= AMAZON and "RS" not in AMAZON, "the audit reads the Amazon storefronts from markets.ts", str(sorted(AMAZON)))
CURRENCY = {"US": "USD", "CA": "CAD", "GB": "GBP", "IE": "EUR", "DE": "EUR", "AT": "EUR", "FR": "EUR", "NL": "EUR", "HR": "EUR", "CH": "CHF", "PL": "PLN", "AU": "AUD"}
MARKET_CURRENCY = {"US": "USD", "CA": "CAD", "GB": "GBP", "DE": "EUR", "IE": "EUR"}
PRICE = {
    "USD": r"(?<![A-Za-z])\$\s?\d",
    "CAD": r"CA\$\s?\d",
    "GBP": r"£\s?\d",
    "EUR": r"€\s?\d",
    "CHF": r"CHF\s?\d",
    "PLN": r"PLN\s?\d",
    "AUD": r"(?<![A-Za-z])A\$\s?\d",
}


def links_store(seller: str, market: str, country: str) -> bool:
    """Whether a page may link this store's listing for this shopper: its own market, Amazon (a maybe), or a delivery page naming the country."""
    return country == market or seller == "amazon" or country in FOOT.get("ships", {}).get(seller, {}).get(market, {})


def buyable(seller: str, market: str, country: str) -> bool:
    if seller == "amazon":
        return country in AMAZON
    return country in SOLD.get(seller, set()) or country in FOOT.get("ships", {}).get(seller, {}).get(market, {})


GO = {}
for p in catalog["pairs"]:
    GO[(p["slug"], "alternative")] = (p["alternative"]["retailer"], p["market"])
    GO[(p["slug"], "brand")] = (p["brand"]["retailer"], p["market"])
    if (p.get("bulkView") or {}).get("bigger"):
        GO[(p["slug"], "bigger")] = (p["bulkView"]["bigger"]["retailer"], p["market"])
for b in catalog["bundles"]:
    GO[(b["slug"], "brand")] = (b["bundle"]["retailer"], b["market"])
    for i, c in enumerate(b["components"]):
        GO[(b["slug"], f"item-{i}")] = (c["retailer"], b["market"])
RECORDS = {p["slug"]: p for p in catalog["pairs"]}


def first_of(market: str, kind: str = "pairs"):
    rows = [r for r in catalog[kind] if r["market"] == market and r.get("category") != "otc-medicine"]
    return rows[0]["slug"] if rows else None


AUDIT_PAGES = ["/", "/category/household", "/biggest-savings", "/bundles", "/bulk", "/search", "/check"]
AUDIT_PAGES += [f"/compare/{first_of(m)}" for m in ("US", "CA", "GB", "DE", "IE") if first_of(m)]
AUDIT_PAGES += [f"/bundle/{first_of(m, 'bundles')}" for m in ("US", "DE") if first_of(m, "bundles")]
AUDIT_PAGES += [f"/basket/{first_of(m, 'presets')}" for m in ("US", "GB") if first_of(m, "presets")]
LISTS = {"/", "/category/household", "/biggest-savings", "/bulk"}
for country in ["US", "CA", "GB", "IE", "DE", "AT", "CH", "FR", "NL", "PL", "HR", "AU", None]:
    for page in AUDIT_PAGES:
        status, body, _ = get(page, country)
        name = f"audit {country or 'unknown'} {page}"
        if status != 200:
            check(False, f"{name}: opens", str(status))
            continue
        if not country:
            continue
        bad_go = []
        for slug, side in set(re.findall(r'href="/go/([^/"]+)/([a-z0-9-]+)"', body)):
            retailer, market = GO.get((slug, side), ("?", "?"))
            if not links_store(retailer, market, country):
                bad_go.append(f"{slug}/{side} ({retailer}, {market})")
        check(not bad_go, f"{name}: every store link delivers there", str(bad_go[:3]))
        wrong_c = [c for c in re.findall(r"/out\?s=[^&\"]+&amp;c=([A-Z]{2})", body) if c != country]
        check(not wrong_c, f"{name}: every store search is for this country", str(wrong_c[:3]))
        # The tab title is static metadata, the same for every country, and names the record's own currency on purpose.
        text = visible(re.sub(r"<title>.*?</title>", " ", body, flags=re.S))
        own = CURRENCY[country]
        # Known and owned elsewhere (bundle page, 13 Nov 2026): a kit's "also comes with" extras print the record's raw
        # prices. Reported on each run so it isn't forgotten, and kept out of the count so the rest can still fail.
        for extra in re.findall(r"The kit also comes with: .*?(?= How we checked)", text):
            if any(re.search(PRICE[c], extra) for c in PRICE if c != own):
                print("KNOWN", f"{name}: kit extras not converted", extra[:120])
        text = re.sub(r"The kit also comes with: .*?(?= How we checked)", " ", text)
        bare = re.sub(r"\([^()]*\)", " ", text)  # A marked original sits in brackets beside the converted price.
        bare = re.sub(r"Converted at the ECB rate of [^.]*?\d{4}, [^,]+, so treat them as approximate\.", " ", bare)  # The band's rate.
        foreign = [c for c in PRICE if c != own and re.search(PRICE[c], bare)]
        # A swap page's evidence quotes its sources in their own words; the offers and shelf above it are what's checked there.
        if page.startswith("/compare/") and "Prices checked" in bare:
            bare = bare[: bare.find("Does the same job") if "Does the same job" in bare else None]
            foreign = [c for c in PRICE if c != own and re.search(PRICE[c], bare[: bare.find("What differs")] if "What differs" in bare else bare)]
        check(not foreign, f"{name}: prices in {own} only, others only as a marked original", str([re.findall(PRICE[c], bare)[:2] for c in foreign]))
        # A currency no record is priced in can only ever be a conversion, so every such price must read "about".
        if own not in MARKET_CURRENCY.values():
            # "about CHF 0.15 vs CHF 0.31 per wash" marks both, so "about" may sit earlier in the same phrase, not past a full stop.
            unmarked = [m.group(0) for m in re.finditer(PRICE[own], bare) if not re.search(r"\babout\b(?:(?!\. ).){0,70}$", bare[max(0, m.start() - 80) : m.start()], re.I)]
            check(not unmarked, f"{name}: every {own} price reads about", str(unmarked[:3]))
        if page in LISTS:
            listed = {s for s in re.findall(r'href="/compare/([^"?#]+)"', body) if s in RECORDS}
            # Canada's and Australia's home pages once showed an empty "Biggest savings": their listed swaps have no photos.
            # Aisle lists fill in on the client past the first screen, so only the home page is counted here.
            if page == "/":
                check(len(listed) >= 4, f"{name}: the home page shows swaps", str(len(listed)))
            cannot = [s for s in listed if RECORDS[s]["market"] != country and not all(buyable(x, RECORDS[s]["market"], country) for x in RECORDS[s]["sellers"])]
            check(not cannot, f"{name}: lists nothing that can't be bought there", str(cannot[:3]))

# The controls for the audit: each part has to fire on a page where it should, or the passes above mean nothing.
_, body, _ = get("/category/household", "US")
us_listed = {s for s in re.findall(r'href="/compare/([^"?#]+)"', body) if s in RECORDS}
check(any(not all(buyable(x, RECORDS[s]["market"], "CA") for x in RECORDS[s]["sellers"]) for s in us_listed), "control: the US household list, judged for Canada, does list what can't be bought there")
us_go = set(re.findall(r'href="/go/([^/"]+)/([a-z0-9-]+)"', get(f"/compare/{first_of('US')}", "US")[1]))
check(any(not links_store(*GO[g], "CA") for g in us_go if g in GO), "control: a US swap page's store links, judged for Canada, do fail")
check(bool(re.search(PRICE["GBP"], re.sub(r"\([^()]*\)", " ", "about €5.26 (£4.39), or £3"))), "control: a bare foreign price outside brackets is caught")
check(not re.search(r"\babout\b(?:(?!\. ).){0,70}$", "Costs ", re.I), "control: a CHF price with no about before it is caught")

# Canada: its own records lead, US ones only where the store sells in Canada, and the rest behind the control, in CA$ and "about".
_, body, _ = get("/", "CA")
text = visible(body)
check("only a few swaps in Canada" in text and "Show " in text and "swaps from other countries" in text, "CA home: the band says whose prices these are and offers the US ones")
check(not US_ONLY.search(text), "CA home: no US-only brand by default", str(sorted(set(US_ONLY.findall(text)))))
_, body, _ = get("/category/household", "CA; sbc_others=1")
text = visible(body)
check(bool(US_ONLY.search(text)), "CA with the control on: the US records come back, so the check above can fail")
check(bool(re.search(r"about\s*CA\$\d", text)), "CA with the control on: US prices read about CA$")
walmart_us = next((p["slug"] for p in catalog["pairs"] if p["market"] == "US" and p["alternative"]["retailer"] == "walmart"), None)
_, body, _ = get(f"/compare/{walmart_us}", "CA")
text = visible(body)
check(f'href="/go/{walmart_us}/alternative"' not in body, "CA on a Walmart.com swap: no link to a store that doesn't ship to Canada")
check("walmart.ca" in text and "Search Walmart.ca" in text, "CA on a Walmart.com swap: points to Walmart's Canadian site and its search")
check("couldn't confirm you can buy it in Canada" in text, "CA on a Walmart.com swap: says it isn't in Canada's lists")
# Austria: a German pharmacy that delivers there is linked, with Austria's delivery, not Germany's.
aponeo = next((p["slug"] for p in catalog["pairs"] if p["market"] == "DE" and p["alternative"]["retailer"] == "aponeo"), None)
_, body, _ = get(f"/compare/{aponeo}", "AT")
text = visible(body)
check(f'href="/go/{aponeo}/alternative"' in body, "AT on an aponeo swap: the store is linked, it delivers to Austria")
check("Delivery to Austria" in text and "free over €29.99" not in text, "AT on an aponeo swap: Austria's delivery, never Germany's free line")
_, body, _ = get(f"/compare/{aponeo}", "CH")
check(f'href="/go/{aponeo}/alternative"' not in body, "CH on an aponeo swap: no link, it doesn't deliver to Switzerland")

# Unknown slugs are real 404s.
for missing in ["/brand/nope", "/ingredient/nope", "/category/nope", "/compare/nope", "/dupe/nope", "/bundle/nope", "/basket/nope"]:
    status, _, _ = get(missing, "IE")
    check(status == 404, f"{missing} answers 404", str(status))

print(f"failed {failures}")
sys.exit(1 if failures else 0)

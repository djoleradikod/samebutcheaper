#!/usr/bin/env python3
"""What a shopper in each country gets from the server, before any script runs.

Usage: python3 -I scripts/qa/country_http.py http://127.0.0.1:8851

Checks the visible text of each page (scripts and styles removed) and the whole response for a dollar
price or a US store. Exits 1 if anything fails. Needs no browser, so it doesn't wait for the lane.
"""
import html
import json
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


US_STORES = re.compile(r"\b(walmart|target\.com|costco|walgreens|cvs|kroger|safeway)\b", re.I)
DOLLAR_PRICE = re.compile(r"(?<![A-Za-z])\$\s?\d")
# In the raw response, React's own references read "$2": a quote before the $ means it isn't a price.
RAW_DOLLAR_PRICE = re.compile(r"(?<![\"\\\w])\$\s?\d")
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
check("prices in Ireland yet" in text, "IE home: the band says these aren't Irish prices")
check("UK prices, shown in euro" in text, "IE home: the band names the market and the currency")
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

print(f"failed {failures}")
sys.exit(1 if failures else 0)

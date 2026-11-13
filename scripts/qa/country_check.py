#!/usr/bin/env python3
"""The country rules in a real browser: IE, DE, GB, US and HR, plus the picker changing country on the page.

Usage, in the lane: <playwright venv python> -I scripts/qa/country_check.py http://127.0.0.1:8851
Exits 1 if anything fails.
"""
import json
import re
import sys
import urllib.request

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/")
HOST = re.sub(r"^https?://", "", BASE).split(":")[0]
DOLLAR_PRICE = re.compile(r"(?<![A-Za-z])\$\s?\d")
US_STORES = re.compile(r"\b(walmart|target\.com|costco|walgreens|cvs|kroger|safeway)\b", re.I)
# Both tables are written by hand, apart from the site's own rules, so they can disagree with them. Same list as country_http.py.
US_ONLY = re.compile(r"\b(Charmin|Kirkland|Equate|Jif|Parent's Choice|Great Value [A-Z]\w+|Member's Mark|(?i:up&up)|Signature Select|Good & Gather|Market Pantry|Lucerne|Uline|Bounty|Target)\b")
ABSENT = {
    "IE": re.compile(r"\b(Sainsbury's|Asda|Morrisons|Waitrose|Ocado|Co-op|Crocus|7dayshop|Toolstation|Kaufland|Rewe|REWE|Edeka|EDEKA|Netto|Penny|Rossmann|myTime|Jeden Tag|Pollin|Alternate)\b"),
}
failures = 0


def check(ok, name, detail=""):
    global failures
    print("PASS" if ok else "FAIL", name, "" if ok else detail)
    if not ok:
        failures += 1


index = json.loads(urllib.request.urlopen(BASE + "/search/index.json", timeout=60).read())
uk_swap = next(p["slug"] for p in index["pairs"] if p["market"] == "GB" and p["category"] != "otc-medicine")
PAGES = ["/", "/category/household", f"/compare/{uk_swap}", "/bulk"]
# What each country's pages must show, and whether a $ price may appear.
# Canada once listed every US record; now only those whose store sells there, so its lists carry no US-only brand either.
EXPECT = {"IE": ("€", False), "DE": ("€", False), "GB": ("£", False), "HR": ("€", False), "CA": ("CA$", False), "US": ("$", True)}
# Small amounts read "37 ct" or "37p" with no symbol, and a list can be nothing but those.
SHOWS = {"CA$": re.compile(r"CA\$|\d(?:\.\d)?¢"), "€": re.compile(r"€|\d ct\b"), "£": re.compile(r"£|\d(?:\.\d)?p\b"), "$": re.compile(r"\$|\d(?:\.\d)?¢")}

with sync_playwright() as p:
    browser = p.chromium.launch()
    for country, (symbol, dollars_ok) in EXPECT.items():
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        ctx.add_cookies([{"name": "sbc_country", "value": country, "domain": HOST, "path": "/"}])
        page = ctx.new_page()
        for path in PAGES:
            if country == "US" and path.startswith("/compare/"):
                continue  # A UK swap in the US converts to dollars; the unit tests cover that.
            page.goto(BASE + path, wait_until="networkidle", timeout=60000)
            text = page.inner_text("body")
            check(bool(SHOWS[symbol].search(text)), f"{country} {path}: shows {symbol}", text[:200])
            if not dollars_ok:
                check(not DOLLAR_PRICE.search(text), f"{country} {path}: no $", str(DOLLAR_PRICE.findall(text)[:3]))
                found = US_STORES.findall(text)
                check(not found, f"{country} {path}: no US store", str(sorted(set(found))))
                if path != f"/compare/{uk_swap}":  # A swap page can cite other chains as evidence.
                    names = US_ONLY.findall(text) + (ABSENT[country].findall(text) if country in ABSENT else [])
                    check(not names, f"{country} {path}: no US-only brand or absent chain", str(sorted(set(names))))
        ctx.close()

    # The picker: no reload by hand, and the page follows.
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    ctx.add_cookies([{"name": "sbc_country", "value": "US", "domain": HOST, "path": "/"}])
    page = ctx.new_page()
    page.goto(BASE + "/", wait_until="networkidle", timeout=60000)
    check(bool(DOLLAR_PRICE.search(page.inner_text("main"))), "picker: starts on $ for the US")
    page.locator('select[aria-label="Country you shop in"]').first.select_option("IE")
    # The band and prices change at once in the browser. Lists and stores arrive with the server's answer, so wait for the page to stop updating.
    page.wait_for_function("document.querySelector('main').innerText.includes('started checking prices in Ireland')", timeout=30000)
    page.wait_for_function("!document.documentElement.hasAttribute('data-updating')", timeout=30000)
    text = page.inner_text("main")
    check("€" in text and not DOLLAR_PRICE.search(text), "picker: Ireland changes the page to euro with no $", str(DOLLAR_PRICE.findall(text)[:3]))
    check(not US_STORES.search(text), "picker: no US store after the change", str(sorted(set(US_STORES.findall(text)))))
    found = US_ONLY.findall(text) + ABSENT["IE"].findall(text)
    check(not found, "picker: no US-only brand or chain absent from Ireland after the change", str(sorted(set(found))))
    ctx.close()

    # Back: router.refresh() only clears the current route, so a page kept from before the change must still catch up.
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    ctx.add_cookies([{"name": "sbc_country", "value": "US", "domain": HOST, "path": "/"}])
    page = ctx.new_page()
    page.goto(BASE + "/category/household", wait_until="networkidle", timeout=60000)
    check(bool(US_ONLY.search(page.inner_text("main"))), "back: starts on a list with US products")
    page.locator('main a[href^="/compare/"]').first.click()
    page.wait_for_url("**/compare/**", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.locator('select[aria-label="Country you shop in"]').first.select_option("IE")
    page.wait_for_function("document.querySelector('main').innerText.includes('started checking prices in Ireland')", timeout=30000)
    page.wait_for_function("!document.documentElement.hasAttribute('data-updating')", timeout=30000)
    page.go_back()
    page.wait_for_url("**/category/household", timeout=30000)
    page.wait_for_timeout(300)
    page.wait_for_function("!document.documentElement.hasAttribute('data-updating')", timeout=30000)
    text = page.inner_text("main")
    found = US_ONLY.findall(text) + US_STORES.findall(text)
    check(not found, "back: the kept list has caught up with Ireland", str(sorted(set(found))))
    check(not DOLLAR_PRICE.search(text), "back: no $ on the kept list", str(DOLLAR_PRICE.findall(text)[:3]))
    ctx.close()

    # The band streams in after the first paint. Its space has to be held, or a fallback country's whole page jumps.
    SHIFT = "() => new Promise(r => { let c = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) c += e.value; }).observe({type:'layout-shift', buffered:true}); setTimeout(() => r(c), 2500); })"
    NO_RESERVE = "const s = Element.prototype.setAttribute; Element.prototype.setAttribute = function (a, b) { if (a !== 'data-band') s.call(this, a, b); };"

    def layout_shift(path, width, reserve=True):
        ctx = browser.new_context(viewport={"width": width, "height": 900})
        ctx.add_cookies([{"name": "sbc_country", "value": "IE", "url": BASE}])
        if not reserve:
            ctx.add_init_script(NO_RESERVE)
        page = ctx.new_page()
        page.goto(BASE + path, wait_until="domcontentloaded", timeout=60000)
        value = page.evaluate(SHIFT)
        ctx.close()
        return value

    for path, width in (("/", 1280), ("/", 390), ("/category/pet", 390), ("/about", 390)):
        value = layout_shift(path, width)
        check(value < 0.1, f"IE {path} at {width}: the band doesn't push the page down", str(round(value, 4)))
    value = layout_shift("/", 1280, reserve=False)
    check(value > 0.03, "control: without the held space, Ireland's home page does jump", str(round(value, 4)))
    browser.close()

print(f"failed {failures}")
sys.exit(1 if failures else 0)

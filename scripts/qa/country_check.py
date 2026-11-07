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
EXPECT = {"IE": ("€", False), "DE": ("€", False), "GB": ("£", False), "HR": ("€", False), "US": ("$", True)}

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
            check(symbol in text, f"{country} {path}: shows {symbol}")
            if not dollars_ok:
                check(not DOLLAR_PRICE.search(text), f"{country} {path}: no $", str(DOLLAR_PRICE.findall(text)[:3]))
                found = US_STORES.findall(text)
                check(not found, f"{country} {path}: no US store", str(sorted(set(found))))
        ctx.close()

    # The picker: no reload by hand, and the page follows.
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    ctx.add_cookies([{"name": "sbc_country", "value": "US", "domain": HOST, "path": "/"}])
    page = ctx.new_page()
    page.goto(BASE + "/", wait_until="networkidle", timeout=60000)
    check(bool(DOLLAR_PRICE.search(page.inner_text("main"))), "picker: starts on $ for the US")
    page.locator('select[aria-label="Country you shop in"]').first.select_option("IE")
    page.wait_for_function("document.querySelector('main').innerText.includes('prices in Ireland yet')", timeout=30000)
    page.wait_for_load_state("networkidle")
    text = page.inner_text("main")
    check("€" in text and not DOLLAR_PRICE.search(text), "picker: Ireland changes the page to euro with no $", str(DOLLAR_PRICE.findall(text)[:3]))
    check(not US_STORES.search(text), "picker: no US store after the change")
    ctx.close()
    browser.close()

print(f"failed {failures}")
sys.exit(1 if failures else 0)

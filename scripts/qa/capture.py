"""Blind-ready screenshots for the gauntlet critics.

Usage (always through the lane, one browser job at a time):
  python -I capture.py bar  <out-dir>                  # idealo, geizhals, camelcamelcamel
  python -I capture.py ours <out-dir> <base-url> [path ...]

Every shot has site names and logos removed in the page itself, the same way for us and
for the bar, so a critic can't tell whose page is whose from the labels.
Files: <out>/<site>-<page>-<desktop|phone>.jpg (first screen) and -full.jpg (capped height).
"""
import json
import os
import re
import sys
import time
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

UA_DESKTOP = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)
FULL_MAX = 4200

REDACT = r"""
() => {
  const names = /idealo|geizhals|camel\s*camel\s*camel|same\s*but\s*cheaper|preisvergleich\.de|heise/gi;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) if (names.test(n.nodeValue)) { names.lastIndex = 0; n.nodeValue = n.nodeValue.replace(names, '████'); }
  const logos = '[data-logo],[class*="logo" i],[id*="logo" i],header a[href="/"] img,header a[href="/"] svg,a[href="/"] > svg,a[href="/"] > img,img[alt*="idealo" i],img[alt*="geizhals" i],img[alt*="camel" i],img[src*="logo" i],a[aria-label*="idealo" i],a[aria-label*="geizhals" i]';
  for (const el of document.querySelectorAll(logos)) {
    const box = el.getBoundingClientRect();
    if (box.height > 140) continue;        // a brand strip or hero, not a logo mark
    if (box.width > 0 && box.top > 200 && !el.closest('header,footer,nav')) continue;
    el.style.visibility = 'hidden';
  }
  document.title = 'page';
}
"""

CONSENT_TEXT = re.compile(
    r"^(alle akzeptieren|akzeptieren|alles akzeptieren|zustimmen|einverstanden|accept all|accept|agree|i agree|got it|ok)$",
    re.I,
)

KILL_OVERLAYS = r"""
() => {
  const q = '[id^="sp_message"],[class*="sp_message" i],#onetrust-consent-sdk,#usercentrics-root,[id*="cookie" i],[class*="cookie-banner" i],[class*="consent" i],[id*="consent" i]';
  for (const el of document.querySelectorAll(q)) el.remove();
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
}
"""


def accept_consent(page):
    frames = list(page.frames)
    for frame in frames:
        try:
            for b in frame.get_by_role("button", name=CONSENT_TEXT).all()[:3]:
                if b.is_visible():
                    b.click(timeout=2500)
                    page.wait_for_timeout(700)
                    return True
        except Exception:
            pass
    return False


def goto(page, url):
    last = None
    for attempt in range(3):  # the ISP NAT refuses about a third of new connections
        try:
            r = page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1800)
            return r.status if r else 0
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 + attempt * 3)
    print("FAILED", url, str(last)[:200], flush=True)
    return -1


def settle(page):
    accept_consent(page)
    page.evaluate(KILL_OVERLAYS)
    page.evaluate(
        """async () => {
          const h = Math.min(document.body.scrollHeight, 4200);
          for (let y = 0; y < h; y += 600) { window.scrollTo({top: y, behavior: 'instant'}); await new Promise(r => setTimeout(r, 90)); }
          window.scrollTo({top: 0, behavior: 'instant'});
          await new Promise(r => setTimeout(r, 500));
        }"""
    )
    page.evaluate(REDACT)


def shoot(page, out, name):
    settle(page)
    first = os.path.join(out, f"{name}.jpg")
    page.screenshot(path=first, type="jpeg", quality=80)
    size = page.viewport_size
    height = min(page.evaluate("document.documentElement.scrollHeight"), FULL_MAX)
    full = os.path.join(out, f"{name}-full.jpg")
    page.screenshot(
        path=full,
        type="jpeg",
        quality=72,
        full_page=True,
        clip={"x": 0, "y": 0, "width": size["width"], "height": height},
    )
    return first


def first_link(page, selector, pattern=None):
    for href in page.eval_on_selector_all(selector, "els => els.map(e => e.getAttribute('href'))"):
        if href and (pattern is None or re.search(pattern, href)):
            return urljoin(page.url, href)
    return None


def discover(page):
    """Find one category page and one product page on each bar site by following its own links."""
    urls = {}
    goto(page, "https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=waschmittel")
    accept_consent(page)
    idealo_product = first_link(page, 'a[href*="/preisvergleich/OffersOfProduct/"]')
    urls["idealo"] = {
        "home": "https://www.idealo.de/",
        "category": "https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=waschmittel",
        "product": idealo_product,
    }
    goto(page, "https://geizhals.eu/?fs=batterie+aa")
    accept_consent(page)
    gh_product = first_link(page, "a[href]", r"-a\d+\.html")
    urls["geizhals"] = {
        "home": "https://geizhals.eu/",
        "category": "https://geizhals.eu/?fs=batterie+aa",
        "product": gh_product,
    }
    goto(page, "https://camelcamelcamel.com/popular")
    accept_consent(page)
    camel_product = first_link(page, 'a[href*="/product/"]')
    urls["camelcamelcamel"] = {
        "home": "https://camelcamelcamel.com/",
        "category": "https://camelcamelcamel.com/popular",
        "product": camel_product,
    }
    return urls


def contexts(p):
    desktop = dict(viewport={"width": 1440, "height": 900}, device_scale_factor=1, user_agent=UA_DESKTOP, locale="en-GB")
    phone = {**p.devices["iPhone 13"], "locale": "en-GB"}
    return {"desktop": desktop, "phone": phone}


def run_bar(out):
    os.makedirs(out, exist_ok=True)
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctxs = contexts(p)
        d = browser.new_context(**ctxs["desktop"])
        urls = discover(d.new_page())
        d.close()
        json.dump(urls, open(os.path.join(out, "urls.json"), "w"), indent=1)
        for vp, cfg in ctxs.items():
            ctx = browser.new_context(**cfg)
            for site, pages in urls.items():
                page = ctx.new_page()
                for name, url in pages.items():
                    if not url:
                        results[f"{site}-{name}-{vp}"] = "no url found"
                        continue
                    status = goto(page, url)
                    title = page.title()
                    shoot(page, out, f"{site}-{name}-{vp}")
                    results[f"{site}-{name}-{vp}"] = {"status": status, "title": title[:80], "url": page.url[:160]}
                    print(site, name, vp, status, title[:60], flush=True)
                page.close()
            ctx.close()
        browser.close()
    json.dump(results, open(os.path.join(out, "report.json"), "w"), indent=1)


def run_ours(out, base, paths):
    os.makedirs(out, exist_ok=True)
    with sync_playwright() as p:
        # Hinting on headless Linux spaces glyphs unevenly ("wit h"), which no phone or desktop browser does.
        browser = p.chromium.launch(headless=True, args=["--font-render-hinting=none"])
        for vp, cfg in contexts(p).items():
            ctx = browser.new_context(**cfg)
            page = ctx.new_page()
            for spec in paths:
                name, path = spec.split("=", 1) if "=" in spec else (re.sub(r"\W+", "-", spec).strip("-") or "home", spec)
                status = goto(page, base + path)
                shoot(page, out, f"ours-{name}-{vp}")
                print(name, vp, status, flush=True)
            ctx.close()
        browser.close()


if __name__ == "__main__":
    mode, out = sys.argv[1], sys.argv[2]
    if mode == "bar":
        run_bar(out)
    else:
        run_ours(out, sys.argv[3], sys.argv[4:])

"""Checks in a real browser what server-rendered pages can't show: the basket's store split following the stepper, and the /bulk filter and sort.
Usage: <playwright venv python> -I scripts/qa/interact_check.py http://127.0.0.1:8851
Prints PASS or FAIL per check and exits 1 if any fail. Reads only; it saves nothing to a list and fills in no forms."""
import re
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/")
failed = 0


def check(name, ok, detail=""):
    global failed
    print(("PASS" if ok else "FAIL"), name, detail)
    if not ok:
        failed += 1


def pounds(text):
    return [float(x) for x in re.findall(r"£(\d+\.\d\d)", text)]


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    # Basket: drop one line to zero. The split has to lose that amount, and still add up to the total above it.
    page.goto(f"{BASE}/basket/weekly-staples-gb", wait_until="networkidle")
    split = page.locator("text=/The cheaper side (takes|is all from)/").first.locator("xpath=ancestor::div[1]")
    before = split.inner_text()
    amounts = pounds(before)
    check("store split shows five stores on load", "takes 5 stores" in before, before.replace("\n", " ")[:120])
    fewer = page.get_by_role("button", name=re.compile("One pack fewer of"))
    first = fewer.first
    label = first.get_attribute("aria-label")
    guard = 0
    while first.is_enabled() and guard < 12:
        first.click()
        page.wait_for_timeout(120)
        guard += 1
    page.wait_for_timeout(300)
    after = split.inner_text()
    now = pounds(after)
    check("store split changes when a line goes to zero", abs(sum(now) - sum(amounts)) > 0.005, f"{label}: {sum(amounts):.2f} to {sum(now):.2f}")
    totals = page.get_by_text("Cheaper swaps").first.locator("xpath=ancestor::div[2]").inner_text()
    big = pounds(totals)
    check("split adds up to the total above it", any(abs(sum(now) - x) <= 0.03 for x in big), f"split {sum(now):.2f}, totals {big}")

    # Bulk: the UK list, filter by aisle, then sort by pack price within one currency.
    page.goto(f"{BASE}/bulk", wait_until="networkidle")
    page.get_by_role("radio", name=re.compile(r"^UK")).check()
    page.wait_for_timeout(200)
    aisle = page.get_by_label("Aisle", exact=True)
    order = page.get_by_label("Sort by", exact=True)
    count = lambda: page.locator("p[aria-live=polite]").first.inner_text()
    all_text = count()
    options = aisle.locator("option").all_inner_texts()
    check("aisle filter lists aisles", len(options) > 2, str(options))
    aisle.select_option(index=1)
    page.wait_for_timeout(200)
    one = count()
    check("aisle filter narrows the list", one != all_text, f"{all_text[:32]} to {one[:32]}")
    aisle.select_option("all")
    order.select_option("pack")
    page.wait_for_timeout(300)
    # Every group shows photo rows, then text rows, each in the chosen order. Read the text rows of each group.
    sorted_ok = True
    seen = 0
    for table in page.locator("div.card:has(ul.divide-y)").all():
        vals = []
        for row in table.locator("li").all():
            text = row.inner_text()
            m = re.search(r"(\d[\d,]*(?:\.\d+)?) ?[a-z ]*, £(\d[\d,]*(?:\.\d\d)?)", text) or re.search(r", £(\d[\d,]*(?:\.\d\d)?)", text)
            if m:
                vals.append(float(m.groups()[-1].replace(",", "")))
        seen += len(vals)
        if vals != sorted(vals):
            sorted_ok = False
            print("   out of order", vals)
    check("lowest pack price sorts rows ascending", sorted_ok and seen > 0, f"{seen} rows read")

    # A shopper on a phone: the store link stays its own target above the stretched row link.
    link = page.get_by_role("link", name=re.compile(r"^(at|on) ")).first
    href = link.get_attribute("href") or ""
    check("store link goes to a store, not the swap page", href.startswith("http") and "/compare/" not in href, href[:70])
    box = link.bounding_box()
    hit = page.evaluate("([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + ' ' + (e.textContent || '').slice(0, 24) : '' }", [box["x"] + box["width"] / 2, box["y"] + box["height"] / 2])
    check("store link is on top of the row link", hit.startswith("A ") and hit[2:].startswith(("at ", "on ")), hit)
    browser.close()

print("failed", failed)
sys.exit(1 if failed else 0)

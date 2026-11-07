"""LCP on a phone profile (Lighthouse's mobile throttling: 4x CPU, 150 ms RTT, 1.6 Mbps down).

Usage (through the lane): python -I lcp.py <base-url> <path> [<path> ...]
Prints one line per page: median LCP of 3 cold loads, the LCP element, bytes transferred.
"""
import statistics
import sys

from playwright.sync_api import sync_playwright

OBSERVE = """
() => {
  window.__lcp = null;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      const el = e.element;
      window.__lcp = { t: e.startTime, tag: el ? el.tagName : '?', src: e.url || '', text: el ? (el.innerText || '').slice(0, 50) : '' };
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });
}
"""


def measure(browser, device, url):
    ctx = browser.new_context(**device)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    cdp.send("Network.enable")
    cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
    cdp.send(
        "Network.emulateNetworkConditions",
        {"offline": False, "latency": 150, "downloadThroughput": 1.6 * 1024 * 1024 / 8, "uploadThroughput": 750 * 1024 / 8},
    )
    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    bytes_in = {"n": 0}
    cdp.on("Network.loadingFinished", lambda e: bytes_in.__setitem__("n", bytes_in["n"] + e.get("encodedDataLength", 0)))
    page.add_init_script("(" + OBSERVE + ")()")
    page.goto(url, wait_until="load", timeout=90000)
    page.wait_for_timeout(2500)
    lcp = page.evaluate("window.__lcp")
    ctx.close()
    return lcp, bytes_in["n"]


def main():
    base, paths = sys.argv[1], sys.argv[2:]
    worst = 0.0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        device = p.devices["Moto G4"] if "Moto G4" in p.devices else p.devices["Pixel 5"]
        for path in paths:
            runs = [measure(browser, device, base + path) for _ in range(3)]
            times = [r[0]["t"] for r in runs if r[0]]
            med = statistics.median(times) if times else float("nan")
            worst = max(worst, med)
            last = runs[-1][0] or {}
            print(f"{path}\tLCP {med/1000:.2f}s\t{last.get('tag')}\t{(last.get('src') or last.get('text') or '')[:70]}\t{runs[-1][1]/1024:.0f} KB", flush=True)
        browser.close()
    print(f"worst median LCP {worst/1000:.2f}s (target under 2.50s)")


if __name__ == "__main__":
    main()

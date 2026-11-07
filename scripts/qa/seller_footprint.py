#!/usr/bin/env python3
"""Which chains sell in which country: open each chain's national site and keep what it says, for data/sellers/footprint.json.

A country counts only when its national site opens, stays on that country's address and names the chain in its title. A site
that refuses automated requests isn't counted: only a "manual" entry in that file, with its source, can carry it. Rewrites
"sellers", "refused" and "checked" and leaves "manual" alone, so read the diff: python3 -I scripts/qa/seller_footprint.py
"""
import concurrent.futures
import datetime
import html
import json
import pathlib
import re
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

# chain: (name that must show in the page title, {country: national site}).
# Marks & Spencer stays out: its terms bar crawling without written consent. Its one check is kept as a manual entry in the data file.
CHAINS = {
    "lidl": (r"lidl", {
        "IE": "https://www.lidl.ie/", "GB": "https://www.lidl.co.uk/", "DE": "https://www.lidl.de/", "US": "https://www.lidl.com/",
        "AT": "https://www.lidl.at/", "CH": "https://www.lidl.ch/", "FR": "https://www.lidl.fr/", "BE": "https://www.lidl.be/",
        "NL": "https://www.lidl.nl/", "LU": "https://www.lidl.lu/", "IT": "https://www.lidl.it/", "ES": "https://www.lidl.es/",
        "PT": "https://www.lidl.pt/", "SE": "https://www.lidl.se/", "PL": "https://www.lidl.pl/", "DK": "https://www.lidl.dk/",
        "FI": "https://www.lidl.fi/", "CZ": "https://www.lidl.cz/", "SK": "https://www.lidl.sk/", "HU": "https://www.lidl.hu/",
        "SI": "https://www.lidl.si/", "HR": "https://www.lidl.hr/", "RO": "https://www.lidl.ro/", "BG": "https://www.lidl.bg/",
        "GR": "https://www.lidl-hellas.gr/", "RS": "https://www.lidl.rs/",
    }),
    "aldi": (r"aldi|hofer", {
        "IE": "https://www.aldi.ie/", "GB": "https://www.aldi.co.uk/", "DE": "https://www.aldi-sued.de/", "US": "https://www.aldi.us/",
        "AT": "https://www.hofer.at/", "CH": "https://www.aldi-suisse.ch/", "FR": "https://www.aldi.fr/", "BE": "https://www.aldi.be/",
        "NL": "https://www.aldi.nl/", "LU": "https://www.aldi.lu/", "IT": "https://www.aldi.it/", "ES": "https://www.aldi.es/",
        "PT": "https://www.aldi.pt/", "PL": "https://www.aldi.pl/", "SI": "https://www.hofer.si/", "HU": "https://www.aldi.hu/",
    }),
    "ikea": (r"ikea", {
        c: f"https://www.ikea.com/{c.lower()}/" for c in ["IE", "GB", "DE", "US", "CA", "AT", "CH", "FR", "BE", "NL", "IT", "ES", "PT", "SE", "PL", "DK", "FI", "NO", "CZ", "SK", "HU", "SI", "HR", "RO", "BG", "GR", "RS", "TR", "IL", "IN", "JP", "SG", "PH", "MY", "AU", "MX", "SA", "AE", "UA"]
    }),
    "zooplus": (r"zooplus", {
        "IE": "https://www.zooplus.ie/", "GB": "https://www.zooplus.co.uk/", "DE": "https://www.zooplus.de/", "AT": "https://www.zooplus.at/",
        "CH": "https://www.zooplus.ch/", "FR": "https://www.zooplus.fr/", "BE": "https://www.zooplus.be/", "NL": "https://www.zooplus.nl/",
        "IT": "https://www.zooplus.it/", "ES": "https://www.zooplus.es/", "PT": "https://www.zooplus.pt/", "SE": "https://www.zooplus.se/",
        "PL": "https://www.zooplus.pl/", "DK": "https://www.zooplus.dk/", "FI": "https://www.zooplus.fi/", "CZ": "https://www.zooplus.cz/",
        "SK": "https://www.zooplus.sk/", "HU": "https://www.zooplus.hu/", "SI": "https://www.zooplus.si/", "HR": "https://www.zooplus.hr/",
        "RO": "https://www.zooplus.ro/", "BG": "https://www.zooplus.bg/", "GR": "https://www.zooplus.gr/",
    }),
    "dm": (r"\bdm\b|drogerie", {
        "DE": "https://www.dm.de/", "AT": "https://www.dm.at/", "CZ": "https://www.dm.cz/", "SK": "https://www.dm.sk/", "HU": "https://www.dm.hu/",
        "SI": "https://www.dm.si/", "HR": "https://www.dm.hr/", "RO": "https://www.dm.ro/", "BG": "https://www.dm-drogeriemarkt.bg/", "RS": "https://www.dm.rs/",
        "BA": "https://www.dm.ba/", "MK": "https://www.dm.mk/", "IT": "https://www.dm-drogeriemarkt.it/", "PL": "https://www.dm.pl/",
    }),
    "rossmann": (r"rossmann", {
        "DE": "https://www.rossmann.de/", "PL": "https://www.rossmann.pl/", "HU": "https://www.rossmann.hu/", "CZ": "https://www.rossmann.cz/",
        "TR": "https://www.rossmann.com.tr/", "ES": "https://www.rossmann.es/", "AL": "https://www.rossmann.al/",
    }),
    "mueller": (r"m(ü|ue|u)ller", {
        "DE": "https://www.mueller.de/", "AT": "https://www.mueller.at/", "CH": "https://www.mueller.ch/", "HR": "https://www.mueller.hr/",
        "HU": "https://www.mueller.co.hu/", "SI": "https://www.mueller.si/", "ES": "https://www.mueller.es/",
    }),
    "kaufland": (r"kaufland", {
        "DE": "https://www.kaufland.de/", "PL": "https://www.kaufland.pl/", "CZ": "https://www.kaufland.cz/", "SK": "https://www.kaufland.sk/",
        "RO": "https://www.kaufland.ro/", "BG": "https://www.kaufland.bg/", "HR": "https://www.kaufland.hr/",
    }),
    "viking": (r"viking", {
        "IE": "https://www.vikingdirect.ie/", "GB": "https://www.viking-direct.co.uk/", "DE": "https://www.vikingdirekt.de/",
        "AT": "https://www.vikingdirekt.at/", "CH": "https://www.vikingdirekt.ch/", "FR": "https://www.viking-direct.fr/", "BE": "https://www.viking-direct.be/",
        "NL": "https://www.vikingdirect.nl/", "LU": "https://www.viking-direct.lu/", "IT": "https://www.viking-direct.it/",
    }),
    "shopapotheke": (r"shop.?apotheke|redcare", {
        "DE": "https://www.shop-apotheke.com/", "AT": "https://www.shop-apotheke.at/", "CH": "https://www.shop-apotheke.ch/", "IT": "https://www.redcare.it/", "FR": "https://www.redcare-pharmacie.fr/", "BE": "https://www.redcare-pharmacie.be/", "NL": "https://www.shop-apotheke.nl/",
    }),
    "alternate": (r"alternate", {"DE": "https://www.alternate.de/", "IE": "https://www.alternate.ie/", "AT": "https://www.alternate.at/", "NL": "https://www.alternate.nl/", "BE": "https://www.alternate.be/", "GB": "https://www.alternate.co.uk/", "FR": "https://www.alternate.fr/", "ES": "https://www.alternate.es/"}),
    "tesco": (r"tesco", {"GB": "https://www.tesco.com/", "IE": "https://www.tesco.ie/", "CZ": "https://www.tesco.cz/", "SK": "https://www.tesco.sk/", "HU": "https://www.tesco.hu/"}),
    "superdrug": (r"superdrug", {"GB": "https://www.superdrug.com/", "IE": "https://www.superdrug.ie/"}),
    "boots": (r"boots", {"GB": "https://www.boots.com/", "IE": "https://www.boots.ie/"}),
    "theordinary": (r"ordinary|deciem", {"GB": "https://theordinary.com/en-gb", "IE": "https://theordinary.com/en-ie", "DE": "https://theordinary.com/de-de", "US": "https://theordinary.com/en-us", "CA": "https://theordinary.com/en-ca"}),
    "lookfantastic": (r"lookfantastic", {"GB": "https://www.lookfantastic.com/", "IE": "https://www.lookfantastic.ie/", "DE": "https://www.lookfantastic.de/", "FR": "https://www.lookfantastic.fr/", "ES": "https://www.lookfantastic.es/"}),
}


def fetch(url):
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
            with urllib.request.urlopen(req, timeout=20) as r:
                raw = r.read(250_000).decode("utf-8", "replace")
                m = re.search(r"<title[^>]*>(.*?)</title>", raw, re.S | re.I)
                return r.status, r.geturl(), html.unescape(m.group(1)).strip()[:120] if m else ""
        except urllib.error.HTTPError as e:
            return e.code, url, ""
        except Exception as e:
            last = e
            # kucni's ISP refuses about a third of new connections, so a connection failure isn't an answer. See memory.
            time.sleep(1 + attempt)
    return 0, url, f"failed: {last}"[:120]


def same_place(asked, got):
    a, g = urllib.parse.urlparse(asked), urllib.parse.urlparse(got)
    def host(u):
        return u.hostname.removeprefix("www.")
    if host(a) != host(g):
        return False
    first = a.path.strip("/").split("/")[0]
    return not first or g.path.strip("/").lower().startswith(first.lower())


def one(job):
    chain, name, country, url = job
    status, final, title = fetch(url)
    ok = status == 200 and same_place(url, final) and bool(re.search(name, title, re.I))
    return chain, country, {"url": url, "status": status, "final": final, "title": title, "ok": ok}


jobs = [(chain, name, country, url) for chain, (name, sites) in CHAINS.items() for country, url in sites.items()]
FILE = pathlib.Path(__file__).resolve().parents[2] / "data" / "sellers" / "footprint.json"
data = json.loads(FILE.read_text())
data["checked"] = datetime.date.today().isoformat()
data["sellers"] = {}
data["refused"] = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for chain, country, row in pool.map(one, jobs):
        if row["ok"]:
            data["sellers"].setdefault(chain, {})[country] = row["final"]
        elif row["status"] in (401, 403, 429):
            data["refused"].setdefault(chain, []).append(country)
FILE.parent.mkdir(exist_ok=True)
FILE.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
for chain, countries in data["sellers"].items():
    print(chain, " ".join(countries))
print("refused", data["refused"])

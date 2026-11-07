#!/usr/bin/env python3
"""Turns a saved copy of the ECB's daily reference rates into data/fx/ecb-reference-rates.json.

Download first, then pass the saved file:
  curl -o /some/empty/dir/daily.xml https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml
  python3 -I scripts/fx/ecb-to-json.py /some/empty/dir/daily.xml data/fx/ecb-reference-rates.json

Rates are euro-based and published around 16:00 CET on TARGET working days. The ECB says they are for
information only, which is why every converted price on the site reads "about".
"""
import json
import re
import sys


def main(source: str, target: str) -> None:
    text = open(source, encoding="utf-8").read()
    if "European Central Bank" not in text:
        raise SystemExit("This isn't the ECB's reference rate file.")
    day = re.search(r"<Cube time='(\d{4}-\d{2}-\d{2})'>", text)
    if not day:
        raise SystemExit("No date in the file.")
    rates = {c: float(r) for c, r in re.findall(r"<Cube currency='([A-Z]{3})' rate='([0-9.]+)'/>", text)}
    if len(rates) < 20 or not all(rates.get(c, 0) > 0 for c in ("USD", "GBP", "CAD")):
        raise SystemExit(f"Too few rates, or a main one is missing: {sorted(rates)}")
    out = {
        "source": "European Central Bank, euro foreign exchange reference rates",
        "url": "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
        "file": "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
        "date": day.group(1),
        "base": "EUR",
        "rates": dict(sorted(rates.items())),
    }
    with open(target, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print(f"{day.group(1)}: {len(rates)} rates written to {target}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])

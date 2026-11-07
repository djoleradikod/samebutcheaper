"""Apply a by-eye review of contact sheets. Usage: python -I scripts/images/review.py <sheets-dir> <date> <rejected numbers, comma separated>

Every tile on the sheets not listed gets reviewed=<date>. Rejected tiles lose their record and go in
data/images-rejected.json so a later ingest doesn't bring them back (the reason a person rejected it isn't kept).
"""
import glob
import json
import os
import sys

sheets, date, rejected = sys.argv[1], sys.argv[2], {x.strip() for x in sys.argv[3].split(",") if x.strip()}
rec_path = "data/images.json"
rej_path = "data/images-rejected.json"
records = json.load(open(rec_path))
rejects = json.load(open(rej_path)) if os.path.exists(rej_path) else {}
ok = gone = 0
for path in sorted(glob.glob(os.path.join(sheets, "sheet-*.json"))):
    for num, entry in json.load(open(path)).items():
        key = entry["key"]
        if key not in records:
            continue
        if num in rejected:
            rejects[key] = rejects.get(key, []) + [entry["file"]]
            del records[key]
            gone += 1
        else:
            records[key]["reviewed"] = date
            ok += 1
json.dump(records, open(rec_path, "w"), ensure_ascii=False, indent=1)
open(rec_path, "a").write("\n")
json.dump(rejects, open(rej_path, "w"), ensure_ascii=False, indent=1)
open(rej_path, "a").write("\n")
print(f"reviewed {ok}, rejected {gone}, records now {len(records)}")

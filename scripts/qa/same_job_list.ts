/**
 * The swaps a stricter "Does the same job" rule would move to "Same kind", written out for the owner (card sbc-same-job-proof).
 * Reads the built catalogue and changes nothing.
 *
 *   npm run catalog && npx tsx scripts/qa/same_job_list.ts > docs/status/2026-11-07-same-job-proof-list.md
 *   npx tsx scripts/qa/same_job_list.ts --json out.json   # the same lists as data
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORY_MAP } from "../../src/lib/categories";
import { comparison, hasProof, RESTATES_PACK, type CompareRow, type Comparison } from "../../src/lib/compare";
import type { Pair } from "../../src/lib/types";

const catalog = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "src", "generated", "catalog.json"), "utf8")) as { pairs: Pair[] };

/** Everything hasProof counts, as rows. Pack and price say nothing about what's inside, and a researched row can only restate the pack. */
function evidenceRows(c: Comparison) {
  const rows = c.rows.filter((r) => r.kind !== "pack" && r.kind !== "price" && !(r.kind === "researched" && RESTATES_PACK.test(r.aspect.trim())));
  return [...c.ingredients, ...rows];
}

const readsSameOrBetter = (r: CompareRow) => r.verdict === "same" || r.verdict === "about_same" || r.verdict === "alt_better";
/** A spec with no amount on either side: both sides just name it, as with "Alkaline AA (LR06), 1.5 V". */
const onlyNames = (r: CompareRow) => r.brand === "Yes" && r.alternative === "Yes";

const WORDS: Partial<Record<CompareRow["verdict"], string>> = {
  same: "same",
  about_same: "about the same",
  alt_better: "cheaper one better",
  brand_better: "brand better",
  different: "different",
  check: "couldn't compare",
  unknown: "one side not stated",
  neutral: "no verdict",
};

function rowText(r: CompareRow) {
  const verdict = r.verdictLabel ?? WORDS[r.verdict] ?? r.verdict;
  return onlyNames(r) ? `${r.aspect} (named by both)` : `${r.aspect}: ${r.brand} vs ${r.alternative} (${verdict})`;
}

type Listed = { slug: string; aisle: string; market: string; brand: string; alternative: string; saving: number; rows: string[]; community: boolean };

function listed(p: Pair, c: Comparison, rows: CompareRow[]): Listed {
  return {
    slug: p.slug,
    aisle: CATEGORY_MAP[p.category].name,
    market: p.market,
    brand: `${p.brand.brand}: ${p.brand.product}`,
    alternative: `${p.alternative.brand}: ${p.alternative.product}`,
    saving: Math.round(p.savingsPct),
    rows: rows.map(rowText),
    community: !!c.nutrition,
  };
}

/** List A, as the card counted it: no test result, no community record, and no row that reads same or better. */
const noneSameOrBetter: Listed[] = [];
/** The same, except a test result or community record is on file. A strict reading of the rule would move these too. */
const onlyTestOrRecord: Listed[] = [];
/** List B: hasProof would fail if a row that only names the same thing on both sides stopped counting. */
const namesOnly: Listed[] = [];
const sameJob = catalog.pairs.filter((p) => p.match_type === "equivalent_spec");
for (const p of sameJob) {
  const c = comparison(p);
  const rows = evidenceRows(c);
  if (!rows.some(readsSameOrBetter)) {
    const otherProof = !!c.nutrition || rows.some((r) => r.kind === "test");
    (otherProof ? onlyTestOrRecord : noneSameOrBetter).push(listed(p, c, rows));
  } else if (!hasProof({ ...c, ingredients: c.ingredients.filter((r) => !onlyNames(r)) })) {
    namesOnly.push(listed(p, c, rows));
  }
}

const order = (a: Listed, b: Listed) => a.aisle.localeCompare(b.aisle) || a.brand.localeCompare(b.brand) || a.slug.localeCompare(b.slug);
noneSameOrBetter.sort(order);
onlyTestOrRecord.sort(order);
namesOnly.sort(order);

const jsonAt = process.argv.indexOf("--json");
if (jsonAt > 0) {
  writeFileSync(process.argv[jsonAt + 1], JSON.stringify({ sameJob: sameJob.length, noneSameOrBetter, onlyTestOrRecord, namesOnly }, null, 1));
  process.exit(0);
}

const cell = (s: string) => s.replaceAll("|", "\\|");
function byAisle(list: Listed[]) {
  const counts = new Map<string, number>();
  for (const l of list) counts.set(l.aisle, (counts.get(l.aisle) ?? 0) + 1);
  return [...counts].map(([a, n]) => `${a} ${n}`).join(", ");
}
function table(list: Listed[]) {
  const head = "| Aisle | Brand | Cheaper | Saving | What's on file |\n|---|---|---|---|---|";
  const rows = list.map(
    (l) => `| ${l.aisle} (${l.market}) | ${cell(l.brand)} | [${cell(l.alternative)}](http://192.168.0.62:8851/compare/${l.slug}) | ${l.saving}% | ${cell(l.rows.join("; ") || "nothing beyond pack and price")}${l.community ? "; community nutrition or ingredient record" : ""} |`,
  );
  return [head, ...rows].join("\n");
}

const a = noneSameOrBetter.length;
const strict = onlyTestOrRecord.length;
const b = namesOnly.length;
console.log(`# Card sbc-same-job-proof: what a stricter rule would change

Written by \`scripts/qa/same_job_list.ts\` from the built catalogue on main. Nothing here changes the site, and the rule stays as it is until the card is answered. The links open the LAN preview.

**Today** a swap may say "Does the same job" if at least one row has data on both sides, and that row may show a difference. ${sameJob.length} of ${catalog.pairs.length} swaps carry that label.

**Tightening moves the swaps below from "Does the same job" to "Same kind".** Their prices, photos and pages stay. Only the label and the wording that goes with it change.

| Choice | Moves to "Same kind" | "Does the same job" after |
|---|---|---|
| Keep today's rule | 0 | ${sameJob.length} |
| A: need one row that reads same or better, unless a test result or community record is on file | ${a} | ${sameJob.length - a} |
| A, strict: a test result or community record doesn't count either | ${a + strict} | ${sameJob.length - a - strict} |
| B: rows that only name the same thing on both sides stop counting | ${b} | ${sameJob.length - b} |
| A and B | ${a + b} | ${sameJob.length - a - b} |

The earlier lead recommended A alone, with name-only rows kept as proof where the name carries the spec, so "Alkaline AA (LR06), 1.5 V" stays proof because the name is the spec.

The card says 38 and 26. Those were counted during the earlier review rounds, the 38 by a reviewer and the 26 by the fixer, from the definitions their notes give. The same definitions on today's catalogue give ${a} and ${b}. The old builds weren't rerun, so this doesn't say which swaps account for the gap. List A has no swap in common with list B: a name-only row reads "same", so it keeps a swap out of list A.

## List A: no row reads same or better, and no test result or community record (${a})

By aisle: ${byAisle(noneSameOrBetter)}.

${table(noneSameOrBetter)}

## List A, strict: as above, but a test result or community record is on file (${strict})

Only a strict reading of the rule moves these. A test can favour the brand, and the community nutrition and ingredient rows give no same-or-different verdict.

By aisle: ${byAisle(onlyTestOrRecord)}.

${table(onlyTestOrRecord)}

## List B: the proof is only rows that name the same thing on both sides (${b})

By aisle: ${byAisle(namesOnly)}.

${table(namesOnly)}`);

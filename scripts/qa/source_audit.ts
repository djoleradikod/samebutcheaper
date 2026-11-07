/**
 * Which sources the catalogue's prices rest on, what their terms say, and what's left if the barred and unknown ones go.
 * Verdicts are in docs/research/R4-source-verdicts.json. Writes docs/research/R4-source-audit.md: npx tsx scripts/qa/source_audit.ts
 *
 * A side's source is approximate. A record citing Open Prices counts both sides as Open Prices, a record whose evidence credits
 * Auto Express counts as that, and every other side counts as the host of its link.
 */
import { readFileSync, writeFileSync } from "node:fs";
import catalog from "../../src/generated/catalog.json";
import { forCountry, localFor, type Listed } from "../../src/lib/localize";

type Verdict = "ok" | "barred" | "unknown";
const verdicts = JSON.parse(readFileSync("docs/research/R4-source-verdicts.json", "utf8")) as Record<string, { verdict: Verdict; terms: string; obtained: string }>;

type Side = { url?: string | null; rating?: unknown };
type Row = Listed & { slug: string; market: string; sources: string[]; evidence?: string; brand: Side; alternative: Side; bulkView?: { bigger?: unknown }; twin: { slug: string; market: never } | null };
const pairs = catalog.pairs as unknown as Row[];

function host(url?: string | null) {
  try {
    return new URL(url ?? "").hostname.replace(/^www\./, "");
  } catch {
    return "(no link)";
  }
}

function sourceOf(p: Row, side: Side) {
  if (p.sources.some((s) => s.includes("prices.openfoodfacts.org"))) return "Open Prices";
  if (p.sources.some((s) => s.includes("autoexpress.co.uk")) && /Auto Express/.test(p.evidence ?? "")) return "Auto Express";
  return host(side.url);
}

const verdictOf = (source: string): Verdict => verdicts[source]?.verdict ?? "unknown";
const sourcesOf = (p: Row) => [...new Set([sourceOf(p, p.brand), sourceOf(p, p.alternative)])];

const tally = new Map<string, { records: Set<string>; markets: Set<string> }>();
for (const p of pairs) {
  for (const source of sourcesOf(p)) {
    const t = tally.get(source) ?? { records: new Set(), markets: new Set() };
    t.records.add(p.slug);
    t.markets.add(p.market);
    tally.set(source, t);
  }
}

/** What each country lists from a subset. A twin that's gone no longer takes a record's place. */
function counts(keep: Row[], country: string) {
  const slugs = new Set(keep.map((p) => p.slug));
  const rows = keep.map((p) => (p.twin && !slugs.has(p.twin.slug) ? { ...p, twin: null } : p));
  const listed = forCountry(rows, localFor(country));
  const own = listed.filter((p) => p.market === country).length;
  return { swaps: listed.length, own, rated: listed.filter((p) => p.alternative.rating).length, bulk: listed.filter((p) => p.bulkView?.bigger).length };
}

const scenarios: [string, Row[]][] = [
  ["Today", pairs],
  ["Without barred sources", pairs.filter((p) => !sourcesOf(p).some((s) => verdictOf(s) === "barred"))],
  ["Only sources marked ok", pairs.filter((p) => sourcesOf(p).every((s) => verdictOf(s) === "ok"))],
];
const COUNTRIES = ["IE", "GB", "DE", "US", "CA"];

const lines: string[] = [];
lines.push("# R4: where the catalogue's prices come from", "");
lines.push("Written 7 Nov 2026 by `scripts/qa/source_audit.ts`, from `docs/research/R4-source-verdicts.json`. The owner decides what stays. Nothing has been removed.", "");
lines.push(`The catalogue has ${pairs.length} records. **ok** means the terms were read and don't bar this. **barred** means robots or terms do, as quoted. **unknown** means nobody has read enough to say, which includes any site whose imprint wasn't read: that's where zooplus's clause was. Terms were read through a summarising fetch tool, so check the quotes by hand before relying on them.`, "");
lines.push("A record's source is approximate. One citing Open Prices counts both sides as Open Prices, though some have one side from a store. A record counts against a source if either side uses it. Ratings aren't in this count: 20 ratings read on 7 Nov came from zooplus.de and Pollin.", "");
lines.push("## What survives", "", "Swaps each country lists by default, with how many are at that country's own prices, how many are rated, and how many have a bigger pack.", "");
lines.push(`| Scenario | Records | ${COUNTRIES.join(" | ")} |`, `|---|---|${COUNTRIES.map(() => "---").join("|")}|`);
for (const [name, keep] of scenarios) {
  const cells = COUNTRIES.map((c) => {
    const n = counts(keep, c);
    return `${n.swaps} (${n.own} own, ${n.rated} rated, ${n.bulk} bigger)`;
  });
  lines.push(`| ${name} | ${keep.length} | ${cells.join(" | ")} |`);
}
lines.push("", "## Sources", "", "| Source | Market | Records | What the terms say | How the data was obtained | Verdict |", "|---|---|---:|---|---|---|");
const order: Verdict[] = ["barred", "unknown", "ok"];
const sorted = [...tally.entries()].sort((a, b) => order.indexOf(verdictOf(a[0])) - order.indexOf(verdictOf(b[0])) || b[1].records.size - a[1].records.size);
const others: string[] = [];
let otherRecords = 0;
for (const [source, t] of sorted) {
  const v = verdicts[source];
  if (!v) {
    others.push(`${source} (${t.records.size})`);
    otherRecords += t.records.size;
    continue;
  }
  lines.push(`| ${source} | ${[...t.markets].join(", ")} | ${t.records.size} | ${v.terms.replace(/\|/g, "/")} | ${v.obtained} | ${v.verdict} |`);
}
lines.push(`| All others, ${others.length} sources | | ${otherRecords} | Terms not on file. | Not recorded per record. | unknown |`);
lines.push("", `The others: ${others.join(", ")}.`, "");
lines.push("## Before these numbers are used", "");
lines.push("- Open Prices' ODbL needs a credit on the site and shared changes to the dataset. `/about` and `/how-we-verify` credit it. Nobody has read the official licence page or checked what sharing changes would take.");
lines.push("- A swap that's cut can often come back from a licensed feed. R2 lists Awin and others, and each needs an account.");
lines.push("- Publishing a store's price isn't the same as reading it, and neither is a legal question this audit answers. It records what the terms say.");
writeFileSync("docs/research/R4-source-audit.md", lines.join("\n") + "\n");
for (const [name, keep] of scenarios) console.log(name, keep.length, COUNTRIES.map((c) => `${c} ${counts(keep, c).swaps}/${counts(keep, c).own}`).join(" "));
console.log("sources", tally.size, "unnamed", others.length, otherRecords);

/**
 * Which records rest on sources we may use: the ok / unclear / barred buckets of docs/research/R7-resourcing.md,
 * worked out the same way, plus one rule the price feeds add.
 *
 * - A side's source is the host of its link; a record citing Open Prices counts both sides as Open Prices; a
 *   record whose evidence credits Auto Express counts as that (scripts/qa/source_audit.ts).
 * - The verdict for a source comes from R4, then R5, R6, R7 and R10 source verdicts, later files winning.
 * - NEW: a side whose current price came from an affiliate feed (its newest observation is a feed line, see
 *   attach.ts feedInfoFor) counts as **licensed**, whatever the store's own terms say: the merchant gave us that
 *   price and link under the network's publisher agreement. Licensed counts as ok.
 * - A record is barred if any side is barred, ok if every side is ok or licensed, unclear otherwise.
 *
 * Printed by `npm run prices:refresh -- --report`, and stored per run for /admin (feed-status.ts).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { feedInfoFor } from "./attach";
import { bySide, ROOT, type Observation } from "./observations";
import type { PricedRecord, PricedSide } from "./records";

export type Verdict = "ok" | "barred" | "unknown";
export type Bucket = "ok" | "unclear" | "barred";
export type Buckets = Record<Bucket, number>;
export type LicenceReport = {
  swaps: { verdicts: Buckets; withFeeds: Buckets };
  kits: { verdicts: Buckets; withFeeds: Buckets };
  /** Sides priced from a feed, by network. */
  licensedSides: Record<string, number>;
};

export const VERDICT_FILES = ["R4-source-verdicts.json", "R5-source-verdicts.json", "R6-source-verdicts.json", "R7-source-verdicts.json", "R10-source-verdicts.json"];

export function loadVerdicts(dir = join(ROOT, "docs", "research")): Record<string, Verdict> {
  const out: Record<string, Verdict> = {};
  for (const f of VERDICT_FILES) {
    const path = join(dir, f);
    if (!existsSync(path)) continue;
    const json = JSON.parse(readFileSync(path, "utf8")) as Record<string, { verdict?: Verdict }>;
    for (const [source, v] of Object.entries(json)) if (v?.verdict) out[source] = v.verdict;
  }
  return out;
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "(no link)";
  }
}

/** The source a side's price rests on, as the source audit names it. */
export function sourceOf(record: Pick<PricedRecord, "sources" | "evidence">, side: Pick<PricedSide, "url">) {
  if ((record.sources ?? []).some((s) => s.includes("prices.openfoodfacts.org"))) return "Open Prices";
  if ((record.sources ?? []).some((s) => s.includes("autoexpress.co.uk")) && /Auto Express/.test(record.evidence ?? "")) return "Auto Express";
  return host(side.url);
}

const empty = (): Buckets => ({ ok: 0, unclear: 0, barred: 0 });

function bucketOf(verdicts: Verdict[]): Bucket {
  if (verdicts.includes("barred")) return "barred";
  return verdicts.every((v) => v === "ok") ? "ok" : "unclear";
}

export function licenceReport(records: PricedRecord[], observations: Observation[], verdicts: Record<string, Verdict>): LicenceReport {
  const log = bySide(observations);
  const report: LicenceReport = { swaps: { verdicts: empty(), withFeeds: empty() }, kits: { verdicts: empty(), withFeeds: empty() }, licensedSides: {} };
  for (const r of records) {
    const target = r.kind === "swap" ? report.swaps : report.kits;
    const plain: Verdict[] = [];
    const fed: Verdict[] = [];
    for (const s of r.sides) {
      const v = verdicts[sourceOf(r, s)] ?? "unknown";
      plain.push(v);
      const feed = feedInfoFor(log.get(`${r.slug}|${s.side}`) ?? [], s.price);
      if (feed) report.licensedSides[feed.network] = (report.licensedSides[feed.network] ?? 0) + 1;
      fed.push(feed ? "ok" : v);
    }
    target.verdicts[bucketOf(plain)]++;
    target.withFeeds[bucketOf(fed)]++;
  }
  return report;
}

export function licenceLines(report: LicenceReport) {
  const row = (name: string, b: { verdicts: Buckets; withFeeds: Buckets }) =>
    `| ${name} | ${b.verdicts.ok} / ${b.verdicts.unclear} / ${b.verdicts.barred} | ${b.withFeeds.ok} / ${b.withFeeds.unclear} / ${b.withFeeds.barred} |`;
  const licensed = Object.entries(report.licensedSides);
  return [
    "### Sources we may use",
    "",
    "ok / unclear / barred, from the stores' terms (docs/research R4 to R7), then counting a side priced from an affiliate feed as licensed.",
    "",
    "| | Store terms alone | With feeds |",
    "|---|---|---|",
    row("Swaps", report.swaps),
    row("Kits", report.kits),
    "",
    licensed.length ? `Sides priced from a feed: ${licensed.map(([n, c]) => `${n} ${c}`).join(", ")}.` : "No side is priced from a feed yet.",
    "",
  ];
}

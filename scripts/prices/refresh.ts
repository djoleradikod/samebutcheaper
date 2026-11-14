/**
 * Refreshes catalogue prices from licensed sources only, and never from a store's own pages.
 * See docs/prices.md for the rules, docs/feeds.md for affiliate feeds, and the weekly GitHub workflow that runs it.
 *
 *   npx tsx scripts/prices/refresh.ts                       # every source that's configured
 *   npx tsx scripts/prices/refresh.ts --only open-prices    # one source (open-prices, feed)
 *   npx tsx scripts/prices/refresh.ts --manual checks.csv   # hand checks from a CSV, alone
 *   npx tsx scripts/prices/refresh.ts --dry-run             # say what would change, write nothing
 *   npx tsx scripts/prices/refresh.ts --summary out.md      # also write the report as Markdown
 *   npx tsx scripts/prices/refresh.ts --report              # no sources: the licence buckets and each feed's last run
 *   npx tsx scripts/prices/refresh.ts --accept <id>         # a person checked a review case: apply it
 *   npx tsx scripts/prices/refresh.ts --dismiss <id>        # a person checked a review case: drop it
 *
 * Env: PRICE_FEED_URLS and PRICE_FEED_COLUMNS (see adapters/feed.ts), PRICE_FEED_MAX_AGE_DAYS (30),
 * OPEN_PRICES_MAX_AGE_DAYS (60), OPEN_PRICES_DELAY_MS (1000), PRICE_MAX_MOVE (0.35).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { configuredNetworks, silentNetworks, type FeedRuns } from "../../src/lib/feed-status";
import { isoDay } from "../../src/lib/freshness";
import { RETAILERS } from "../../src/lib/markets";
import { feedAdapter, type FeedStats } from "./adapters/feed";
import { manualAdapter } from "./adapters/manual";
import { openPricesAdapter } from "./adapters/open-prices";
import type { AdapterContext, Candidate, PriceAdapter } from "./adapters/types";
import { checkedMonth, decide, MIN_SAVING, REVIEW_REASONS, type Decision, type ReviewItem } from "./decide";
import { FEED_RUNS_FILE, mergeFeedRuns, readFeedRuns, writeFeedRuns } from "./feed-runs";
import { editJson, type ValueEdit } from "./json-edit";
import { licenceLines, licenceReport, loadVerdicts, type LicenceReport } from "./licence";
import { appendObservations, bySide, isMain, loadObservations, OBSERVATIONS_DIR, observationSchema, REVIEW_FILE, type Observation } from "./observations";
import { BUNDLE_DIR, loadRecords, PAIR_DIR, savingPct, type PricedRecord } from "./records";

/** Where a run reads and writes. Tests point these at temporary copies; the defaults are the real data. */
export type Paths = { pairDir: string; bundleDir: string; observationsDir: string; reviewFile: string; feedRunsFile: string };
export const DATA_PATHS: Paths = { pairDir: PAIR_DIR, bundleDir: BUNDLE_DIR, observationsDir: OBSERVATIONS_DIR, reviewFile: REVIEW_FILE, feedRunsFile: FEED_RUNS_FILE };

/* ------------------------------------------------------------- review file */

const reviewItemSchema = z.object({
  id: z.string(),
  created: z.string(),
  record: z.string(),
  kind: z.enum(["swap", "kit"]),
  market: z.string(),
  currency: z.string(),
  reasons: z.array(z.enum(REVIEW_REASONS)),
  detail: z.array(z.string()),
  savingNow: z.number(),
  savingAfter: z.number(),
  changes: z.array(z.object({ side: z.string(), name: z.string(), from: z.number(), to: z.number(), changePct: z.number() })),
  observations: z.array(observationSchema),
});
export const reviewFileSchema = z.object({ updated: z.string().nullable(), items: z.array(reviewItemSchema) });
export type ReviewFile = z.infer<typeof reviewFileSchema>;

export function readReview(path = REVIEW_FILE): ReviewFile {
  if (!existsSync(path)) return { updated: null, items: [] };
  return reviewFileSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

/**
 * A case already on file (same id) isn't added twice. A new case for a record replaces its older one,
 * since the newer reading is what a person should look at.
 */
export function mergeReview(current: ReviewFile, items: ReviewItem[], today: string): ReviewFile {
  const ids = new Set(current.items.map((i) => i.id));
  const added = items.filter((i) => !ids.has(i.id));
  const replaced = new Set(added.map((i) => i.record));
  return { updated: added.length ? today : current.updated, items: [...current.items.filter((i) => !replaced.has(i.record)), ...added] };
}

function writeReview(file: ReviewFile, path = REVIEW_FILE) {
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
}

/* ------------------------------------------------------------------ writes */

/** Applies each file's edits in one pass; editJson checks the result is the original plus exactly those changes. */
export function applyEdits(updates: { record: PricedRecord; edits: ValueEdit[] }[], read = (f: string) => readFileSync(f, "utf8"), write = (f: string, t: string) => writeFileSync(f, t)) {
  const byFile = new Map<string, ValueEdit[]>();
  for (const u of updates) byFile.set(u.record.file, [...(byFile.get(u.record.file) ?? []), ...u.edits]);
  for (const [file, edits] of byFile) write(file, editJson(read(file), edits));
}

/* ----------------------------------------------------------------- summary */

const money = (n: number) => n.toFixed(2);
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

const FEED_CHANGE_WORDS = {
  "out-of-stock": "out of stock in the feed: the page says so and the record stops leading lists; its price is unchanged",
  "back-in-stock": "back in stock in the feed",
  link: "Buy links now go through the feed's tracked link (the /go address on the page doesn't change)",
} as const;

export function summarize(decision: Decision, notes: string[], opts: { written: number; dryRun: boolean; licence?: LicenceReport }) {
  const lines: string[] = [];
  const changes = decision.updates.flatMap((u) => u.changes);
  const gone = decision.review.filter((r) => r.reasons.includes("saving-gone"));
  lines.push(`## Price watch`, "");
  lines.push(
    `${changes.length} price(s) ${opts.dryRun ? "would be " : ""}updated on ${decision.updates.length} record(s), ${decision.confirmed} confirmed unchanged, ` +
      `${decision.review.length} case(s) ${opts.dryRun ? "would go" : "sent"} to review, ${opts.written} observation(s) logged.${opts.dryRun ? " Dry run: nothing was written." : ""}`,
    "",
  );
  if (changes.length) {
    lines.push("### Prices that moved", "", "| Record | Side | Was | Now | Change | Source | Seen |", "|---|---|---|---|---|---|---|");
    for (const c of changes) lines.push(`| ${c.record} | ${c.name} | ${c.currency} ${money(c.from)} | ${c.currency} ${money(c.to)} | ${signed(c.changePct)} | ${c.source} | ${c.seen} |`);
    lines.push("");
  }
  // Said every time, so nobody has to wonder whether a swap quietly stopped saving.
  lines.push(`### Savings under ${MIN_SAVING}%`, "");
  if (gone.length) {
    lines.push(`${gone.length} record(s) would save under ${MIN_SAVING}% at the new prices. They were NOT changed and are in data/prices/review.json:`, "");
    for (const r of gone) lines.push(`- ${r.record}: ${r.savingNow}% now, ${r.savingAfter}% at the new prices`);
  } else lines.push(`None: every swap a source repriced still saves ${MIN_SAVING}% or more.`);
  lines.push("");
  const other = decision.review.filter((r) => !r.reasons.includes("saving-gone"));
  if (other.length) {
    lines.push("### Sent to review", "");
    for (const r of other) lines.push(`- \`${r.id}\` ${r.record}: ${r.detail.join("; ")}`);
    lines.push("");
  }
  for (const kind of ["out-of-stock", "back-in-stock", "link"] as const) {
    const list = decision.feedChanges.filter((f) => f.change === kind);
    if (!list.length) continue;
    lines.push(`### ${kind === "link" ? "Tracked links" : kind === "out-of-stock" ? "Out of stock" : "Back in stock"}`, "", `${FEED_CHANGE_WORDS[kind]}:`, "");
    for (const f of list) lines.push(`- ${f.record}: ${f.name} (${f.source})`);
    lines.push("");
  }
  if (opts.licence) lines.push(...licenceLines(opts.licence));
  lines.push("### Sources", "", ...notes.map((n) => `- ${n}`), "");
  return lines.join("\n");
}

/** The records as they'd be with this decision's prices, for the licence count before anything is written. */
function projected(records: PricedRecord[], decision: Decision): PricedRecord[] {
  const moved = new Map(decision.updates.flatMap((u) => u.changes.map((c) => [`${c.record}|${c.side}`, c.to] as const)));
  return records.map((r) => ({ ...r, sides: r.sides.map((s) => ({ ...s, price: moved.get(`${r.slug}|${s.side}`) ?? s.price })) }));
}

/* --------------------------------------------------------------------- run */

export async function run(adapters: PriceAdapter[], ctx: AdapterContext, opts: { dryRun: boolean; maxMove?: number; paths?: Paths }) {
  const paths = opts.paths ?? DATA_PATHS;
  const { observations, errors } = loadObservations(paths.observationsDir);
  if (errors.length) throw new Error(`the observation log has bad lines, fix them first:\n${errors.join("\n")}`);
  const records = loadRecords(paths.pairDir, paths.bundleDir);
  const candidates: Candidate[] = [];
  const notes: string[] = [];
  const feedStats: FeedStats[] = [];
  for (const a of adapters) {
    const result = await a.collect(records, ctx);
    candidates.push(...result.candidates);
    notes.push(...result.notes);
    feedStats.push(...(result.feedStats ?? []));
  }
  const decision = decide(records, candidates, observations, { today: ctx.today, maxMove: opts.maxMove });
  const licence = licenceReport(projected(records, decision), [...observations, ...decision.observations], loadVerdicts());
  let written = 0;
  if (!opts.dryRun) {
    applyEdits(decision.updates);
    written = appendObservations(decision.observations, observations, paths.observationsDir).length;
    if (decision.review.length) writeReview(mergeReview(readReview(paths.reviewFile), decision.review, ctx.today), paths.reviewFile);
    if (feedStats.length) writeFeedRuns(mergeFeedRuns(readFeedRuns(paths.feedRunsFile), ctx.today, feedStats, decision, observations, licence), paths.feedRunsFile);
  }
  return { decision, notes, feedStats, licence, summary: summarize(decision, notes, { written, dryRun: opts.dryRun, licence }) };
}

/** `--report`: no source is asked. The licence buckets now, and what each feed network did on its last run. */
export function report(today: string, paths: Paths = DATA_PATHS, opts: { write: boolean } = { write: false }) {
  const { observations } = loadObservations(paths.observationsDir);
  const records = loadRecords(paths.pairDir, paths.bundleDir);
  const licence = licenceReport(records, observations, loadVerdicts());
  const runs: FeedRuns = readFeedRuns(paths.feedRunsFile);
  if (opts.write) writeFeedRuns({ ...runs, licence: { swaps: licence.swaps, kits: licence.kits } }, paths.feedRunsFile);
  const lines = ["## Price sources", "", ...licenceLines(licence), "### Feeds", ""];
  const configured = configuredNetworks(runs);
  if (!configured.length) lines.push("No feed network was read on the last run. docs/feeds.md says how to add one.");
  for (const [id, n] of configured) {
    lines.push(
      `- ${id}: ${n.feeds.join(", ")}. Last run ${n.lastRun}: ${n.rows} rows, ${n.matched.gtin + n.matched.id + n.matched.name} sides matched, ${n.refreshed} records refreshed, ${n.review} in review. Last price from it: ${n.lastObservation ?? "never"}.`,
    );
    for (const e of n.errors) lines.push(`  - ${e}`);
  }
  for (const s of silentNetworks(runs, today)) lines.push(`- WARNING: ${s.id} is configured but hasn't priced anything since ${s.lastObservation ?? "it was added"}.`);
  return lines.join("\n") + "\n";
}

/* ------------------------------------------------------------------ review */

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * A reviewed reading from another store than the record's (a re-sourcing check, say at APONEO for a record that
 * cited Shop Apotheke) moves the side to that store: its link, its retailer, and no ASIN once it isn't Amazon's.
 * Returns the edits and a line per move; throws when the store can't be told from the reading.
 */
export function moveEdits(record: PricedRecord, observations: Observation[]) {
  const edits: ValueEdit[] = [];
  const moved: string[] = [];
  for (const o of observations) {
    if (o.method === "feed" || o.method === "open-prices") continue; // a feed prices its own store; Open Prices is no store
    const s = record.sides.find((x) => x.side === o.side)!;
    const retailer = (RETAILERS as readonly string[]).includes(o.source) && o.source !== "other" ? o.source : null;
    const sameHost = hostOf(o.url) === hostOf(s.url);
    if (sameHost && (!retailer || retailer === s.retailer)) continue;
    if (!retailer) throw new Error(`${record.slug} ${o.side}: the reading is from ${hostOf(o.url)} (source "${o.source}"), which isn't a known retailer id, so the side can't be moved there: fix it by hand`);
    edits.push({ path: [...s.path, "url"], value: o.url });
    if (retailer !== s.retailer) edits.push({ path: [...s.path, "retailer"], value: retailer });
    if (s.asin && retailer !== "amazon") edits.push({ path: [...s.path, "asin"], value: null });
    moved.push(`${o.side} moved from ${hostOf(s.url) || s.retailer} to ${hostOf(o.url)}`);
  }
  return { edits, moved };
}

/** A person looked at a review case and agrees with the source: log it, apply it, and move the link if it moved store. */
export function accept(id: string, today: string, paths: Paths = DATA_PATHS) {
  const review = readReview(paths.reviewFile);
  const item = review.items.find((i) => i.id === id);
  if (!item) throw new Error(`no review case ${id}`);
  if (item.reasons.includes("pack-mismatch")) throw new Error(`${id} is a different pack: correct the record's pack by hand, then log a manual check`);
  const records = loadRecords(paths.pairDir, paths.bundleDir);
  const record = records.find((r) => r.slug === item.record);
  if (!record) throw new Error(`${item.record} is no longer in the catalogue`);
  const priced = item.observations.filter((o) => o.stock !== "out");
  const prices = new Map(priced.map((o) => [o.side, o.price]));
  const saving = savingPct(record, prices);
  if (saving < MIN_SAVING)
    throw new Error(`${item.record} would save ${saving.toFixed(1)}% at these prices, under the ${MIN_SAVING}% floor: re-research it or take it out by hand`);
  const { observations } = loadObservations(paths.observationsDir);
  const edits: ValueEdit[] = [...prices].map(([side, price]) => {
    const s = record.sides.find((x) => x.side === side)!;
    return { path: [...s.path, s.priceKey], value: price };
  });
  const { edits: moves, moved } = moveEdits(record, priced);
  edits.push(...moves);
  // price_checked follows the oldest side's latest observation, and only ever moves forward.
  const month = checkedMonth(record, bySide(observations), priced, prices);
  if (month && month > record.priceChecked.slice(0, 7)) edits.push({ path: [record.index, "price_checked"], value: month });
  applyEdits([{ record, edits }]);
  appendObservations(
    item.observations.map((o) => ({ ...o, logged: today, note: [o.note, `Accepted from review ${id}`].filter(Boolean).join(". ") })),
    observations,
    paths.observationsDir,
  );
  writeReview({ ...review, items: review.items.filter((i) => i.id !== id) }, paths.reviewFile);
  const lines = [`${item.record}: applied ${[...prices].map(([s, p]) => `${s} ${p}`).join(", ")}`];
  if (moved.length) {
    lines.push(`Moved: ${moved.join("; ")}.`);
    // What else in the record still cites the old store: evidence, sources, ratings, aspects. A person decides.
    const raw = JSON.stringify(JSON.parse(readFileSync(record.file, "utf8"))[record.index]);
    const old = record.sides.filter((s) => priced.some((o) => o.side === s.side)).map((s) => hostOf(s.url)).filter(Boolean);
    const still = [...new Set(old)].filter((h) => raw.includes(h));
    if (still.length) lines.push(`Check by hand: the record's evidence, sources, ratings or aspects still mention ${still.join(", ")}.`);
  }
  return lines.join("\n");
}

export function dismiss(id: string, paths: Paths = DATA_PATHS) {
  const review = readReview(paths.reviewFile);
  if (!review.items.some((i) => i.id === id)) throw new Error(`no review case ${id}`);
  writeReview({ ...review, items: review.items.filter((i) => i.id !== id) }, paths.reviewFile);
  return `dismissed ${id}`;
}

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const today = isoDay(new Date());
  try {
    if (arg("--accept")) console.log(accept(arg("--accept")!, today));
    else if (arg("--dismiss")) console.log(dismiss(arg("--dismiss")!));
    else if (process.argv.includes("--report")) {
      const out = report(today, DATA_PATHS, { write: !process.argv.includes("--dry-run") });
      if (arg("--summary")) writeFileSync(arg("--summary")!, out);
      console.log(out);
    } else {
      const manual = arg("--manual");
      const only = arg("--only");
      const all: PriceAdapter[] = [openPricesAdapter, feedAdapter];
      const adapters = manual ? [manualAdapter(manual)] : all.filter((a) => !only || a.id === only);
      if (!adapters.length) throw new Error(`unknown source ${only}; known: ${all.map((a) => a.id).join(", ")}`);
      const ctx: AdapterContext = {
        today,
        now: new Date().toISOString(),
        env: process.env,
        fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(600_000) }),
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      };
      const maxMove = process.env.PRICE_MAX_MOVE ? Number(process.env.PRICE_MAX_MOVE) : undefined;
      const { summary } = await run(adapters, ctx, { dryRun: process.argv.includes("--dry-run"), maxMove });
      const out = arg("--summary");
      if (out) writeFileSync(out, summary);
      console.log(summary);
    }
  } catch (err) {
    console.error(`price refresh: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

if (isMain(import.meta.url)) void main();

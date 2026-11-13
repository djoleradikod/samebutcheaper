/**
 * Refreshes catalogue prices from licensed sources only, and never from a store's own pages.
 * See docs/prices.md for the rules and the weekly GitHub workflow that runs it.
 *
 *   npx tsx scripts/prices/refresh.ts                       # every source that's configured
 *   npx tsx scripts/prices/refresh.ts --only open-prices    # one source (open-prices, feed)
 *   npx tsx scripts/prices/refresh.ts --manual checks.csv   # hand checks from a CSV, alone
 *   npx tsx scripts/prices/refresh.ts --dry-run             # report, write nothing
 *   npx tsx scripts/prices/refresh.ts --summary out.md      # also write the report as Markdown
 *   npx tsx scripts/prices/refresh.ts --accept <id>         # a person checked a review case: apply it
 *   npx tsx scripts/prices/refresh.ts --dismiss <id>        # a person checked a review case: drop it
 *
 * Env: PRICE_FEED_URLS (see adapters/feed.ts), PRICE_FEED_MAX_AGE_DAYS (30), OPEN_PRICES_MAX_AGE_DAYS (60),
 * OPEN_PRICES_DELAY_MS (1000), PRICE_MAX_MOVE (0.35).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { isoDay } from "../../src/lib/freshness";
import { feedAdapter } from "./adapters/feed";
import { manualAdapter } from "./adapters/manual";
import { openPricesAdapter } from "./adapters/open-prices";
import type { AdapterContext, Candidate, PriceAdapter } from "./adapters/types";
import { checkedMonth, decide, MIN_SAVING, REVIEW_REASONS, type Decision, type ReviewItem } from "./decide";
import { editJson, type ValueEdit } from "./json-edit";
import { appendObservations, bySide, isMain, loadObservations, observationSchema, REVIEW_FILE } from "./observations";
import { loadRecords, savingPct, type PricedRecord } from "./records";

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

export function summarize(decision: Decision, notes: string[], opts: { written: number; dryRun: boolean }) {
  const lines: string[] = [];
  const changes = decision.updates.flatMap((u) => u.changes);
  const gone = decision.review.filter((r) => r.reasons.includes("saving-gone"));
  lines.push(`## Price watch`, "");
  lines.push(
    `${changes.length} price(s) updated on ${decision.updates.length} record(s), ${decision.confirmed} confirmed unchanged, ` +
      `${decision.review.length} case(s) sent to review, ${opts.written} observation(s) logged.${opts.dryRun ? " Dry run: nothing was written." : ""}`,
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
  lines.push("### Sources", "", ...notes.map((n) => `- ${n}`), "");
  return lines.join("\n");
}

/* --------------------------------------------------------------------- run */

export async function run(adapters: PriceAdapter[], ctx: AdapterContext, opts: { dryRun: boolean; maxMove?: number }) {
  const { observations, errors } = loadObservations();
  if (errors.length) throw new Error(`the observation log has bad lines, fix them first:\n${errors.join("\n")}`);
  const records = loadRecords();
  const candidates: Candidate[] = [];
  const notes: string[] = [];
  for (const a of adapters) {
    const result = await a.collect(records, ctx);
    candidates.push(...result.candidates);
    notes.push(...result.notes);
  }
  const decision = decide(records, candidates, observations, { today: ctx.today, maxMove: opts.maxMove });
  let written = 0;
  if (!opts.dryRun) {
    applyEdits(decision.updates);
    written = appendObservations(decision.observations, observations).length;
    if (decision.review.length) writeReview(mergeReview(readReview(), decision.review, ctx.today));
  }
  return { decision, notes, summary: summarize(decision, notes, { written, dryRun: opts.dryRun }) };
}

/** A person looked at a review case and agrees with the source: log it and apply it. */
export function accept(id: string, today: string) {
  const review = readReview();
  const item = review.items.find((i) => i.id === id);
  if (!item) throw new Error(`no review case ${id}`);
  if (item.reasons.includes("pack-mismatch")) throw new Error(`${id} is a different pack: correct the record's pack by hand, then log a manual check`);
  const records = loadRecords();
  const record = records.find((r) => r.slug === item.record);
  if (!record) throw new Error(`${item.record} is no longer in the catalogue`);
  const prices = new Map(item.observations.map((o) => [o.side, o.price]));
  const saving = savingPct(record, prices);
  if (saving < MIN_SAVING)
    throw new Error(`${item.record} would save ${saving.toFixed(1)}% at these prices, under the ${MIN_SAVING}% floor: re-research it or take it out by hand`);
  const { observations } = loadObservations();
  const edits: ValueEdit[] = [...prices].map(([side, price]) => {
    const s = record.sides.find((x) => x.side === side)!;
    return { path: [...s.path, s.priceKey], value: price };
  });
  // price_checked follows the oldest side's latest observation, and only ever moves forward.
  const month = checkedMonth(record, bySide(observations), item.observations, prices);
  if (month && month > record.priceChecked.slice(0, 7)) edits.push({ path: [record.index, "price_checked"], value: month });
  applyEdits([{ record, edits }]);
  appendObservations(
    item.observations.map((o) => ({ ...o, logged: today, note: [o.note, `Accepted from review ${id}`].filter(Boolean).join(". ") })),
    observations,
  );
  writeReview({ ...review, items: review.items.filter((i) => i.id !== id) });
  return `${item.record}: applied ${[...prices].map(([s, p]) => `${s} ${p}`).join(", ")}`;
}

export function dismiss(id: string) {
  const review = readReview();
  if (!review.items.some((i) => i.id === id)) throw new Error(`no review case ${id}`);
  writeReview({ ...review, items: review.items.filter((i) => i.id !== id) });
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
    else {
      const manual = arg("--manual");
      const only = arg("--only");
      const all: PriceAdapter[] = [openPricesAdapter, feedAdapter];
      const adapters = manual ? [manualAdapter(manual)] : all.filter((a) => !only || a.id === only);
      if (!adapters.length) throw new Error(`unknown source ${only}; known: ${all.map((a) => a.id).join(", ")}`);
      const ctx: AdapterContext = {
        today,
        env: process.env,
        fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(120_000) }),
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

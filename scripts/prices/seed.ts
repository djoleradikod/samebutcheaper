/**
 * Backs every price in the catalogue with a hand observation, for any side whose current price has none.
 * Safe to run again: sides that already have an observation at their price are left alone.
 *
 *   npx tsx scripts/prices/seed.ts            # write
 *   npx tsx scripts/prices/seed.ts --dry-run  # count only
 *
 * The records only kept a month (`price_checked: "2026-11"`). The day comes from git: the day the commit
 * that last wrote the price line was made, which is when the hand check was recorded. That day is used only
 * when it falls inside the record's own month; otherwise (an old price carried into a later commit) the
 * observation keeps the month alone, dated the 1st, and the page says the month.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { isoDay } from "../../src/lib/freshness";
import { monthStart } from "./attach";
import { nodeAt, parseWithSpans } from "./json-edit";
import { appendObservations, bySide, isMain, loadObservations, ROOT, samePrice, type Observation } from "./observations";
import { loadRecords, type PricedRecord } from "./records";

/** Day of the commit that last wrote each line (1-based), from `git blame --line-porcelain`. Null for uncommitted lines. */
export function blameDays(porcelain: string): Map<number, string | null> {
  const days = new Map<number, string | null>();
  let line = 0;
  let commit = "";
  const commitDay = new Map<string, string>();
  for (const row of porcelain.split("\n")) {
    const head = /^([0-9a-f]{40}) \d+ (\d+)/.exec(row);
    if (head) {
      commit = head[1];
      line = Number(head[2]);
      continue;
    }
    const time = /^committer-time (\d+)/.exec(row);
    if (time) commitDay.set(commit, isoDay(new Date(Number(time[1]) * 1000)));
    if (row.startsWith("\t")) days.set(line, /^0{40}$/.test(commit) ? null : (commitDay.get(commit) ?? null));
  }
  return days;
}

/** The day to record for a hand check: the commit day when it's inside the record's month, else the month. */
export function seedDate(priceChecked: string, commitDay: string | null): { seen: string; precision: "day" | "month" } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(priceChecked)) return { seen: priceChecked, precision: "day" };
  if (commitDay && commitDay.startsWith(priceChecked.slice(0, 7))) return { seen: commitDay, precision: "day" };
  return { seen: monthStart(priceChecked), precision: "month" };
}

function lineOf(text: string, offset: number) {
  let n = 1;
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

export function seedObservations(records: PricedRecord[], existing: Observation[], today: string, blame: (file: string) => Map<number, string | null>): Observation[] {
  const logged = bySide(existing);
  const out: Observation[] = [];
  const texts = new Map<string, string>();
  for (const r of records) {
    if (!texts.has(r.file)) texts.set(r.file, readFileSync(r.file, "utf8"));
    const text = texts.get(r.file)!;
    const root = parseWithSpans(text);
    for (const s of r.sides) {
      if ((logged.get(`${r.slug}|${s.side}`) ?? []).some((o) => samePrice(o.price, s.price))) continue;
      const node = nodeAt(root, [...s.path, s.priceKey]);
      const day = node ? (blame(r.file).get(lineOf(text, node.start)) ?? null) : null;
      const { seen, precision } = seedDate(r.priceChecked, day);
      out.push({
        record: r.slug,
        side: s.side,
        price: s.price,
        currency: r.currency,
        seen,
        precision,
        source: s.retailer,
        url: s.url,
        method: "hand",
        logged: today,
        note: precision === "day" ? "Seeded from the record; the day its price was committed" : "Seeded from the record; only the month was kept",
      });
    }
  }
  return out;
}

if (isMain(import.meta.url)) {
  const dry = process.argv.includes("--dry-run");
  const { observations, errors } = loadObservations();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  const cache = new Map<string, Map<number, string | null>>();
  const blame = (file: string) => {
    if (!cache.has(file)) {
      let porcelain = "";
      try {
        porcelain = execFileSync("git", ["blame", "--line-porcelain", "--", relative(ROOT, file)], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 });
      } catch {
        /* not in git: month only */
      }
      cache.set(file, blameDays(porcelain));
    }
    return cache.get(file)!;
  };
  const news = seedObservations(loadRecords(), observations, isoDay(new Date()), blame);
  const days = news.filter((o) => o.precision === "day").length;
  if (dry) console.log(`Would add ${news.length} observation(s), ${days} with a day and ${news.length - days} with a month only.`);
  else {
    const written = appendObservations(news, observations);
    console.log(`Added ${written.length} observation(s), ${days} with a day and ${news.length - days} with a month only.`);
  }
}

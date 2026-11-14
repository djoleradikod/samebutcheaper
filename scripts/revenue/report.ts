/**
 * The revenue report (`npm run report:revenue`, docs/feeds.md): outbound clicks per day or week by store, programme,
 * country, page and swap; the clicks that went out untagged, ranked by store with the programme that would have tagged
 * them; and, where a network's commission export or a postback reported a sale, earnings per click. Pure: the CLI in
 * scripts/report-revenue.ts reads the database and the export folder and hands the rows in.
 */
import { clickStore, programmeOf, signupOf } from "../../src/lib/programmes";
import type { Earning } from "./exports";

export type ClickRow = {
  createdAt: Date;
  slug: string;
  side: string;
  retailer: string;
  program: string | null;
  country: string | null;
  host: string | null;
  referrer: string | null;
  clickId: string | null;
};

export type PageType = "swap" | "kit" | "basket" | "check" | "list" | "search" | "other";

const COUNTRY_PREFIX = /^\/(?:us|uk|de|ca|ie|country\/[a-z]{2})(?=\/|$)/;

/**
 * The page a click was made on. The referrer's path when it is ours (the site sends a full same-origin referrer), else
 * what the link itself says: /go/<swap>/<side> is only linked from swap pages, /go/<kit>/item-N and cart-* only from kit
 * pages, and a store search with no referrer is counted as "other". A basket links to swaps rather than out, so its
 * shoppers' clicks count on the swap page they click from.
 */
export function pageTypeOf(click: Pick<ClickRow, "referrer" | "side" | "slug">, isKit: (slug: string) => boolean = () => false): PageType {
  let path: string | null = null;
  try {
    if (click.referrer) path = new URL(click.referrer).pathname.replace(COUNTRY_PREFIX, "") || "/";
  } catch {}
  if (path) {
    if (/^\/compare\//.test(path) || /^\/dupe\//.test(path)) return "swap";
    if (/^\/bundle\//.test(path)) return "kit";
    if (/^\/basket\//.test(path)) return "basket";
    if (/^\/check(\/|$)/.test(path)) return "check";
    if (/^\/my-list(\/|$)/.test(path)) return "list";
    if (/^\/search(\/|$)/.test(path)) return "search";
    return "other";
  }
  if (click.side === "search") return "other";
  if (/^(item-\d+|cart-)/.test(click.side) || isKit(click.slug)) return "kit";
  if (["alternative", "brand", "bigger"].includes(click.side)) return "swap";
  return "other";
}

/** The day, or the Monday of the ISO week, in UTC. */
export function periodOf(d: Date, by: "day" | "week") {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (by === "week") day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

type Money = Record<string, number>;
const addMoney = (m: Money, currency: string, n: number) => {
  m[currency] = Math.round(((m[currency] ?? 0) + n) * 100) / 100;
};
export function moneyText(m: Money) {
  const parts = Object.entries(m)
    .filter(([, n]) => n !== 0)
    .sort()
    .map(([c, n]) => `${n.toFixed(2)} ${c}`);
  return parts.length ? parts.join(" + ") : "0";
}
function epcText(m: Money, clicks: number) {
  if (!clicks) return "-";
  const parts = Object.entries(m)
    .filter(([, n]) => n !== 0)
    .sort()
    .map(([c, n]) => `${(n / clicks).toFixed(3)} ${c}`);
  return parts.length ? parts.join(" + ") : "0";
}

export type Row = { key: string; byPeriod: Record<string, number>; clicks: number; tagged: number; earned: Money };
export type Dimension = "store" | "programme" | "country" | "page" | "swap";

export type Report = {
  by: "day" | "week";
  periods: string[];
  clicks: number;
  tagged: number;
  earned: Money;
  /** Earnings whose click ID matched no click in the window (an older click, or no sub-ID came back). */
  unmatched: Money;
  sales: number;
  tables: Record<Dimension, Row[]>;
  /** Untagged clicks by store, most first, with the programme that would tag them. */
  leaks: { store: string; untagged: number; share: number; ofStore: number; network: string; programme: string | null; signup: string | null }[];
};

/**
 * Sales from the database (postbacks) and from export files, one per network order: an export row wins over the
 * postback for the same order, being the network's later word. Reversed sales are dropped.
 */
export function mergeEarnings(fromDb: Earning[], fromExports: Earning[]) {
  const byOrder = new Map<string, Earning>();
  for (const e of [...fromDb, ...fromExports]) byOrder.set(`${e.network}:${e.orderId}`, e);
  return [...byOrder.values()].filter((e) => e.status !== "reversed");
}

export function buildReport(clicks: ClickRow[], earnings: Earning[], opts: { by: "day" | "week"; isKit?: (slug: string) => boolean; title?: (slug: string) => string }): Report {
  const periods = [...new Set(clicks.map((c) => periodOf(c.createdAt, opts.by)))].sort();
  const byClick = new Map<string, Earning[]>();
  for (const e of earnings) if (e.clickId) (byClick.get(e.clickId) ?? byClick.set(e.clickId, []).get(e.clickId)!).push(e);
  const tables = { store: new Map(), programme: new Map(), country: new Map(), page: new Map(), swap: new Map() } as Record<Dimension, Map<string, Row>>;
  const earned: Money = {};
  const unmatched: Money = {};
  const matched = new Set<Earning>();
  let tagged = 0;
  const untaggedByStore = new Map<string, number>();
  const clicksByStore = new Map<string, number>();
  for (const c of clicks) {
    const period = periodOf(c.createdAt, opts.by);
    const store = clickStore(c.retailer, c.host);
    const keys: Record<Dimension, string> = {
      store,
      programme: c.program ?? "untagged",
      country: c.country ?? "unknown",
      page: pageTypeOf(c, opts.isKit),
      swap: opts.title?.(c.slug) ?? c.slug,
    };
    const sales = c.clickId ? (byClick.get(c.clickId) ?? []) : [];
    if (c.program) tagged++;
    else untaggedByStore.set(store, (untaggedByStore.get(store) ?? 0) + 1);
    clicksByStore.set(store, (clicksByStore.get(store) ?? 0) + 1);
    for (const e of sales) {
      if (matched.has(e)) continue;
      matched.add(e);
      addMoney(earned, e.currency, e.commission);
    }
    for (const dim of Object.keys(keys) as Dimension[]) {
      const t = tables[dim];
      const row = t.get(keys[dim]) ?? { key: keys[dim], byPeriod: {}, clicks: 0, tagged: 0, earned: {} };
      row.byPeriod[period] = (row.byPeriod[period] ?? 0) + 1;
      row.clicks++;
      if (c.program) row.tagged++;
      for (const e of sales) addMoney(row.earned, e.currency, e.commission);
      t.set(keys[dim], row);
    }
  }
  for (const e of earnings) if (!matched.has(e)) addMoney(unmatched, e.currency, e.commission);
  const allUntagged = clicks.length - tagged;
  const leaks = [...untaggedByStore.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([store, n]) => {
      const p = programmeOf(store);
      return { store, untagged: n, share: allUntagged ? n / allUntagged : 0, ofStore: n / (clicksByStore.get(store) ?? n), network: p.network, programme: p.programme ?? null, signup: signupOf(p) };
    });
  const sorted = Object.fromEntries(
    (Object.keys(tables) as Dimension[]).map((d) => [d, [...tables[d].values()].sort((a, b) => b.clicks - a.clicks || a.key.localeCompare(b.key))]),
  ) as Record<Dimension, Row[]>;
  return { by: opts.by, periods, clicks: clicks.length, tagged, earned, unmatched, sales: earnings.length, tables: sorted, leaks };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const LABEL: Record<Dimension, string> = { store: "Store", programme: "Programme", country: "Shopper's country", page: "Page", swap: "Swap or kit" };

/** The report as Markdown: readable in a terminal, pastes into an issue. */
export function renderReport(r: Report, opts: { since: string; until: string; top: number; exportFiles: number; problems: string[] }) {
  const out: string[] = [];
  const periods = r.periods.slice(-8);
  const hidden = r.periods.length - periods.length;
  out.push(`# Revenue report, ${opts.since} to ${opts.until}`, "");
  out.push(
    `${r.clicks} outbound clicks, ${r.tagged} tagged (${r.clicks ? pct(r.tagged / r.clicks) : "0%"}), ${r.clicks - r.tagged} untagged. ` +
      `Earned from matched clicks: ${moneyText(r.earned)}${r.clicks ? `, ${epcText(r.earned, r.clicks)} per click` : ""}. ` +
      `${r.sales} sale(s) known; not matched to a click in this window: ${moneyText(r.unmatched)}.`,
    "",
  );
  out.push(`Commission exports read: ${opts.exportFiles} file(s). Reversed and declined sales are left out. Amounts in different currencies are never added together.`);
  for (const p of opts.problems) out.push(`- ${p}`);
  out.push("");
  if (!r.clicks) {
    out.push("No outbound clicks in this window.");
    return out.join("\n");
  }
  out.push("## Money left on the table: untagged clicks by store", "");
  out.push("Join the programme at the top first. Network and sign-up page from data/sellers/programmes.json.", "");
  out.push("| Store | Untagged | Share of untagged | Of the store's clicks | Network | Programme | Sign up |", "|---|---:|---:|---:|---|---|---|");
  for (const l of r.leaks.slice(0, opts.top)) out.push(`| ${l.store} | ${l.untagged} | ${pct(l.share)} | ${pct(l.ofStore)} | ${l.network} | ${l.programme ?? "-"} | ${l.signup ?? "-"} |`);
  if (!r.leaks.length) out.push("| (every click was tagged) | | | | | | |");
  out.push("");
  for (const dim of ["store", "programme", "country", "page", "swap"] as Dimension[]) {
    out.push(`## By ${LABEL[dim].toLowerCase()}, per ${r.by}${hidden ? ` (last ${periods.length} ${r.by}s shown; totals cover all)` : ""}`, "");
    out.push(`| ${LABEL[dim]} | ${periods.join(" | ")} | Clicks | Tagged | Earned | Per click |`, `|---|${periods.map(() => "---:").join("|")}|---:|---:|---:|---:|`);
    for (const row of r.tables[dim].slice(0, opts.top)) {
      out.push(`| ${row.key} | ${periods.map((p) => row.byPeriod[p] ?? 0).join(" | ")} | ${row.clicks} | ${pct(row.tagged / row.clicks)} | ${moneyText(row.earned)} | ${epcText(row.earned, row.clicks)} |`);
    }
    if (r.tables[dim].length > opts.top) out.push(`| ${r.tables[dim].length - opts.top} more | ${periods.map(() => "").join(" | ")} | | | | |`);
    if (!r.tables[dim].length) out.push(`| (no clicks) | ${periods.map(() => "").join(" | ")} | | | | |`);
    out.push("");
  }
  return out.join("\n");
}

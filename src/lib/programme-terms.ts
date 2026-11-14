/**
 * What each affiliate programme's own terms let us show, driven only by the registry (data/sellers/programmes.json
 * `terms`, a network's terms under `networks`). No store is named in code: a programme whose terms set a rule gets it,
 * every other store is left as it is. The rules and the clauses behind them are in docs/research/R11-programme-terms.md.
 *
 * The catalogue build applies the rules once (scripts/build-catalog.ts), so every page, card, email and feed reads the
 * same result:
 *  - `prices`: a price for the store's products is shown only when it came from the programme's own feed (or API) no
 *    more than maxAgeHours before the build. Otherwise the side is withheld: pages say "see the price at <store>" with
 *    the day we last checked, and no saving that depends on it is shown or ranked.
 *  - `priceHistory: false`: the side keeps no price history.
 *  - `images: "programme"`: the side shows no photo of ours.
 *
 * When the rules apply: a programme's terms bind its members, so its display rules switch on by themselves the moment
 * the site is built as a member, which is when the programme's affiliate setting (AFF_*, the Amazon tag) or a
 * PRICE_FEED_URLS line for the store is present. Until then the site shows the prices we checked ourselves.
 *  - PROGRAMME_TERMS_ON: a comma list of registry store ids ("walmart,amazon") or "all" applies those programmes' rules
 *    before joining, to see the site as the programme will require it: `PROGRAMME_TERMS_ON=walmart npm run build`.
 *  - PROGRAMME_TERMS_OFF: the same list form, leaves rules off even for a joined programme. Only for comparing builds;
 *    never deploy a build made with it.
 * Both are read when the catalogue is built. docs/affiliate-application-checklist.md walks through it.
 *
 * Pure: no server-only imports, so the build script, pages and tests share it.
 */
import { livePrograms } from "./affiliate-links";
import { linkStore, NETWORK_TERMS, PROGRAMME_REGISTRY, programmeOf, TERM_RULES, type ProgrammeTerms } from "./programmes";
import type { DatePrecision, PriceSeen } from "./freshness";

type Side = { retailer: string; url?: string | null };

export type Rules = Omit<ProgrammeTerms, "source" | "quote" | "checked" | "clauses"> & {
  /** The registry store id these rules come from. */
  store: string;
  /** The network the programme runs on, which its feed rows must come from. */
  network: string;
};

const idList = (raw: string | undefined): Set<string> | "all" => {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "all" ? "all" : new Set(v.split(/[\s,]+/).filter(Boolean));
};

/** Whether this build is a member of the store's programme: its affiliate setting or a feed line for it is present. */
export function joined(store: string, env: Record<string, string | undefined> = process.env): boolean {
  const entry = programmeOf(store);
  if ((env.PRICE_FEED_URLS ?? "").toLowerCase().includes(`:${store}@`)) return true;
  return livePrograms(env).some((p) => p.id === entry.programme || (entry.network === "amazon" && p.network === "amazon"));
}

/**
 * Store ids whose display rules are off for this build, or "all": every programme not joined (unless
 * PROGRAMME_TERMS_ON names it), plus whatever PROGRAMME_TERMS_OFF names.
 */
export function termsOff(env: Record<string, string | undefined> = process.env): Set<string> | "all" {
  const off = idList(env.PROGRAMME_TERMS_OFF);
  if (off === "all") return "all";
  const on = idList(env.PROGRAMME_TERMS_ON);
  if (on === "all") return off;
  for (const store of Object.keys(PROGRAMME_REGISTRY)) if (!on.has(store) && !joined(store, env)) off.add(store);
  return off;
}

const isOff = (store: string, off: Set<string> | "all") => off === "all" || off.has(store);

/**
 * The rules for the store a link opens, in this market: the network's terms with the store's own on top. Null when
 * the programme has no rules, doesn't pay for this market (walmart.ca is another programme), or is switched off.
 */
export function rulesFor(side: Side, market: string, off: Set<string> | "all" = termsOff()): Rules | null {
  const store = linkStore({ retailer: side.retailer, url: side.url ?? null });
  const entry = programmeOf(store);
  if (entry.markets.length && !entry.markets.includes(market)) return null;
  if (isOff(store, off)) return null;
  const network = NETWORK_TERMS[entry.network];
  const merged: Rules = { store, network: entry.network };
  for (const rule of TERM_RULES) {
    const value = entry.terms?.[rule] ?? network?.[rule];
    if (value !== undefined) (merged as Record<string, unknown>)[rule] = value;
  }
  return Object.keys(merged).length > 2 ? merged : null;
}

/** A side whose price we may not show: which store, which rule, and the day we last checked it ourselves. */
export type Withheld = { store: string; only: "feed" | "api"; date: string; precision: DatePrecision };

const DAY_MS = 86_400_000;

/** Hours from an ISO day to the build day. A day-precise reading counts from the start of its day. */
function hoursSince(day: string, buildDay: string) {
  return (Date.parse(`${buildDay}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / (DAY_MS / 24);
}

/**
 * Whether this side's price must be withheld. A feed rule is met by a reading from that programme's own network feed
 * seen within maxAgeHours of the build day; we read no programme's API, so an "api" rule is never met yet.
 */
export function priceWithheld(side: Side, seen: Pick<PriceSeen, "date" | "precision" | "feed">, market: string, buildDay: string, off?: Set<string> | "all"): Withheld | null {
  const rules = rulesFor(side, market, off);
  const rule = rules?.prices;
  if (!rules || !rule) return null;
  const feed = seen.feed;
  if (rule.only === "feed" && feed && feed.network === rules.network && hoursSince(feed.seen, buildDay) < rule.maxAgeHours) return null;
  return { store: rules.store, only: rule.only, date: seen.date, precision: seen.precision };
}

/** Whether the store's terms bar price history (a chart or table of past prices) for this side. */
export function historyBarred(side: Side, market: string, off?: Set<string> | "all") {
  return rulesFor(side, market, off)?.priceHistory === false;
}

/** Whether the store's terms allow only its own product images, so our photo of this side is left out. */
export function photoBarred(side: Side, market: string, off?: Set<string> | "all") {
  return rulesFor(side, market, off)?.images === "programme";
}

/** The notice a programme wants beside a price we do show for it, or null. */
export function priceNoticeFor(side: Side, market: string, off?: Set<string> | "all") {
  return rulesFor(side, market, off)?.priceNotice ?? null;
}

/** Whether a link to this side is one the store's terms bar (its pharmacy, say). */
export function barredPath(side: Side, market: string, off?: Set<string> | "all") {
  const paths = rulesFor(side, market, off)?.barredPaths;
  if (!paths?.length || !side.url) return false;
  let path: string;
  try {
    path = new URL(side.url).pathname.toLowerCase();
  } catch {
    return false;
  }
  return paths.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Whether a record may go out by email at all. "none" bars the store's name, products and links without its written
 * permission, so a record with a side there is left out of letters and wish answers. Our emails link only to our own
 * pages, never a store, so "no-links" and "opt-in" are already met.
 */
export function emailAllowed(sides: Side[], market: string, off?: Set<string> | "all") {
  return sides.every((s) => rulesFor(s, market, off)?.email !== "none");
}

/** Whether the word "dupe" may be used to compare these sides. */
export function dupeWordAllowed(sides: Side[], market: string, off?: Set<string> | "all") {
  return sides.every((s) => rulesFor(s, market, off)?.dupeWording !== false);
}

/** The disclosure a store's terms ask for beside or about its links, or null. */
export function disclosureFor(side: Side, market: string, off?: Set<string> | "all") {
  return rulesFor(side, market, off)?.disclosure ?? null;
}

type Mailable = { market: string; withheld?: object | string[] };

const anyWithheld = (w: Mailable["withheld"]) => !!w && Object.keys(w).length > 0;

/**
 * Whether a swap may go out by email: every price shown (a letter quotes the saving) and neither store's terms bar
 * email. Letters, wish answers and the like leave anything else out.
 */
export function pairMailable(p: Mailable & { brand: Side; alternative: Side }, off?: Set<string> | "all") {
  return !anyWithheld(p.withheld) && emailAllowed([p.brand, p.alternative], p.market, off);
}

/** The same for a kit: its own link and every piece. */
export function kitMailable(k: Mailable & { bundle: Side; components: Side[] }, off?: Set<string> | "all") {
  return !anyWithheld(k.withheld) && emailAllowed([k.bundle, ...k.components], k.market, off);
}

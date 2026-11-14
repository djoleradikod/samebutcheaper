/**
 * Reading the prices a programme's terms withhold (src/lib/programme-terms.ts, applied by the catalogue build) on a
 * page: whether a record may show its figures, and which stores to name instead.
 */
import { linkStoreName } from "./affiliate";
import { checkedDate } from "./freshness";
import { listWords } from "./i18n/format";
import type { Lang } from "./i18n/lang";
import { getT } from "./i18n";
import { priceNoticeFor } from "./programme-terms";
import type { Bundle, Pair, Preset } from "./types";

/** Whether every price on the record may be shown, and so its saving. */
export function priced(record: { withheld?: object | string[] }) {
  return !record.withheld || (Array.isArray(record.withheld) ? record.withheld.length === 0 : Object.keys(record.withheld).length === 0);
}

/** Whether this one side's price may be shown. */
export function sidePriced(pair: Pair, side: "brand" | "alternative") {
  return !pair.withheld?.[side];
}

/** "Walmart", "Walmart and Amazon": the stores whose terms withhold a swap's prices. */
export function withheldStores(pair: Pair, lang: Lang = "en") {
  const names = (["alternative", "brand"] as const).filter((s) => pair.withheld?.[s]).map((s) => linkStoreName(pair[s]));
  return listWords([...new Set(names)], lang);
}

/** The same for a kit: its own link and its pieces. */
export function kitWithheldStores(b: Bundle, lang: Lang = "en") {
  const w = b.withheld ?? {};
  const names = [...(w.kit ? [linkStoreName(b.bundle)] : []), ...b.components.filter((c) => w[`item-${c.replaces}`]).map((c) => linkStoreName(c))];
  return listWords([...new Set(names)], lang);
}

/** The same for a basket, from its withheld swaps. */
export function basketWithheldStores(preset: Preset, pairs: (slug: string) => Pair | undefined, lang: Lang = "en") {
  const names = (preset.withheld ?? []).flatMap((slug) => {
    const p = pairs(slug);
    return p ? (["alternative", "brand"] as const).filter((s) => p.withheld?.[s]).map((s) => linkStoreName(p[s])) : [];
  });
  return listWords([...new Set(names)], lang);
}

/** "Last checked by us: 3 Nov 2026" for a withheld side. */
export function withheldChecked(pair: Pair, side: "brand" | "alternative", lang: Lang = "en") {
  const w = pair.withheld?.[side];
  return w ? getT(lang)("terms.lastChecked", checkedDate(w.date, w.precision, lang)) : null;
}

/** The notices programmes want beside prices we do show on this swap, one per store. */
export function priceNotices(pair: Pair, lang: Lang = "en") {
  const t = getT(lang);
  const out: string[] = [];
  for (const side of ["alternative", "brand"] as const) {
    if (!sidePriced(pair, side)) continue;
    const notice = priceNoticeFor(pair[side], pair.market);
    if (notice) out.push(t(`terms.notice.${notice}`, linkStoreName(pair[side])));
  }
  return [...new Set(out)];
}

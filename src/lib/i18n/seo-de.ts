/**
 * German titles and descriptions for kit and basket pages under /de, the twins of bundleTitle, bundleDescription,
 * basketTitle and basketDescription in ../seo.ts (which stay as they are for English). They use the record's German
 * text when it has some, and fit the same limits.
 */
import { clip, fitSentences, TITLE_MAX } from "../seo";
import type { Bundle, Preset } from "../types";
import { formatPercent, monthDe } from "./format";

/** "zu deutschen Preisen": a market's prices, dative. */
const PRICES: Record<string, string> = { US: "US-Preisen", GB: "britischen Preisen", CA: "kanadischen Preisen", DE: "deutschen Preisen", IE: "irischen Preisen" };

const pct = (n: number) => formatPercent(n, "de");

/** The kit's short name: its German name when it has one, up to the first comma or bracket. */
function kitName(b: Pick<Bundle, "bundle" | "de">) {
  return (b.de?.name ?? b.bundle.name).split(/,\s|\s\(/)[0].trim();
}

export function bundleTitleDe(b: Pick<Bundle, "bundle" | "netSavingsPct" | "de">) {
  const name = kitName(b);
  // 0: a store's affiliate terms withhold the prices (src/lib/programme-terms.ts), so no figure is quoted.
  const tail = b.netSavingsPct > 0 ? ` für ${pct(b.netSavingsPct)} weniger nachgebaut` : " aus günstigeren Teilen nachgebaut";
  return name.length + tail.length <= TITLE_MAX ? `${name}${tail}` : clip(name, TITLE_MAX);
}

export function bundleDescriptionDe(b: Pick<Bundle, "bundle" | "netSavingsPct" | "market" | "price_checked" | "components" | "de">) {
  const n = b.components.length;
  return fitSentences([
    `${kitName(b)}, nachgebaut aus ${n} günstigeren ${n === 1 ? "Produkt" : "Produkten"} für dieselbe Menge.`,
    ...(b.netSavingsPct > 0 ? [`${pct(b.netSavingsPct)} weniger nach Versand, zu ${PRICES[b.market]}, geprüft im ${monthDe(b.price_checked)}.`] : []),
    "Jedes Teil mit seinen Quellen.",
  ]);
}

export function basketTitleDe(p: Pick<Preset, "title" | "savingsPct" | "de">) {
  const title = p.de?.title ?? p.title;
  const t = p.savingsPct > 0 ? `${title}: derselbe Einkauf für ${pct(p.savingsPct)} weniger` : title;
  return t.length <= TITLE_MAX ? t : clip(title, TITLE_MAX);
}

export function basketDescriptionDe(p: Pick<Preset, "audience" | "lines" | "savingsPct" | "market" | "de">) {
  const n = p.lines.length;
  return fitSentences([
    `${p.de?.audience ?? p.audience}.`,
    p.savingsPct > 0
      ? `${n} Markenprodukte und für jedes ein günstigerer Vergleich: dieselbe Menge für ${pct(p.savingsPct)} weniger, zu ${PRICES[p.market]}.`
      : `${n} Markenprodukte und für jedes ein günstigerer Vergleich.`,
  ]);
}

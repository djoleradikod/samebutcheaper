import type { Pair } from "@/lib/types";
import { packSize, unitLabel } from "@/lib/unit-format";
import type { Lang } from "@/lib/i18n";
import { savingKind, type SavingKind, type SwapPrices } from "@/lib/yearly";
import { YearlySaving } from "./YearlySaving";

/** What a swap's yearly figure needs, read from its record. Shared by the swap page and My list. */
export function yearlyFields(pair: Pair, lang: Lang = "en"): { kind: SavingKind; prices: SwapPrices; pack: string; per: string } {
  const { brand: b, alternative: a } = pair;
  return {
    kind: savingKind({ category: pair.category, unit: b.unit, size: b.size, products: [b.product, a.product] }),
    prices: { brandPrice: b.price, brandSize: b.size, altPrice: a.price, altSize: a.size },
    pack: packSize(b.size, b.unit, lang),
    per: unitLabel(b.unit, lang),
  };
}

/** The swap page's yearly saving. Renders inside the page's CountryPart, since it shows money. */
export function YearlyBlock({ pair, lang = "en" }: { pair: Pair; lang?: Lang }) {
  return <YearlySaving slug={pair.slug} currency={pair.currency} brand={pair.brand.brand} {...yearlyFields(pair, lang)} />;
}

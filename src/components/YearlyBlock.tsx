import type { Pair } from "@/lib/types";
import { packSize, unitDisplay } from "@/lib/unit-format";
import { savingKind, type SavingKind, type SwapPrices } from "@/lib/yearly";
import { YearlySaving } from "./YearlySaving";

/** What a swap's yearly figure needs, read from its record. Shared by the swap page and My list. */
export function yearlyFields(pair: Pair): { kind: SavingKind; prices: SwapPrices; pack: string; per: string } {
  const { brand: b, alternative: a } = pair;
  return {
    kind: savingKind({ category: pair.category, unit: b.unit, size: b.size, products: [b.product, a.product] }),
    prices: { brandPrice: b.price, brandSize: b.size, altPrice: a.price, altSize: a.size },
    pack: packSize(b.size, b.unit),
    per: unitDisplay(b.unit).label,
  };
}

/** The swap page's yearly saving. Renders inside the page's CountryPart, since it shows money. */
export function YearlyBlock({ pair }: { pair: Pair }) {
  return <YearlySaving slug={pair.slug} currency={pair.currency} brand={pair.brand.brand} {...yearlyFields(pair)} />;
}

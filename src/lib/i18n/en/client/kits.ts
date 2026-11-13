import { s } from "./util";
import type { KitSort } from "../../../kit-filter";

/** Kit and basket cards and the kit filters (BundleCard.tsx, BasketCard.tsx, KitFilters.tsx). */
export const kits = {
  itemsStores: (items: number, stores: number) => `${items} item${s(items)}, ${stores} store${s(stores)}`,
  insteadOf: (brand: string) => `Instead of the ${brand} kit`,
  andMore: (n: number) => `and ${n} more`,
  kit: "Kit",
  builtYourself: "built yourself",
  costsMore: "Costs more today than the kit",
  smallSaving: "Small saving after delivery",
  saves: "Saves",
  beforeDelivery: "before unchecked delivery",
  afterDelivery: "after delivery",
  oneOrderAt: (store: string) => `One order at ${store}`,
  oneStore: "One store",
  stores: (n: number) => `${n} stores`,
  filterSort: "Filter and sort kits",
  oneStoreOnly: "One store only",
  aisle: "Aisle",
  allAisles: "All aisles",
  sortKits: "Sort kits",
  sorts: { recommended: "Best first", amount: "Most saved after delivery", pct: "Biggest % saved after delivery" } as Record<KitSort, string>,
  count: (n: number) => `${n} kit${s(n)}`,
  noOneStore: "No kit here comes from one store.",
  showEvery: "Show every kit",
  /** The note on a card whose record text has no translation yet. Never shown in English. */
  inEnglish: "",
};

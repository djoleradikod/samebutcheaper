import type { Metadata } from "next";
import { packText } from "@/components/BulkBox";
import { browseProps, ListLinks, ShelfHead } from "@/components/ShelfParts";
import { atStore } from "@/lib/affiliate";
import { MEDICINE, type BrowseRow } from "@/lib/browse";
import { getAllPairs } from "@/lib/catalog";
import { money, monthYear } from "@/lib/format";
import type { Pair } from "@/lib/types";
import { unitDisplay, unitPriceFine } from "@/lib/unit-format";
import { BulkList, type BulkItem } from "./BulkList";

export const metadata: Metadata = {
  title: "Buy in bulk: is the bigger pack worth it?",
  description:
    "Cheaper products with a bigger pack on file: the unit price against the normal pack, how much less it costs per unit, and how long it keeps.",
  alternates: { canonical: "/bulk" },
};

/** The figures and wording BulkBox shows for the bigger pack, ready to send to the browser. */
function toItem(p: Pair): Omit<BulkItem, keyof BrowseRow> {
  const { brand: b, alternative: a, bulkView, shelfLife: shelf, currency } = p;
  const bigger = bulkView.bigger!;
  return {
    kind: p.subcategory.replace(/\s+-\s+/g, ": "),
    brandName: b.brand,
    brandProduct: b.product,
    brandImage: b.photo?.src ?? null,
    altName: a.brand,
    altProduct: a.product,
    altImage: a.photo?.src ?? null,
    biggerProduct: bigger.product,
    unitLabel: unitDisplay(a.unit).label,
    normalUnitPrice: unitPriceFine(a.ppu, a.unit, currency),
    biggerUnitPrice: unitPriceFine(bigger.ppu, a.unit, currency),
    normalPack: packText(a.size, a.unit),
    biggerPack: packText(bigger.size, a.unit),
    normalPrice: money(a.price, currency),
    biggerPrice: money(bigger.price, currency),
    biggerPriceValue: bigger.price,
    biggerUrl: bigger.url,
    biggerAt: atStore(bigger.retailer),
    extraSavingPct: bigger.extraSavingPct,
    advice: shelf?.advice ?? null,
    unopened: shelf?.unopened ?? "",
    opened: shelf?.opened ?? "",
  };
}

export default function BulkPage() {
  // Medicine pages carry a health note that this list doesn't, as on the home page's bulk section.
  const pairs = getAllPairs().filter((p) => p.bulkView.bigger && p.category !== MEDICINE);
  const { rows } = browseProps(pairs);
  const items: BulkItem[] = pairs
    .map((p, i) => ({ ...rows[i], ...toItem(p) }))
    // Photo tiers first, as on every other list, then the biggest extra saving.
    .sort((a, b) => a.tier - b.tier || b.extraSavingPct - a.extraSavingPct || a.slug.localeCompare(b.slug));
  const latest = pairs.reduce((newest, p) => (p.price_checked > newest ? p.price_checked : newest), "");

  return (
    <div className="bg-canvas pb-8 md:pb-10">
      <ShelfHead
        crumbs={[{ href: "/", label: "Home" }, { label: "Buy in bulk" }]}
        title="Buy in bulk: is the bigger pack worth it?"
        intro="A bigger pack only saves money if you use it before it goes off. Each swap here has a bigger pack of the cheaper product, with its unit price against the normal pack, how much less it costs per unit, and how long it keeps where we have a record."
        facts={
          <>
            {latest && <>Prices last checked {monthYear(latest)}.</>}
            <ListLinks />
          </>
        }
      />
      <div className="container-page">
        <BulkList items={items} />
      </div>
    </div>
  );
}

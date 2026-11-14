import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { packText } from "@/components/BulkBox";
import { CountryPart } from "@/components/ForCountry";
import { browseProps, ListLinks, ShelfHead } from "@/components/ShelfParts";
import { atStore } from "@/lib/affiliate";
import { MEDICINE, type BrowseRow } from "@/lib/browse";
import { getAllPairs } from "@/lib/catalog";
import { monthYear } from "@/lib/format";
import { forCountry, type Local } from "@/lib/localize";
import { APPROX_USD } from "@/lib/markets";
import type { Pair } from "@/lib/types";
import { unitDisplay } from "@/lib/unit-format";
import { BulkList, type BulkItem } from "./BulkList";

export const metadata: Metadata = {
  title: "Buy in bulk: is the bigger pack worth it?",
  description:
    "Cheaper products with a bigger pack on file: the unit price against the normal pack, how much less it costs per unit, and how long it keeps.",
  alternates: { canonical: "/bulk" },
};

/** The figures and wording BulkBox shows for the bigger pack, ready to send to the browser. */
function toItem(p: Pair, local: Local): Omit<BulkItem, keyof BrowseRow> {
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
    normalUnitPrice: local.unitFine(a.ppu, a.unit, currency),
    biggerUnitPrice: local.unitFine(bigger.ppu, a.unit, currency),
    normalPack: packText(a.size, a.unit),
    biggerPack: packText(bigger.size, a.unit),
    normalPrice: local.money(a.price, currency),
    biggerPrice: local.money(bigger.price, currency),
    biggerPriceUsd: bigger.price * APPROX_USD[currency],
    // Empty when that store doesn't sell in the selected country: the row then names no store.
    biggerUrl: local.sells(bigger.retailer, p.market) ? bigger.url : "",
    biggerAt: atStore(bigger.retailer, bigger.url),
    extraSavingPct: bigger.extraSavingPct,
    packSaving: local.money((a.price / a.size) * bigger.size - bigger.price, currency),
    againstBrandPct: Math.round((1 - bigger.ppu / b.ppu) * 100),
    advice: shelf?.advice ?? null,
    unopened: shelf?.unopened ?? "",
    opened: shelf?.opened ?? "",
  };
}

/** Medicine pages carry a health note that this list doesn't, as on the home page's bulk section. */
function bulkPairs(local: Local) {
  // A swap whose prices a store's affiliate terms withhold (src/lib/programme-terms.ts) has no saving to buy in bulk.
  return forCountry(getAllPairs(), local).filter((p) => p.bulkView.bigger && !p.withheld && p.category !== MEDICINE);
}

export default function BulkPage() {
  return (
    <div className="bg-canvas pb-8 md:pb-10">
      <ShelfHead
        crumbs={[{ href: "/", label: "Home" }, { label: "Buy in bulk" }]}
        title="Buy in bulk: is the bigger pack worth it?"
        intro="A bigger pack only saves money if you use it before it goes off. Each row shows the unit price, what you pay up front, what that saves and how long it keeps."
        facts={
          <>
            <CountryPart fallback={null}>
              {(local) => {
                const latest = bulkPairs(local).reduce((newest, p) => (p.price_checked > newest ? p.price_checked : newest), "");
                return latest && <>Prices last checked {monthYear(latest)}.</>;
              }}
            </CountryPart>
            <ListLinks />
            <Link href="/why#advice-stock_up" className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2 md:min-h-0">
              Shelf lives, with sources
            </Link>
          </>
        }
      />
      <div className="container-page">
        <CountryPart>
          {(local) => {
            const pairs = bulkPairs(local);
            const { rows } = browseProps(pairs, { local });
            const items: BulkItem[] = pairs.map((p, i) => ({ ...rows[i], ...toItem(p, local) }));
            return <BulkList items={items} />;
          }}
        </CountryPart>
      </div>
    </div>
  );
}

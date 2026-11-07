import type { Metadata } from "next";
import { getIngredients, type IngredientEntry } from "@/lib/catalog";
import { AzIndex, bestSaving, ListLinks, ShelfHead, type IndexEntry } from "@/components/ShelfParts";
import { forCountry, type Local } from "@/lib/localize";
import { CountryPart } from "@/components/ForCountry";

export const metadata: Metadata = {
  title: "Browse by ingredient",
  description: "Find the cheapest product with the exact active ingredient you need, with the sources for each.",
  alternates: { canonical: "/ingredients" },
};

/** The cheaper product's photo where we have one, else the brand's. */
function toEntry(i: IngredientEntry): IndexEntry {
  const alt = i.pairs.find((p) => p.alternative.photo);
  const own = i.pairs.find((p) => p.brand.photo);
  const first = i.pairs[0];
  return {
    key: i.slug,
    href: `/ingredient/${i.slug}`,
    name: i.name,
    count: i.pairs.length,
    best: bestSaving(i.pairs),
    category: first?.category,
    unit: first?.alternative.unit,
    photo: alt?.alternative.photo?.src ?? own?.brand.photo?.src ?? null,
    photoName: alt?.alternative.product ?? own?.brand.product ?? i.name,
  };
}

function ingredientsFor(local: Local) {
  return getIngredients()
    .map((i) => ({ ...i, pairs: forCountry(i.pairs, local) }))
    .filter((i) => i.pairs.length > 0);
}

export default function IngredientsPage() {
  return (
    <div className="bg-canvas pb-8 md:pb-10">
      <ShelfHead
        crumbs={[{ href: "/", label: "Home" }, { label: "Ingredients" }]}
        title={
          <>
            Cheaper swaps by ingredient
            <CountryPart fallback={null}>
              {(local) => {
                const n = ingredientsFor(local).length;
                return `: ${n} ingredient${n === 1 ? "" : "s"}`;
              }}
            </CountryPart>
          </>
        }
        intro="Know what's on the label? Pick the ingredient to see every brand we've checked with it, and the cheaper product beside each."
        facts={<ListLinks />}
      />
      <div className="container-page">
        <CountryPart>
          {(local) => {
            const ingredients = ingredientsFor(local);
            return ingredients.length ? <AzIndex entries={ingredients.map(toEntry)} /> : <p className="card p-5">No ingredients listed yet.</p>;
          }}
        </CountryPart>
      </div>
    </div>
  );
}

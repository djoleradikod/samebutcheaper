import { ListSchema } from "@/components/ListSchema";
import { MEDICINE } from "@/lib/browse";
import { getAllPairs, getBrands, getIngredient, getIngredients } from "@/lib/catalog";
import { oneOfEachSwap } from "@/lib/localize";
import { withCountry } from "@/lib/country-url";
import { getT, type Lang } from "@/lib/i18n";

/**
 * BreadcrumbList and ItemList for the hubs whose lists render per country. These are static, so they list one record of
 * each swap whatever the shopper's country, and name pages, never prices. Each page adds one line for its own.
 */

export function IngredientSchema({ slug }: { slug: string }) {
  const ing = getIngredient(slug);
  if (!ing) return null;
  return (
    <ListSchema
      name={`Cheapest ${ing.name}`}
      path={`/ingredient/${ing.slug}`}
      crumbs={[{ name: "Ingredients", path: "/ingredients" }]}
      items={oneOfEachSwap(ing.pairs)
        .sort((a, b) => b.savingsPct - a.savingsPct)
        .map((p) => ({ name: p.title, path: `/compare/${p.slug}` }))}
    />
  );
}

/** The everyday list, as the page shows it: medicine is left out, biggest saving first. */
export function BiggestSavingsSchema({ lang = "en" }: { lang?: Lang }) {
  if (lang !== "en") {
    // The German view lists Germany's swaps, at their /de addresses.
    const german = getAllPairs().filter((p) => p.market === "DE" && p.category !== MEDICINE);
    return (
      <ListSchema
        name={getT(lang)("lists.biggest.title")}
        path={withCountry("/biggest-savings", "DE")}
        crumbs={[]}
        items={german.sort((a, b) => b.savingsPct - a.savingsPct).map((p) => ({ name: p.title, path: withCountry(`/compare/${p.slug}`, "DE") }))}
        lang={lang}
      />
    );
  }
  const pairs = oneOfEachSwap(getAllPairs()).filter((p) => p.category !== MEDICINE);
  return (
    <ListSchema
      name="Biggest savings"
      path="/biggest-savings"
      crumbs={[]}
      items={[...pairs].sort((a, b) => b.savingsPct - a.savingsPct).map((p) => ({ name: p.title, path: `/compare/${p.slug}` }))}
    />
  );
}

export function BrandsSchema() {
  return (
    <ListSchema
      name="Cheaper swaps by brand"
      path="/brands"
      crumbs={[]}
      items={getBrands().map((b) => ({ name: `Cheaper alternatives to ${b.name}`, path: `/brand/${b.slug}` }))}
    />
  );
}

export function IngredientsSchema() {
  return (
    <ListSchema
      name="Cheaper swaps by ingredient"
      path="/ingredients"
      crumbs={[]}
      items={getIngredients().map((i) => ({ name: `Cheapest ${i.name}`, path: `/ingredient/${i.slug}` }))}
    />
  );
}

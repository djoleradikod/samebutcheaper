import type { Metadata } from "next";
import { IngredientSchema } from "@/components/HubSchemas";
import { notFound } from "next/navigation";
import { getIngredient, getIngredients, ingredientSlugFor } from "@/lib/catalog";
import { HEALTH_CATEGORIES, HealthNotice } from "@/components/Evidence";
import { atLeastOneParam, bestSaving, PriceFacts, ShelfHead, swapCount, SwapList } from "@/components/ShelfParts";
import { inSentence } from "@/lib/format";
import { forCountry, oneOfEachSwap, type Local } from "@/lib/localize";
import { ingredientDescription, ingredientTitle } from "@/lib/seo";
import { CountryPart } from "@/components/ForCountry";

export function generateStaticParams() {
  return atLeastOneParam(getIngredients().map((i) => i.slug));
}

export async function generateMetadata({ params }: PageProps<"/ingredient/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const ing = getIngredient(slug);
  if (!ing) return { title: "Ingredient not found" };
  const brands = Array.from(new Set(ing.pairs.map((p) => p.brand.brand)));
  return {
    title: ingredientTitle(ing.name, ing.pairs.some((p) => p.category === "otc-medicine")),
    description: ingredientDescription(ing.name, brands, oneOfEachSwap(ing.pairs).length),
    alternates: { canonical: `/ingredient/${ing.slug}` },
  };
}

export default async function IngredientPage({ params }: PageProps<"/ingredient/[slug]">) {
  const { slug } = await params;
  const ing = getIngredient(slug);
  if (!ing) notFound();
  return (
    <>
      <CountryPart>{(local) => <IngredientBody ing={ing} local={local} />}</CountryPart>
      <IngredientSchema slug={ing.slug} />
    </>
  );
}

function IngredientBody({ ing, local }: { ing: NonNullable<ReturnType<typeof getIngredient>>; local: Local }) {
  const pairs = forCountry(ing.pairs, local);
  const top = pairs.length ? pairs.reduce((a, b) => (b.savingsPct > a.savingsPct ? b : a)) : null;
  const strengths = Array.from(
    new Set(
      pairs.flatMap((p) =>
        p.alternative.key_ingredients.filter((k) => ingredientSlugFor(k.name) === ing.slug).map((k) => k.amount),
      ),
    ),
  )
    .filter(Boolean)
    .slice(0, 5);

  return (
    <div className="bg-canvas pb-8 md:pb-10">
      <ShelfHead
        crumbs={[{ href: "/", label: "Home" }, { href: "/ingredients", label: "Ingredients" }, { label: ing.name }]}
        title={`${ing.name}: ${swapCount(pairs.length)}`}
        intro={
          <>
            The same {inSentence(ing.name)} is sold under many names at very different prices.
            {top && (
              <>
                {" "}
                These are the brand products we&apos;ve checked that contain it, each beside a cheaper one. The biggest saving is{" "}
                {top.alternative.brand} instead of {top.brand.brand}.
              </>
            )}
            {strengths.length > 0 && <> Strengths on file: {strengths.join(", ")}.</>}
          </>
        }
        best={bestSaving(pairs)}
        facts={pairs.length > 0 && <PriceFacts pairs={pairs} />}
      />
      {pairs.some((p) => HEALTH_CATEGORIES.has(p.category)) && (
        <div className="container-page mb-4">
          <HealthNotice />
        </div>
      )}
      <div className="container-page">
        <SwapList path={`/ingredient/${ing.slug}`} pairs={pairs} />
      </div>
    </div>
  );
}

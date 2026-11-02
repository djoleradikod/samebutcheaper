import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FlaskConical } from "lucide-react";
import { getIngredient, getIngredients, ingredientSlugFor, toSummary } from "@/lib/catalog";
import { PairCard } from "@/components/PairCard";
import { inSentence, ppu } from "@/lib/format";

export function generateStaticParams() {
  return getIngredients().map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: PageProps<"/ingredient/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const ing = getIngredient(slug);
  if (!ing) return { title: "Ingredient not found" };
  const brands = Array.from(new Set(ing.pairs.map((p) => p.brand.brand))).slice(0, 3).join(", ");
  return {
    title: `${ing.name}: cheapest products with the same ingredient`,
    description: `Every brand-name product with ${ing.name} we've verified (${brands}) and the cheaper product with the same ingredient at the same strength.`,
    alternates: { canonical: `/ingredient/${ing.slug}` },
  };
}

export default async function IngredientPage({ params }: PageProps<"/ingredient/[slug]">) {
  const { slug } = await params;
  const ing = getIngredient(slug);
  if (!ing) notFound();
  const pairs = [...ing.pairs].sort((a, b) => b.savingsPct - a.savingsPct);
  const best = pairs[0];
  const amounts = Array.from(
    new Set(
      pairs.flatMap((p) =>
        p.alternative.key_ingredients.filter((k) => ingredientSlugFor(k.name) === ing.slug).map((k) => k.amount),
      ),
    ),
  ).filter(Boolean);

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="container-page py-10 md:py-14">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted">
            <Link href="/" className="hover:text-ink">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/ingredients" className="hover:text-ink">Ingredients</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-ink-2">{ing.name}</span>
          </nav>
          <div className="mt-5 flex items-start gap-4">
            <span className="hidden h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent sm:grid">
              <FlaskConical className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm font-medium text-accent">Ingredient</p>
              <h1 className="display text-4xl font-medium sm:text-5xl">{ing.name}</h1>
              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">
                The same {inSentence(ing.name)} is sold under many names at very different prices. These are the
                brand-name products containing it that we&apos;ve verified, each next to a cheaper product with the
                same ingredient at the same strength.
              </p>
              <p className="num mt-4 text-sm text-muted">
                {pairs.length} verified swap{pairs.length === 1 ? "" : "s"}
                {amounts.length ? ` · strengths: ${amounts.slice(0, 5).join(", ")}` : ""}
                {best ? ` · cheapest from ${ppu(best.alternative.ppu, best.currency)} per ${best.alternative.unit}` : ""}
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="container-page py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pairs.map((p) => (
            <PairCard key={p.slug} pair={toSummary(p)} />
          ))}
        </div>
      </section>
    </>
  );
}

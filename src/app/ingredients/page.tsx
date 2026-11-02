import type { Metadata } from "next";
import Link from "next/link";
import { getIngredients } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Browse by ingredient",
  description:
    "Find the cheapest product with the exact active ingredient you need, from loratadine to minoxidil.",
  alternates: { canonical: "/ingredients" },
};

export default function IngredientsPage() {
  const ings = [...getIngredients()].sort((a, b) => a.name.localeCompare(b.name));
  const groups = new Map<string, typeof ings>();
  for (const i of ings) {
    const letter = /[a-z]/i.test(i.name[0]) ? i.name[0].toUpperCase() : "#";
    groups.set(letter, [...(groups.get(letter) ?? []), i]);
  }
  return (
    <section className="container-page py-10 md:py-14">
      <p className="text-sm font-medium text-accent">A–Z</p>
      <h1 className="display mt-1 text-4xl font-medium sm:text-5xl">Browse by ingredient</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">
        Know what&apos;s on the label? Pick the active ingredient and we&apos;ll show you every brand we&apos;ve
        checked, and the cheapest product with the same thing inside.
      </p>
      <div className="mt-10 space-y-8">
        {[...groups.entries()].map(([letter, list]) => (
          <div key={letter} className="grid gap-3 sm:grid-cols-[3rem_1fr]">
            <h2 className="display text-3xl text-muted">{letter}</h2>
            <ul className="flex flex-wrap gap-2">
              {list.map((i) => (
                <li key={i.slug}>
                  <Link
                    href={`/ingredient/${i.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                  >
                    {i.name}
                    <span className="num text-xs text-muted">{i.pairs.length}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

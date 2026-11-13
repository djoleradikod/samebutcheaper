import { CountryPart } from "@/components/ForCountry";
import { TagLinks } from "@/components/ShelfParts";
import { brandSlugFor, getBrand, getIngredient, getPair, getRelatedPairs, ingredientSlugFor } from "@/lib/catalog";
import { CATEGORY_MAP } from "@/lib/categories";
import { dupeSlugFor } from "@/lib/dupes";
import { inSentence } from "@/lib/format";
import { getT, type Lang } from "@/lib/i18n";
import { INGREDIENT_MATCHES } from "@/lib/ingredient-key";
import { swapTitleFor } from "@/lib/seo-catalog";
import { jsonLdText } from "@/lib/site";
import { faqJsonLd, recordLocal, swapFaq, type FaqItem } from "@/lib/swap-faq";
import type { Pair } from "@/lib/types";

/**
 * The swap's questions and its neighbours, at the foot of a swap page.
 *
 * The questions without prices or stores are in the static HTML, so a crawler that runs no JavaScript reads them. The
 * shopper's own version (their currency, their stores) replaces them once their country is known. The FAQPage JSON-LD
 * carries the record's own version, in its market's currency, and only where that is word for word what the page shows:
 * to a crawler (no country, see src/proxy.ts) and to a shopper in the record's market. A converted page has none.
 *
 * The links are static too, so every swap links to its brand, ingredient, aisle, "cheaper than" page, its twin in
 * another market and a few swaps on the same shelf, whatever the shopper's country.
 */
export function SwapQuestions({ record, lang = "en" }: { record: Pair; lang?: Lang }) {
  return (
    <>
      <CountryPart fallback={<Questions items={swapFaq(record)} lang="en" />}>
        {(local) => {
          const shown = swapFaq(record, local);
          const own = swapFaq(record, recordLocal(local.lang));
          // Marked up only where the page reads the record's own words: a converted price would put a second currency in the markup.
          const same = JSON.stringify(shown) === JSON.stringify(own);
          return (
            <>
              <Questions items={shown} lang={local.lang} />
              {same && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(faqJsonLd(own)) }} />}
            </>
          );
        }}
      </CountryPart>
      <Neighbours record={record} lang={lang} />
    </>
  );
}

function Questions({ items, lang }: { items: FaqItem[]; lang: Lang }) {
  return (
    <section aria-labelledby="questions" className="container-page pt-8 md:pt-10">
      <h2 id="questions" className="display mb-3 text-[22px] md:text-2xl">
        {getT(lang)("faq.heading")}
      </h2>
      <dl className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
        {items.map((f) => (
          <div key={f.q} className="border-t border-line pt-3">
            <dt className="font-semibold">{f.q}</dt>
            <dd className="mt-1 max-w-[68ch] text-[15px] text-ink-2">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Where to go from here. The same for every country: names and pages, no prices. */
export function neighbourLinks(record: Pair, lang: Lang = "en") {
  const t = getT(lang);
  const b = record.brand;
  const cat = CATEGORY_MAP[record.category];
  const brand = getBrand(brandSlugFor(b.brand));
  const ingredients = INGREDIENT_MATCHES.has(record.match_type)
    ? [...new Set(record.alternative.key_ingredients.map((i) => ingredientSlugFor(i.name)).filter((s): s is string => !!s))]
    : [];
  const twin = record.twin ? getPair(record.twin.slug) : undefined;
  // Swaps from the same market as this one, so the page names no store it doesn't already name.
  const related = getRelatedPairs(record, 24)
    .filter((p) => p.market === record.market && p.slug !== record.twin?.slug)
    .slice(0, 4);
  return [
    // The brand, ingredient and "cheaper than" pages are English only, and say so on a German page.
    { href: `/dupe/${dupeSlugFor(record)}`, label: t("footer.englishOnly", t("faq.allCheaperMatches", b.brand)) },
    ...(brand ? [{ href: `/brand/${brand.slug}`, label: t("footer.englishOnly", t("faq.every", b.brand)) }] : []),
    ...ingredients.map((slug) => ({
      href: `/ingredient/${slug}`,
      label: t("footer.englishOnly", t("faq.cheapest", lang === "en" ? inSentence(getIngredient(slug)?.name ?? slug) : (getIngredient(slug)?.name ?? slug))),
    })),
    { href: `/category/${cat.slug}`, label: t("faq.aisle", t(`categories.${cat.slug}.name`)) },
    ...(twin ? [{ href: `/compare/${twin.slug}`, label: t("faq.twin", twin.market) }] : []),
    ...related.map((p) => ({ href: `/compare/${p.slug}`, label: swapTitleFor(p.slug, lang) ?? p.title, key: p.slug })),
  ];
}

function Neighbours({ record, lang }: { record: Pair; lang: Lang }) {
  return (
    <nav aria-labelledby="neighbours" className="container-page pt-8 pb-8 md:pt-10 md:pb-10">
      <h2 id="neighbours" className="display mb-3 text-xl md:text-[22px]">
        {getT(lang)("faq.more")}
      </h2>
      <TagLinks links={neighbourLinks(record, lang)} />
    </nav>
  );
}

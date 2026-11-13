import Link from "next/link";
import { MARKETS } from "@/lib/markets";
import { PREFIXES, COUNTRY_PREFIXES } from "@/lib/country-url";
import { dict, getT, type Lang } from "@/lib/i18n";

/**
 * Links to each country's home page (/us, /uk, /de, /ca, /ie). A crawler arrives with no country and follows links, so
 * this is how it finds every country's pages; for a shopper it is a plain way to see another country's prices.
 */
export function CountryIndex({ lang = "en" }: { lang?: Lang }) {
  const t = getT(lang);
  return (
    <nav aria-labelledby="country-index" className="border-t border-line">
      <div className="container-page flex flex-wrap items-baseline gap-x-4 py-3 text-sm text-ink-2">
        <h2 id="country-index" className="text-sm">
          {t("footer.pricesByCountry")}
        </h2>
        <ul className="flex flex-wrap gap-x-4">
          {PREFIXES.map((p) => (
            <li key={p}>
              <Link href={`/${p}`} className="inline-flex min-h-11 items-center hover:text-ink hover:underline md:min-h-0">
                {dict(lang).markets.name[COUNTRY_PREFIXES[p]]}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/**
 * A record page's links to its indexable country versions (the same set as its hreflang), when it has more than one. Static, so a crawler that
 * reached the page by an unprefixed link (from a brand or ingredient page) also reaches the URLs that are in the sitemap.
 */
export function VersionLinks({ languages, current, lang = "en" }: { languages: Record<string, string>; current: string; lang?: Lang }) {
  const t = getT(lang);
  const rows = Object.entries(languages).map(([hl, href]) => ({ href, code: hl.split("-")[1] as keyof typeof MARKETS }));
  // One version is the page itself: nothing to choose between.
  if (rows.length < 2) return null;
  return (
    <nav aria-label={t("footer.pricesByCountry")} className="container-page pb-6 text-sm text-ink-2">
      <span className="mr-3">{t("record.pricesByCountryColon")}</span>
      <ul className="inline-flex flex-wrap gap-x-4">
        {rows.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              aria-current={r.href === current ? "page" : undefined}
              className="inline-flex min-h-11 items-center hover:text-ink hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-ink md:min-h-0"
            >
              {dict(lang).markets.name[r.code]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

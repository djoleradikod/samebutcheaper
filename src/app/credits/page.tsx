import type { Metadata } from "next";
import Link from "next/link";
import { ProductThumb } from "@/components/ProductThumb";
import { getCredits } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Photo credits",
  description: "Every product photo on the site, with its source, licence and a link back to where it came from.",
  alternates: { canonical: "/credits" },
};

const SOURCE_NAMES: Record<string, string> = {
  openfoodfacts: "Open Food Facts",
  openbeautyfacts: "Open Beauty Facts",
  openpetfoodfacts: "Open Pet Food Facts",
  openproductsfacts: "Open Products Facts",
  dailymed: "DailyMed",
};

function sourceName(source: string) {
  return SOURCE_NAMES[source] ?? source;
}

/** "CC BY-SA 3.0" links to its deed. Anything else stays as plain text. */
function licenceUrl(license: string) {
  const cc = license.match(/^CC (BY(?:-[A-Z]{2})*) (\d\.\d)/i);
  if (cc) return `https://creativecommons.org/licenses/${cc[1].toLowerCase()}/${cc[2]}/`;
  if (/^CC0/i.test(license)) return "https://creativecommons.org/publicdomain/zero/1.0/";
  return null;
}

const link = "inline-flex min-h-11 items-center text-cobalt underline underline-offset-2 md:min-h-6";

export default function CreditsPage() {
  const credits = [...getCredits()].sort((a, b) => a.brand.localeCompare(b.brand) || a.product.localeCompare(b.product));
  const sources = [...new Set(credits.map((c) => c.source))]
    .map((source) => ({ source, photos: credits.filter((c) => c.source === source) }))
    .sort((a, b) => b.photos.length - a.photos.length);
  const licences = [...new Set(credits.map((c) => c.license))];
  const shareAlike = licences.filter((l) => /BY-SA/i.test(l));

  return (
    <>
      <div className="border-b border-line bg-canvas">
        <div className="container-page pt-4 pb-5 md:pt-6 md:pb-6">
          <h1 className="display text-[1.75rem] md:text-[2.5rem]">Photo credits</h1>
          <div className="mt-2 max-w-[68ch] space-y-2 text-[15px] text-ink-2">
            <p>
              {credits.length > 0 ? (
                <>
                  <span className="num">{credits.length}</span> product photo{credits.length === 1 ? "" : "s"}, each listed here with its
                  product, source and licence.{" "}
                </>
              ) : (
                "No photos are in use yet. "
              )}
              Where we have no licensed photo we draw a dashed outline of a pack and say so.
            </p>
            <p>Pack designs and trademarks belong to their owners.</p>
            {shareAlike.length > 0 && (
              <p>
                We adapted the {shareAlike.join(" and ")} photos by cropping them and placing them on white. The adapted versions are shared
                under the same licence, and &ldquo;Our copy&rdquo; on each entry links to one.
              </p>
            )}
            <p>
              Shelf prices from Open Prices have their own credit on{" "}
              <Link href="/how-we-verify#prices" className="text-cobalt underline underline-offset-2">
                how we check
              </Link>
              .
            </p>
          </div>
          {sources.length > 1 && (
            <nav aria-label="Photo sources" className="mt-3 flex flex-wrap gap-x-4 text-sm font-medium">
              {sources.map((s) => (
                <a key={s.source} href={`#${s.source}`} className="inline-flex min-h-11 items-center text-cobalt underline-offset-2 hover:underline md:min-h-7">
                  {sourceName(s.source)} <span className="num ml-1 font-normal text-muted">{s.photos.length}</span>
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>

      {sources.map(({ source, photos }) => (
        <section key={source} id={source} className="container-page scroll-mt-24 pt-6 md:pt-8">
          <h2 className="display mb-3 text-xl md:text-2xl">{sourceName(source)}</h2>
          <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
            {photos.map((c) => {
              const url = licenceUrl(c.license);
              return (
                <li key={`${c.brand}|${c.product}`} className="flex gap-3 border-t border-line py-3">
                  <ProductThumb size="sm" image={c.src} brand={c.brand} alt={c.product} />
                  <div className="min-w-0 text-[13px] leading-snug">
                    <p className="text-sm font-semibold">{c.brand}</p>
                    <p className="text-ink-2">{c.product}</p>
                    <p className="mt-0.5 text-ink-2">
                      {c.credit},{" "}
                      {url ? (
                        <a href={url} target="_blank" rel="noopener license" className="text-cobalt underline underline-offset-2">
                          {c.license}
                        </a>
                      ) : (
                        c.license
                      )}
                    </p>
                    <p className="flex flex-wrap gap-x-3 font-medium">
                      <a href={c.page} target="_blank" rel="noopener nofollow" className={link}>
                        Source page
                      </a>
                      <a href={`${c.src}-480.webp`} className={link}>
                        Our copy
                      </a>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

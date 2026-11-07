import Link from "next/link";
import { BadgeCheck, ExternalLink, FlaskConical, Info, ListChecks, Store, Target } from "lucide-react";
import { toSummary } from "@/lib/catalog";
import type { LookupDetail } from "@/lib/lookup";
import { SOURCE_LABEL } from "@/lib/lookup/types";
import { countryName } from "@/lib/markets";
import { BundleCard } from "./BundleCard";
import { LocalSearch } from "./LocalSearch";
import { PairCard } from "./PairCard";
import { ProductImage } from "./ProductImage";
import { forCountry } from "@/lib/localize";
import { getCountry } from "@/lib/server-country";

const KIND_LABEL = {
  medicine: "Over-the-counter medicine",
  supplement: "Dietary supplement",
  cosmetic: "Personal care",
  food: "Food",
  pet: "Pet food",
  other: "Product",
};

/** Everything we know about one looked-up product, and what to buy instead. */
export async function ProductReport({ detail, from }: { detail: LookupDetail; from: string }) {
  const { product: p, labelMatches, lookFor } = detail;
  const country = await getCountry();
  const verified = forCountry(detail.verified, country);
  const sameActive = forCountry(detail.sameActive, country);
  const bundles = forCountry(detail.bundles, country);
  const hasSwaps = verified.length + sameActive.length + bundles.length > 0;
  const matched = verified.filter((x) => x.match_type !== "same_kind");
  const sameKind = verified.filter((x) => x.match_type === "same_kind");
  const storeBrands = labelMatches.filter((m) => m.storeBrand);
  const otherLabels = labelMatches.filter((m) => !m.storeBrand);
  const firstFive = p.kind === "cosmetic" ? p.ingredients.slice(0, 5) : [];

  return (
    <div className="space-y-8">
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          {p.image && <ProductImage src={p.image} />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              {KIND_LABEL[p.kind]} · {SOURCE_LABEL[p.source]}
            </p>
            <h2 className="display mt-1 text-3xl leading-tight font-medium">
              {p.brand && !p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? `${p.brand} ` : ""}
              {p.name}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {[
                p.size,
                // "125 Tablet(s) · tablet or pill" says the form twice
                p.form && !p.size.toLowerCase().includes(p.form.split(" ")[0].toLowerCase()) && p.form,
                p.manufacturer && `Made for ${p.manufacturer}`,
                p.upc && `Barcode ${p.upc}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {p.countries.length > 0 && p.source !== "fda" && p.source !== "dsld" && (
              <p className="mt-1 text-xs text-muted">
                Reported on sale in: {p.countries.slice(0, 8).map(countryName).join(", ")}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-px border-t border-line bg-line md:grid-cols-2">
          <div className="bg-surface p-6">
            <h3 className="flex items-center gap-2 font-semibold">
              <Target className="h-4 w-4 text-accent" /> What it&apos;s for
            </h3>
            {p.uses.length ? (
              <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">
                {p.uses.slice(0, 4).map((u, i) => {
                  const [lead, ...items] = u.split(/\s*•\s*/).filter(Boolean);
                  return (
                    <div key={i}>
                      <p>{lead}</p>
                      {items.length > 0 && (
                        <ul className="mt-1 list-disc space-y-0.5 pl-5">
                          {items.map((it, j) => (
                            <li key={j}>{it}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">The label data doesn&apos;t say.</p>
            )}
          </div>
          <div className="bg-surface p-6">
            <h3 className="flex items-center gap-2 font-semibold">
              <FlaskConical className="h-4 w-4 text-accent" /> What&apos;s in it
            </h3>
            {p.actives.length > 0 ? (
              <table className="num mt-2 w-full text-sm">
                <tbody className="divide-y divide-line">
                  {p.actives.slice(0, 30).map((a, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-3 text-ink-2">{a.name}</td>
                      <td className="py-1.5 text-right font-medium">{a.amount || "amount not listed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : p.ingredients.length ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.ingredients.slice(0, 12).join(", ")}…</p>
            ) : (
              <p className="mt-2 text-sm text-muted">No ingredient list in the data we have.</p>
            )}
            {p.ingredients.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-accent">
                  {p.actives.length ? "Inactive ingredients" : "Full ingredient list"} ({p.ingredients.length})
                </summary>
                <p className="mt-2 leading-relaxed text-ink-2">{p.ingredients.join(", ")}</p>
              </details>
            )}
          </div>
        </div>

        {(p.directions || p.warnings.length > 0 || p.url) && (
          <div className="space-y-3 border-t border-line p-6 text-sm">
            {p.directions && (
              <details>
                <summary className="cursor-pointer font-medium">How to use it</summary>
                <p className="mt-2 leading-relaxed text-ink-2">{p.directions}</p>
              </details>
            )}
            {p.warnings.length > 0 && (
              <details>
                <summary className="cursor-pointer font-medium">Main warnings</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
                  {p.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline"
              >
                Read the full record at {new URL(p.url).hostname.replace(/^www\./, "")}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="display text-2xl font-medium sm:text-3xl">Cheaper options</h2>

        {matched.length > 0 && (
          <div className="mt-5">
            <p className="flex items-center gap-2 font-semibold">
              <BadgeCheck className="h-5 w-5 text-accent" /> Swaps we&apos;ve compared with this product
            </p>
            <p className="mt-1 text-xs text-muted">Each one says what it matches on and what differs.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {matched.map((x) => (
                <PairCard key={x.slug} pair={toSummary(x)} />
              ))}
            </div>
          </div>
        )}

        {sameKind.length > 0 && (
          <div className="mt-6">
            <p className="font-semibold">The same kind of product, for less</p>
            <p className="mt-1 text-xs text-muted">
              Our records don&apos;t show that these match on what&apos;s inside or how well they work.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sameKind.map((x) => (
                <PairCard key={x.slug} pair={toSummary(x)} />
              ))}
            </div>
          </div>
        )}

        {sameActive.length > 0 && (
          <div className="mt-6">
            <p className="flex items-center gap-2 font-semibold">
              <BadgeCheck className="h-5 w-5 text-accent" /> Cheaper products with the same active ingredients on file
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sameActive.slice(0, 6).map((x) => (
                <PairCard key={x.slug} pair={toSummary(x)} />
              ))}
            </div>
          </div>
        )}

        {bundles.length > 0 && (
          <div className="mt-6">
            <p className="font-semibold">Bundles from this brand, rebuilt for less</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bundles.slice(0, 3).map((b) => (
                <BundleCard key={b.slug} bundle={b} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <LocalSearch
            lookFor={lookFor}
            from={from}
            medicine={p.kind === "medicine"}
            note={
              lookFor.actives?.length
                ? "Look for a brand that lists exactly these active ingredients at the same strength. The form and other ingredients can still differ, and medicine rules differ by country, so ask a pharmacist if you're unsure."
                : firstFive.length
                  ? `Tip: products whose first five ingredients match (${firstFive.join(", ")}) in the same order are usually close in formula. Ingredients are listed from most to least.`
                  : "Store brands are usually the cheapest. Compare the label and the price per unit."
            }
          />

          {labelMatches.length > 0 && (
            <div className="card p-5">
              <p className="flex items-center gap-2 font-semibold">
                <Store className="h-4 w-4 text-accent" /> Same active ingredients on the official US label
              </p>
              <p className="mt-1 text-xs text-muted">
                From FDA drug label data: same actives, same strength, same form. Store brands are usually the
                cheapest.
              </p>
              <ul className="mt-3 divide-y divide-line text-sm">
                {[...storeBrands, ...otherLabels].slice(0, 12).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{m.brand}</span>
                      <span className="block truncate text-xs text-muted">
                        {m.storeBrand ? `Store brand: ${m.storeBrand}` : m.manufacturer}
                      </span>
                    </span>
                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="shrink-0 text-xs text-accent underline-offset-2 hover:underline"
                      >
                        Label
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {!hasSwaps && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-line bg-surface-2 p-5 text-sm">
            <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
            <p className="leading-relaxed text-ink-2">
              We don&apos;t have a cheaper match with prices for this one yet. We count every lookup, and
              the most requested products are researched first.{" "}
              <Link
                href={`/suggest?brand=${encodeURIComponent(`${p.brand} ${p.name}`.trim())}`}
                className="text-accent underline underline-offset-2"
              >
                Know a match? Tell us
              </Link>
              .
            </p>
          </div>
        )}
      </section>

      <p className="flex gap-2 text-xs leading-relaxed text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {p.source === "fda" && "Label data from openFDA and DailyMed (U.S. National Library of Medicine). "}
          {p.source === "dsld" && "Label data from the NIH Office of Dietary Supplements' Label Database. "}
          {(p.source === "obf" || p.source === "off" || p.source === "opff") &&
            `Data from ${SOURCE_LABEL[p.source]}, available under the Open Database License. `}
          {p.source === "photo" && "Read from your photo, so check it against the pack. "}
          This is label information, not medical advice. Always read the label, and ask a pharmacist or doctor
          if you&apos;re unsure.
        </span>
      </p>
    </div>
  );
}

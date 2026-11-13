import Link from "@/components/CountryLink";
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
import { getLocal } from "@/lib/server-country";
import { getT } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";
import { countryNameDe } from "@/lib/i18n/de/client";

/** Everything we know about one looked-up product, and what to buy instead. */
export async function ProductReport({ detail, from }: { detail: LookupDetail; from: string }) {
  const { product: p, labelMatches, lookFor } = detail;
  const local = await getLocal();
  const lang = getLang();
  const t = getT(lang);
  const verified = forCountry(detail.verified, local);
  const sameActive = forCountry(detail.sameActive, local);
  const bundles = forCountry(detail.bundles, local);
  // These lines name US store brands, so they stay with shoppers who can buy them.
  const showLabels = labelMatches.length > 0 && (!local.known || local.country === "US" || local.country === "CA");
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
              {t(`report.kind.${p.kind}`)} · {SOURCE_LABEL[p.source]}
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
                p.manufacturer && t("report.madeFor", p.manufacturer),
                p.upc && t("report.barcode", p.upc),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {p.countries.length > 0 && p.source !== "fda" && p.source !== "dsld" && (
              <p className="mt-1 text-xs text-muted">
                {t("report.onSale", p.countries.slice(0, 8).map((c) => (lang === "de" ? countryNameDe(c) : null) ?? countryName(c)).join(", "))}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-px border-t border-line bg-line md:grid-cols-2">
          <div className="bg-surface p-6">
            <h3 className="flex items-center gap-2 font-semibold">
              <Target className="h-4 w-4 text-accent" /> {t("report.whatFor")}
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
              <p className="mt-2 text-sm text-muted">{t("report.doesntSay")}</p>
            )}
          </div>
          <div className="bg-surface p-6">
            <h3 className="flex items-center gap-2 font-semibold">
              <FlaskConical className="h-4 w-4 text-accent" /> {t("report.whatsIn")}
            </h3>
            {p.actives.length > 0 ? (
              <table className="num mt-2 w-full text-sm">
                <tbody className="divide-y divide-line">
                  {p.actives.slice(0, 30).map((a, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-3 text-ink-2">{a.name}</td>
                      <td className="py-1.5 text-right font-medium">{a.amount || t("report.amountMissing")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : p.ingredients.length ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.ingredients.slice(0, 12).join(", ")}…</p>
            ) : (
              <p className="mt-2 text-sm text-muted">{t("report.noIngredients")}</p>
            )}
            {p.ingredients.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-accent">
                  {p.actives.length ? t("report.inactive") : t("report.fullList")} ({p.ingredients.length})
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
                <summary className="cursor-pointer font-medium">{t("report.howToUse")}</summary>
                <p className="mt-2 leading-relaxed text-ink-2">{p.directions}</p>
              </details>
            )}
            {p.warnings.length > 0 && (
              <details>
                <summary className="cursor-pointer font-medium">{t("report.warnings")}</summary>
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
                {t("report.readFull", new URL(p.url).hostname.replace(/^www\./, ""))}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="display text-2xl font-medium sm:text-3xl">{t("report.cheaper")}</h2>

        {matched.length > 0 && (
          <div className="mt-5">
            <p className="flex items-center gap-2 font-semibold">
              <BadgeCheck className="h-5 w-5 text-accent" /> {t("report.compared")}
            </p>
            <p className="mt-1 text-xs text-muted">{t("report.eachSays")}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {matched.map((x) => (
                <PairCard key={x.slug} pair={toSummary(x)} lang={lang} />
              ))}
            </div>
          </div>
        )}

        {sameKind.length > 0 && (
          <div className="mt-6">
            <p className="font-semibold">{t("report.sameKind")}</p>
            <p className="mt-1 text-xs text-muted">{t("report.sameKindNote")}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sameKind.map((x) => (
                <PairCard key={x.slug} pair={toSummary(x)} lang={lang} />
              ))}
            </div>
          </div>
        )}

        {sameActive.length > 0 && (
          <div className="mt-6">
            <p className="flex items-center gap-2 font-semibold">
              <BadgeCheck className="h-5 w-5 text-accent" /> {t("report.sameActive")}
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sameActive.slice(0, 6).map((x) => (
                <PairCard key={x.slug} pair={toSummary(x)} lang={lang} />
              ))}
            </div>
          </div>
        )}

        {bundles.length > 0 && (
          <div className="mt-6">
            <p className="font-semibold">{t("report.bundles")}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bundles.slice(0, 3).map((b) => (
                <BundleCard key={b.slug} bundle={b} lang={lang} />
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
                ? t("report.noteActives")
                : firstFive.length
                  ? t("report.noteFirstFive", firstFive.join(", "))
                  : t("report.noteStore")
            }
          />

          {showLabels && (
            <div className="card p-5">
              <p className="flex items-center gap-2 font-semibold">
                <Store className="h-4 w-4 text-accent" /> {t("report.usLabel")}
              </p>
              <p className="mt-1 text-xs text-muted">{t("report.usLabelNote")}</p>
              <ul className="mt-3 divide-y divide-line text-sm">
                {[...storeBrands, ...otherLabels].slice(0, 12).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{m.brand}</span>
                      <span className="block truncate text-xs text-muted">
                        {m.storeBrand ? t("report.storeBrand", m.storeBrand) : m.manufacturer}
                      </span>
                    </span>
                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="shrink-0 text-xs text-accent underline-offset-2 hover:underline"
                      >
                        {t("report.label")}
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
              {t("report.noMatch")}{" "}
              <Link
                href={`/suggest?brand=${encodeURIComponent(`${p.brand} ${p.name}`.trim())}`}
                className="text-accent underline underline-offset-2"
              >
                {t("report.knowMatch")}
              </Link>
              .
            </p>
          </div>
        )}
      </section>

      <p className="flex gap-2 text-xs leading-relaxed text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {p.source === "fda" && t("report.fda")}
          {p.source === "dsld" && t("report.dsld")}
          {(p.source === "obf" || p.source === "off" || p.source === "opff") && t("report.odbl", SOURCE_LABEL[p.source])}
          {p.source === "photo" && t("report.photo")}
          {t("report.notAdvice")}
        </span>
      </p>
    </div>
  );
}

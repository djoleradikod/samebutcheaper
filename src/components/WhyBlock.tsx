import Link from "next/link";
import type { CompareRow } from "@/lib/compare";
import type { Claim, Pair } from "@/lib/types";
import { buysOnce } from "./BulkBox";
import { Finding } from "./Finding";

function FindingGrid({ claims, full = false }: { claims: Claim[]; full?: boolean }) {
  return (
    <div className="grid content-start gap-3 xl:grid-cols-2">
      {claims.map((claim, i) => (
        <Finding
          key={claim.id}
          claim={claim}
          full={full}
          className={claims.length % 2 === 1 && i === 0 ? "xl:col-span-2" : ""}
        />
      ))}
    </div>
  );
}

/**
 * Why the extra money buys little: this swap's own reasoning, what was checked, then the cited
 * findings. Findings about this aisle show in full. General ones about store brands stay short,
 * and don't appear on things you buy once, such as a charger, where they say little.
 */
export function WhyBlock({ pair, className = "" }: { pair: Pair; className?: string }) {
  const own = pair.evidence_claims.filter((c) => c.categories.includes(pair.category) || pair.claims.includes(c.id));
  const general = buysOnce(pair.alternative.unit, pair.alternative.size)
    ? []
    : pair.evidence_claims.filter((c) => !own.includes(c));
  const hasFindings = own.length + general.length > 0;
  return (
    <section aria-labelledby="why" className={className}>
      <div
        className={`container-page grid gap-x-10 gap-y-6 py-8 md:py-10 ${
          hasFindings ? "lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]" : ""
        }`}
      >
        <div className="min-w-0 max-w-3xl">
          <h2 id="why" className="display text-[22px] md:text-2xl">
            Why the extra money buys little
          </h2>
          <p className="mt-2 text-[17px] leading-snug text-ink">{pair.why ?? pair.summary}</p>
          <h3 className="mt-4 text-[15px]">What we checked</h3>
          <p className="mt-1 text-sm text-ink-2">{pair.evidence}</p>
          {hasFindings && (
            <Link
              href="/why"
              className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline underline-offset-2"
            >
              All our findings
            </Link>
          )}
        </div>
        {hasFindings && (
          <div className="min-w-0 space-y-3">
            {own.length > 0 && <FindingGrid claims={own} full />}
            {general.length > 0 && (
              <div>
                <p className="pb-1.5 text-[13px] font-medium text-muted">On store brands in general</p>
                <FindingGrid claims={general} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** The other side of the ticket, shown across the whole page so it weighs as much as the saving. */
export function BrandWins({
  id,
  brandName,
  altName,
  points,
  wins,
  className = "",
}: {
  id: string;
  brandName: string;
  altName: string;
  points: string[];
  /** Researched rows where the brand came out ahead. */
  wins: CompareRow[];
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-16 border-y border-brand-better/25 bg-brand-better-soft ${className}`}
    >
      <div className="container-page grid gap-x-10 gap-y-4 py-8 md:py-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="display text-[22px] text-brand-better md:text-2xl">
            Where the brand wins, and what differs
          </h2>
          <p className="mt-2 text-[15px] text-ink-2">
            What {altName} doesn&apos;t match, from the same records as the saving.
          </p>
        </div>
        <div className="min-w-0 space-y-5">
          {wins.length > 0 && (
            <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              {wins.map((r) => (
                <li key={r.aspect} className="min-w-0 text-[15px]">
                  <p className="text-[17px] leading-snug font-semibold text-brand-better">{r.aspect}</p>
                  <p className="mt-1 text-ink">
                    <span className="font-medium">{brandName}:</span> {r.brand}
                  </p>
                  <p className="mt-0.5 text-ink-2">
                    <span className="font-medium">{altName}:</span> {r.alternative}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {points.length > 0 ? (
            <ul className="max-w-[70ch] list-disc space-y-2 pl-5 text-[17px] leading-snug text-ink marker:text-brand-better md:text-lg">
              {points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            wins.length === 0 && (
              <p className="text-[17px] leading-snug text-ink">The records we checked list no differences.</p>
            )
          )}
        </div>
      </div>
    </section>
  );
}

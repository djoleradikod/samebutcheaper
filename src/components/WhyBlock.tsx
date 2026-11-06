import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { splitSentences, type CompareRow } from "@/lib/compare";
import type { Claim, Pair } from "@/lib/types";
import { buysOnce } from "./BulkBox";
import { citationDate } from "./Finding";

/** Two sentences show only when they fit in about this many characters. */
const EXCERPT_CHARS = 170;

function excerptOf(finding: string) {
  const sentences = splitSentences(finding);
  const take = sentences.length > 1 && `${sentences[0]} ${sentences[1]}`.length <= EXCERPT_CHARS ? 2 : 1;
  return { excerpt: sentences.slice(0, take).join(" "), rest: sentences.slice(take).join(" ") };
}

/** A cited claim as a title and two lines. The rest of the record and every source open in place. */
function FoldedFinding({ claim, className = "" }: { claim: Claim; className?: string }) {
  const { excerpt, rest } = excerptOf(claim.finding);
  const count = claim.sources.length;
  const sources = `${count} source${count === 1 ? "" : "s"}`;
  return (
    <article className={`card group flex flex-col p-4 ${className}`}>
      <h3 className="text-base leading-snug">{claim.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-ink-2 group-has-[details[open]]:line-clamp-none">{excerpt}</p>
      <details className="group/more mt-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-medium text-cobalt hover:underline [&::-webkit-details-marker]:hidden">
          {rest || claim.caveat ? `Read more and see ${sources}` : `See ${sources}`}
          <ChevronDown className="h-4 w-4 shrink-0 group-open/more:rotate-180" aria-hidden="true" />
        </summary>
        {rest && <p className="mt-1 text-sm text-ink-2">{rest}</p>}
        {claim.caveat && (
          <p className="mt-2 text-sm text-ink-2">
            <span className="font-semibold text-ink">Where the evidence stops: </span>
            {claim.caveat}
          </p>
        )}
        <ul className="mt-2 text-[13px] font-medium">
          {claim.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2 md:min-h-6"
              >
                {s.publisher}, {citationDate(s.date)}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function FindingGrid({ claims }: { claims: Claim[] }) {
  return (
    <div className="grid items-start gap-3 xl:grid-cols-2">
      {claims.map((claim, i) => (
        <FoldedFinding key={claim.id} claim={claim} className={claims.length % 2 === 1 && i === 0 ? "xl:col-span-2" : ""} />
      ))}
    </div>
  );
}

/**
 * Why the extra money buys little: this swap's own reasoning, then the cited findings, each a title
 * and two lines. What we checked and each finding's sources open in place. General findings about
 * store brands don't appear on things you buy once, such as a charger, where they say little.
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
          <details className="group/checked mt-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-[15px] font-semibold hover:underline [&::-webkit-details-marker]:hidden">
              What we checked
              <ChevronDown className="h-4 w-4 shrink-0 group-open/checked:rotate-180" aria-hidden="true" />
            </summary>
            <p className="text-sm text-ink-2">{pair.evidence}</p>
          </details>
          {hasFindings && (
            <Link href="/why" className="inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline underline-offset-2">
              All our findings
            </Link>
          )}
        </div>
        {hasFindings && (
          <div className="min-w-0 space-y-3">
            {own.length > 0 && <FindingGrid claims={own} />}
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

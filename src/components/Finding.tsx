import type { Claim } from "@/lib/types";
import { monthYear } from "@/lib/format";

/** Splits at sentence ends, but not after "Which?" or the usual abbreviations. */
const SENTENCE_END = /(?<!\bWhich\?)(?<!\b(?:vs|St|Dr|No|Inc|Ltd|U\.S))(?<=[.!?])\s+(?=[A-Z0-9'"])/;

/** The first one or two sentences, for a card. Keeps to one when two would run long. */
export function findingExcerpt(finding: string, max = 300) {
  const [first, second] = finding.split(SENTENCE_END);
  if (!second) return first;
  const both = `${first} ${second}`;
  return both.length <= max ? both : first;
}

/** "2025-06-26" reads "June 2025", "2015" stays, and an undated page keeps its checked date. */
export function citationDate(date: string) {
  const m = date.match(/(\d{4})-(\d{2})/);
  if (!m) return date;
  const when = monthYear(`${m[1]}-${m[2]}`);
  return /checked/i.test(date) ? `checked ${when}` : when;
}

function Citation({ source }: { source: Claim["sources"][number] }) {
  return (
    <a href={source.url} target="_blank" rel="noopener" className="text-cobalt underline underline-offset-2">
      {source.publisher}, {citationDate(source.date)}
    </a>
  );
}

/**
 * A cited claim: the title, the finding, and the publisher and date as a link. Cards show
 * one or two sentences. `full` shows the whole record, where the evidence stops and every source.
 */
export function Finding({ claim, full = false, className = "" }: { claim: Claim; full?: boolean; className?: string }) {
  const sources = full ? claim.sources : claim.sources.slice(0, 1);
  return (
    <article className={`card flex flex-col p-4 ${className}`}>
      <h3 className="text-base leading-snug">{claim.title}</h3>
      <p className="mt-1.5 text-sm text-ink-2">{full ? claim.finding : findingExcerpt(claim.finding)}</p>
      {full && claim.caveat && (
        <p className="mt-2 text-sm text-ink-2">
          <span className="font-semibold text-ink">Where the evidence stops: </span>
          {claim.caveat}
        </p>
      )}
      <ul className="mt-auto space-y-0.5 pt-3 text-[13px] font-medium">
        {sources.map((s) => (
          <li key={s.url}>
            <Citation source={s} />
          </li>
        ))}
      </ul>
    </article>
  );
}

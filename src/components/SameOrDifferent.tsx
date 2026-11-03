import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, ExternalLink, Eye, Shuffle } from "lucide-react";
import type { Comparison, CompareRow, Verdict } from "@/lib/compare";

const VERDICT: Record<Verdict, { label: string; className: string; Icon: typeof Check }> = {
  same: { label: "Same", className: "bg-accent-soft text-accent-strong", Icon: Check },
  alt_better: { label: "Cheaper one wins", className: "bg-highlight text-highlight-ink", Icon: ArrowUpRight },
  brand_better: { label: "Brand wins", className: "bg-brand-soft text-brand-tone", Icon: ArrowDownRight },
  different: { label: "Differs", className: "bg-sky/15 text-ink", Icon: Shuffle },
  check: { label: "Check label", className: "bg-surface-2 text-ink-2", Icon: Eye },
};

/** Ingredient rows shown before the rest fold away. */
const SHOW = 8;

/** What's the same and what's different, point by point, with an honest verdict on each. */
export function SameOrDifferent({
  comparison,
  brandName,
  altName,
  intro,
}: {
  comparison: Comparison;
  brandName: string;
  altName: string;
  /** One line under the heading, e.g. what the match type requires. */
  intro?: string;
}) {
  const all = [...comparison.ingredients, ...comparison.rows];
  const same = all.filter((r) => r.verdict === "same").length;
  const brandWins = all.filter((r) => r.verdict === "brand_better").length;
  const shown = comparison.ingredients.slice(0, SHOW);
  const folded = comparison.ingredients.slice(SHOW);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line bg-tint px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Same or different?</h2>
          <p className="text-sm text-ink-2">{intro ?? "Point by point, including where the brand is better."}</p>
        </div>
        <p className="num text-sm text-ink-2">
          <span className="font-semibold text-accent-strong">
            {same} of {all.length} the same
          </span>
          {brandWins > 0 && (
            <span>
              {" "}
              · <span className="font-semibold text-brand-tone">brand wins {brandWins}</span>
            </span>
          )}
        </p>
      </div>

      {/* Column names, wide screens only */}
      <div className="hidden grid-cols-[22%_1fr_1fr_9.5rem] gap-3 border-b border-line px-5 py-2.5 text-xs font-medium text-muted md:grid">
        <span>What</span>
        <span className="text-brand-tone">{brandName}</span>
        <span className="text-accent">{altName}</span>
        <span>Verdict</span>
      </div>

      {comparison.ingredients.length > 0 && (
        <>
          <GroupLabel>{comparison.label}</GroupLabel>
          <Rows rows={shown} brandName={brandName} altName={altName} />
          {folded.length > 0 && (
            <details className="group border-t border-line">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 px-5 py-3 text-sm font-medium text-accent hover:underline">
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                <span className="group-open:hidden">Show {folded.length} more</span>
                <span className="hidden group-open:inline">Show fewer</span>
              </summary>
              <Rows rows={folded} brandName={brandName} altName={altName} />
            </details>
          )}
        </>
      )}

      <GroupLabel>Everything else</GroupLabel>
      <Rows rows={comparison.rows} brandName={brandName} altName={altName} />
    </section>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-y border-line bg-surface-2/70 px-5 py-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
      {children}
    </p>
  );
}

function Rows({ rows, brandName, altName }: { rows: CompareRow[]; brandName: string; altName: string }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li
          key={r.aspect}
          className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 text-sm md:grid-cols-[22%_1fr_1fr_9.5rem] md:items-start md:px-5"
        >
          <span className="font-medium">
            {r.href ? (
              <Link
                href={r.href}
                className="underline decoration-line-strong underline-offset-4 hover:text-accent hover:decoration-accent"
              >
                {r.aspect}
              </Link>
            ) : (
              r.aspect
            )}
            {r.source && (
              <a
                href={r.source}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="ml-1.5 inline-flex align-middle text-muted hover:text-accent"
                aria-label={`Source for ${r.aspect}`}
                title="Source"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </span>
          <span className="justify-self-end md:order-last md:justify-self-start">
            <VerdictChip verdict={r.verdict} />
          </span>
          <span className="text-ink-2">
            <span className="block text-xs text-brand-tone md:hidden">{brandName}</span>
            {r.brand}
          </span>
          <span className="text-ink-2">
            <span className="block text-xs text-accent md:hidden">{altName}</span>
            {r.alternative}
          </span>
        </li>
      ))}
    </ul>
  );
}

function VerdictChip({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${v.className}`}
    >
      <v.Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {v.label}
    </span>
  );
}

import Link from "next/link";
import type { Comparison, CompareRow, Verdict } from "@/lib/compare";

/** Pale fill for the row and darker text for the words. Alt-better rows stay white: yellow is for the ticket. */
const VERDICT: Record<Verdict, { label: string; row: string; text: string }> = {
  same: { label: "Same", row: "bg-same-soft", text: "text-same" },
  about_same: { label: "About the same", row: "bg-same-soft", text: "text-same" },
  alt_better: { label: "Cheaper one wins", row: "", text: "text-ink" },
  brand_better: { label: "Brand wins", row: "bg-brand-better-soft", text: "text-brand-better" },
  different: { label: "Differs", row: "bg-different-soft", text: "text-different" },
  check: { label: "Check the label", row: "bg-different-soft", text: "text-different" },
  unknown: { label: "Not on file", row: "", text: "text-muted" },
  neutral: { label: "", row: "", text: "text-ink-2" },
};

/** A cell longer than this opens from a short start, so a long ingredient list doesn't push the page down. */
const LONG_CELL = 160;
const CELL_START = 90;

function Cell({ text }: { text: string }) {
  if (text.length <= LONG_CELL) return <>{text}</>;
  return (
    <details className="group/cell">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="group-open/cell:hidden">
          {text.slice(0, CELL_START).trimEnd()}… <span className="font-medium text-cobalt underline underline-offset-2">Show all</span>
        </span>
        <span className="hidden font-medium text-cobalt underline underline-offset-2 group-open/cell:inline">Show less</span>
      </summary>
      <span className="mt-1 block">{text}</span>
    </details>
  );
}

function NutritionCredit({ group }: { group: NonNullable<Comparison["nutrition"]> }) {
  return (
    <p className="mt-2 text-[13px] text-muted">
      From{" "}
      <a href={group.licenseUrl} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">
        {group.source}, {group.license}
      </a>
      . People enter these records, so check the pack. Records:{" "}
      {group.records.map((r, i) => (
        <span key={r.page}>
          {i > 0 && ", "}
          <a
            href={r.page}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-block py-1 text-cobalt underline underline-offset-2"
          >
            {r.name}
          </a>
        </span>
      ))}
      .
    </p>
  );
}

/** Ingredient rows shown before the rest fold away. */
const SHOW = 8;

/** Fewer points than this with data on both sides, and a count of them says nothing. */
const MIN_COUNTED = 3;

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
  /** One line under the heading: what's on file for this swap. */
  intro: string;
}) {
  const all = [...comparison.ingredients, ...comparison.rows];
  // Only points with data on both sides count, and the unit price differs on every swap.
  const counted = all.filter((r) => !r.uncounted && r.verdict !== "unknown" && r.verdict !== "check");
  const same = counted.filter((r) => r.verdict === "same" || r.verdict === "about_same").length;
  const brandWins = all.filter((r) => r.verdict === "brand_better").length;
  const shown = comparison.ingredients.slice(0, SHOW);
  const folded = comparison.ingredients.slice(SHOW);
  const names = { brandName, altName };

  return (
    <section aria-labelledby="same-or-different">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="min-w-0 max-w-3xl">
          <h2 id="same-or-different" className="display text-[22px] md:text-2xl">
            Same or different?
          </h2>
          <p className="mt-1 text-[15px] text-ink-2">{intro}</p>
        </div>
        {(counted.length >= MIN_COUNTED || brandWins > 0) && (
          <p className="num text-sm font-semibold">
            {counted.length >= MIN_COUNTED && (
              <span className="text-same">
                {same} of {counted.length} the same.
              </span>
            )}
            {brandWins > 0 && <span className="text-brand-better"> Brand wins {brandWins}.</span>}
          </p>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {comparison.ingredients.length > 0 && (
          <div>
            <CompareTable caption={comparison.label} rows={shown} {...names} />
            {folded.length > 0 && (
              <details className="group mt-1">
                <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-cobalt hover:underline [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show {folded.length} more</span>
                  <span className="hidden group-open:inline">Show fewer</span>
                </summary>
                <CompareTable caption={`${comparison.label}, continued`} rows={folded} {...names} />
              </details>
            )}
          </div>
        )}
        <CompareTable caption={shown.length ? "Everything else" : "What we compared"} rows={comparison.rows} {...names} />
        {comparison.nutrition && (
          <div>
            <CompareTable caption={comparison.nutrition.caption} rows={comparison.nutrition.rows} {...names} />
            <NutritionCredit group={comparison.nutrition} />
          </div>
        )}
      </div>
    </section>
  );
}

function CompareTable({
  caption,
  rows,
  brandName,
  altName,
}: {
  caption: string;
  rows: CompareRow[];
  brandName: string;
  altName: string;
}) {
  return (
    <table className="w-full table-fixed border-collapse text-[13px] md:text-sm">
      <caption className="pb-1.5 text-left text-[13px] font-medium text-muted">{caption}</caption>
      <colgroup>
        <col className="w-[32%] md:w-[24%]" />
        <col />
        <col />
        <col className="hidden md:table-column md:w-40" />
      </colgroup>
      <thead>
        <tr className="border-y border-line-strong text-left text-[13px]">
          <th scope="col" className="px-2 py-2 font-medium text-muted md:px-3">
            What
          </th>
          <th scope="col" className="px-2 py-2 font-semibold break-words md:px-3">
            {brandName}
          </th>
          <th scope="col" className="px-2 py-2 font-semibold break-words md:px-3">
            {altName}
          </th>
          <th scope="col" className="hidden px-3 py-2 font-medium text-muted md:table-cell">
            Verdict
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const v = VERDICT[r.verdict];
          const label = r.verdictLabel ?? v.label;
          return (
            <tr key={r.aspect} className={`border-b border-line align-top ${v.row}`}>
              <th scope="row" className="px-2 py-2.5 text-left font-medium break-words md:px-3">
                {r.href ? (
                  <Link
                    href={r.href}
                    className="underline decoration-line-strong underline-offset-4 hover:text-cobalt hover:decoration-cobalt"
                  >
                    {r.aspect}
                  </Link>
                ) : (
                  r.aspect
                )}
                {r.detail && <span className="mt-0.5 block text-xs font-normal text-muted">{r.detail}</span>}
                <span className={`mt-0.5 block text-xs font-semibold md:hidden ${v.text}`}>{label}</span>
                {r.source && (
                  <a
                    href={r.source}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    aria-label={`Source for ${r.aspect}`}
                    className="inline-flex min-h-11 items-center text-xs font-normal text-cobalt underline underline-offset-2 md:ml-1.5 md:min-h-0"
                  >
                    Source
                  </a>
                )}
              </th>
              <td className="px-2 py-2.5 break-words text-ink-2 md:px-3">
                <Cell text={r.brand} />
              </td>
              <td className="px-2 py-2.5 break-words text-ink-2 md:px-3">
                <Cell text={r.alternative} />
              </td>
              <td className={`hidden px-3 py-2.5 font-semibold md:table-cell ${v.text}`}>{label}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

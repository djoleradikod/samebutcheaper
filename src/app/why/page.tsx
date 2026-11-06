import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { citationDate, Finding } from "@/components/Finding";
import { ProductThumb } from "@/components/ProductThumb";
import { getAllPairs, getClaims, getPairsByCategory, getShelfLife } from "@/lib/catalog";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/categories";
import type { CategorySlug, Claim, ShelfLife } from "@/lib/types";

export const metadata: Metadata = {
  title: "Why it's worth switching",
  description:
    "What independent tests, regulators and researchers found about brand premiums, how long things keep before you buy in bulk, and where the cheap option lost.",
  alternates: { canonical: "/why" },
};

const GENERAL = "general";

const ADVICE: { advice: ShelfLife["advice"]; title: string; body: string }[] = [
  { advice: "stock_up", title: "Stock up", body: "Keeps for years, so a big pack is safe." },
  { advice: "buy_to_use", title: "Buy to use", body: "Fine in bulk if you get through it in time." },
  { advice: "buy_small", title: "Buy small", body: "Goes off or weakens, so skip the big pack." },
];

/* ------------------------------------------------------------------ findings */

/** Newest source first. Dates may read "2025", "2025-06-26" or "checked 2026-11". */
function latest(c: Claim) {
  return c.sources.map((s) => s.date.match(/\d{4}(-\d{2})?/)?.[0] ?? "").sort().reverse()[0] ?? "";
}

function aisleName(slug: string) {
  return CATEGORY_MAP[slug as CategorySlug]?.name ?? slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

type AisleGroup = { id: string; name: string; findings: Claim[]; alsoHere: Claim[]; swaps: number };

/**
 * "general" first, then the aisles in shop order, medicine last. A finding prints once, in the
 * first place it belongs; later aisles link back to it so nothing reads twice.
 */
function groupByAisle(claims: Claim[]) {
  const sorted = [...claims].sort((a, b) => latest(b).localeCompare(latest(a)));
  const known = CATEGORIES.map((c) => c.slug as string);
  const others = [...new Set(sorted.flatMap((c) => c.categories))].filter((s) => s !== GENERAL && !known.includes(s));
  const printed = new Set<string>();
  const groups: AisleGroup[] = [];
  for (const id of [GENERAL, ...known, ...others]) {
    const here = sorted.filter((c) => c.categories.includes(id));
    if (!here.length) continue;
    groups.push({
      id,
      name: id === GENERAL ? "Across every aisle" : aisleName(id),
      findings: here.filter((c) => !printed.has(c.id)),
      alsoHere: here.filter((c) => printed.has(c.id)),
      swaps: known.includes(id) ? getPairsByCategory(id as CategorySlug).length : 0,
    });
    here.forEach((c) => printed.add(c.id));
  }
  return groups;
}

/* ------------------------------------------------------------------ cheap losses */

/** Same sentence rule the findings use: not after "Which?" or the usual abbreviations. */
const SENTENCE_END = /(?<!\bWhich\?)(?<!\b(?:vs|St|Dr|No|Inc|Ltd|U\.S))(?<=[.!?])\s+(?=[A-Z0-9'"])/;

/**
 * Caveats also say where evidence stops, which isn't a loss. These phrases mark the sentences
 * where a cheap product actually lost or a brand actually won.
 */
const LOST =
  /did not (always |)win|did not beat|did not pass|brands? (still )?won\b|name brands? (still )?win\b|brands? (were|was) ahead|still (beat|beats|earned)\b|keeps a best buy|rated poor|cheap loss|have failed|froze\b/i;

function lostFrom(claim: Claim) {
  return claim.caveat
    .split(SENTENCE_END)
    .filter((s) => LOST.test(s))
    .join(" ");
}

/* --------------------------------------------------------------- shelf-life rows */

function shelfRows(records: ShelfLife[]) {
  const pairs = getAllPairs();
  return records
    .map((record) => {
      const swaps = pairs.filter((p) => p.shelfLife?.id === record.id);
      const everyday = swaps.filter((p) => p.category !== "otc-medicine");
      const pick = everyday.find((p) => p.alternative.photo) ?? everyday[0] ?? swaps[0];
      return { record, swaps: swaps.length, pick };
    })
    .sort((a, b) => b.swaps - a.swaps || a.record.label.localeCompare(b.record.label));
}

function Citations({ sources }: { sources: ShelfLife["sources"] }) {
  return (
    <ul className="text-[13px] leading-snug font-medium md:space-y-0.5">
      {sources.map((s) => (
        <li key={s.url}>
          <a href={s.url} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2 md:min-h-0">
            {s.publisher}, {citationDate(s.date)}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** On a phone each cell stacks and carries its own label; the column heads take over from lg up. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <td role="cell" className="block px-3 pb-1.5 text-sm text-ink-2 lg:table-cell lg:border-t lg:border-line lg:py-3 lg:align-top">
      <span className="font-semibold text-ink lg:hidden">{label}: </span>
      {children}
    </td>
  );
}

function ShelfTable({ records }: { records: ShelfLife[] }) {
  return (
    <table role="table" className="card block w-full lg:table lg:table-fixed lg:border-separate lg:border-spacing-0">
      <caption className="sr-only">How long things keep, grouped by whether to stock up, buy to use or buy small</caption>
      <thead role="rowgroup" className="hidden lg:table-header-group">
        <tr role="row" className="text-left text-[13px] font-medium text-ink-2">
          <th role="columnheader" scope="col" className="w-[19%] px-3 py-2 font-medium">What</th>
          <th role="columnheader" scope="col" className="w-[23%] px-3 py-2 font-medium">Unopened</th>
          <th role="columnheader" scope="col" className="w-[18%] px-3 py-2 font-medium">Once opened</th>
          <th role="columnheader" scope="col" className="w-[17%] px-3 py-2 font-medium">Where to keep it</th>
          <th role="columnheader" scope="col" className="w-[23%] px-3 py-2 font-medium">Worth knowing, and sources</th>
        </tr>
      </thead>
      {ADVICE.map((group) => {
        const rows = shelfRows(records.filter((r) => r.advice === group.advice));
        if (!rows.length) return null;
        return (
          <tbody key={group.advice} id={`advice-${group.advice}`} role="rowgroup" className="block scroll-mt-24 lg:table-row-group">
            <tr role="row" className="block lg:table-row">
              <th
                role="columnheader"
                scope="colgroup"
                colSpan={5}
                className="block border-t border-line-strong bg-canvas px-3 py-2 text-left lg:table-cell"
              >
                <span className="display text-lg">{group.title}</span>{" "}
                <span className="text-sm font-normal text-ink-2">{group.body}</span>
              </th>
            </tr>
            {rows.map(({ record: r, swaps, pick }) => (
              <tr key={r.id} role="row" className="block border-t border-line pb-2 lg:table-row lg:border-0">
                <th role="rowheader" scope="row" className="block px-3 pt-3 pb-1.5 text-left font-normal lg:table-cell lg:border-t lg:border-line lg:py-3 lg:align-top">
                  <span className="flex items-start gap-2.5">
                    {pick?.alternative.photo && (
                      <ProductThumb size="xs" image={pick.alternative.photo.src} brand={pick.alternative.brand} alt={pick.alternative.product} />
                    )}
                    <span className="min-w-0">
                      <span className="block text-[15px] leading-snug font-semibold">{r.label}</span>
                      {pick && (
                        <Link
                          href={`/compare/${pick.slug}`}
                          className="inline-flex min-h-11 items-center text-[13px] font-medium text-cobalt underline underline-offset-2 lg:min-h-0"
                        >
                          {swaps} swap{swaps === 1 ? "" : "s"}
                        </Link>
                      )}
                    </span>
                  </span>
                </th>
                <Cell label="Unopened">{r.unopened}</Cell>
                <Cell label="Once opened">{r.opened || "Not given"}</Cell>
                <Cell label="Where to keep it">{r.storage || "Not given"}</Cell>
                <td role="cell" className="block px-3 pb-1 text-sm text-ink-2 lg:table-cell lg:border-t lg:border-line lg:py-3 lg:align-top">
                  {r.note && <p className="mb-1.5">{r.note}</p>}
                  <Citations sources={r.sources} />
                </td>
              </tr>
            ))}
          </tbody>
        );
      })}
    </table>
  );
}

/* --------------------------------------------------------------------- the page */

export default function WhyPage() {
  const claims = getClaims();
  const shelfLife = getShelfLife();
  const groups = groupByAisle(claims);
  const lost = claims.map((claim) => ({ claim, text: lostFrom(claim) })).filter((x) => x.text);
  const publishers = new Set(claims.flatMap((c) => c.sources.map((s) => s.publisher))).size;

  if (!claims.length && !shelfLife.length) {
    return (
      <section className="container-page pt-4 md:pt-6">
        <h1 className="display text-[1.75rem] md:text-[2.5rem]">Why it&apos;s worth switching</h1>
        <p className="mt-2 max-w-[62ch] text-[15px] text-ink-2">
          No findings are listed yet. Each swap still shows its own evidence and sources.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="border-b border-line bg-canvas">
        <div className="container-page pt-4 pb-5 md:pt-6 md:pb-6">
          <h1 className="display text-[1.75rem] md:text-[2.5rem]">Why it&apos;s worth switching</h1>
          <p className="mt-1.5 max-w-[68ch] text-[15px] text-ink-2 md:text-base">
            What testers, regulators and researchers found about paying for the brand, and where the cheap option lost.
            {claims.length > 0 && (
              <>
                {" "}
                <span className="num">{claims.length}</span> finding{claims.length === 1 ? "" : "s"} from{" "}
                <span className="num">{publishers}</span> publisher{publishers === 1 ? "" : "s"}, each with where the evidence stops.
              </>
            )}
          </p>
          <nav aria-label="On this page" className="mt-3 flex flex-wrap gap-x-4 text-sm font-medium">
            {groups.map((g) => (
              <a key={g.id} href={`#${g.id}`} className="inline-flex min-h-11 items-center text-cobalt underline-offset-2 hover:underline md:min-h-7">
                {g.name}
              </a>
            ))}
            {shelfLife.length > 0 && (
              <a href="#keeps" className="inline-flex min-h-11 items-center text-cobalt underline-offset-2 hover:underline md:min-h-7">
                How long things keep
              </a>
            )}
            {lost.length > 0 && (
              <a href="#lost" className="inline-flex min-h-11 items-center text-cobalt underline-offset-2 hover:underline md:min-h-7">
                Where the cheap option lost
              </a>
            )}
          </nav>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.id} id={g.id} className="container-page scroll-mt-24 pt-6 md:pt-8">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6">
            <h2 className="display text-xl md:text-2xl">{g.name}</h2>
            {g.swaps > 0 && (
              <Link href={`/category/${g.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline-offset-2 hover:underline md:min-h-0">
                See {g.swaps} swap{g.swaps === 1 ? "" : "s"}
              </Link>
            )}
          </div>
          {g.findings.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {g.findings.map((c) => (
                <div key={c.id} id={c.id} className="scroll-mt-24">
                  <Finding claim={c} full className="h-full" />
                </div>
              ))}
            </div>
          )}
          {g.alsoHere.length > 0 && (
            <div className={g.findings.length ? "mt-3" : ""}>
              <p className="text-sm font-medium text-ink-2">Also about this aisle:</p>
              <ul className="text-sm">
                {g.alsoHere.map((c) => (
                  <li key={c.id}>
                    <a href={`#${c.id}`} className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2 md:min-h-7">
                      {c.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}

      {shelfLife.length > 0 && (
        <section id="keeps" className="mt-8 scroll-mt-24 border-t border-line md:mt-10">
          <div className="container-page pt-6 md:pt-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6">
              <div className="max-w-[68ch]">
                <h2 className="display text-xl md:text-2xl">How long things keep</h2>
                <p className="mt-1 text-sm text-ink-2 md:text-[15px]">
                  A bigger pack only saves money if you use it before it goes off. Where sources disagree, the row says so.
                </p>
              </div>
              <Link href="/credits" className="inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline-offset-2 hover:underline md:min-h-0">
                Photos
              </Link>
            </div>
            <ShelfTable records={shelfLife} />
          </div>
        </section>
      )}

      {lost.length > 0 && (
        <section id="lost" className="mt-8 scroll-mt-24 border-t border-line md:mt-10">
          <div className="container-page pt-6 md:pt-8">
            <div className="mb-3 max-w-[68ch]">
              <h2 className="display text-xl md:text-2xl">Where the cheap option lost</h2>
              <p className="mt-1 text-sm text-ink-2 md:text-[15px]">
                Cheap doesn&apos;t always win. These are the results from the findings above that went the other way, so check a swap&apos;s
                evidence before you switch.
              </p>
            </div>
            <ul className="grid gap-x-8 md:grid-cols-2">
              {lost.map(({ claim, text }) => (
                <li key={claim.id} className="border-t border-line py-3">
                  <h3 className="text-[15px] leading-snug">
                    <a href={`#${claim.id}`} className="hover:underline">
                      {claim.title}
                    </a>
                  </h3>
                  <p className="mt-1 max-w-[68ch] text-sm text-ink-2">{text}</p>
                  <div className="mt-1.5">
                    <Citations sources={claim.sources} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

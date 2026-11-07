import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { firstScreenSlugs, SWAP_GRID, type BrowseRow } from "@/lib/browse";
import { toSummary } from "@/lib/catalog";
import { monthYear } from "@/lib/format";
import { APPROX_USD } from "@/lib/markets";
import { NO_PHOTO_TIER, photoTier } from "@/lib/photos";
import type { CategorySlug, Pair, PairSummary } from "@/lib/types";
import { unitDisplay } from "@/lib/unit-format";
import { PairBrowser } from "./PairBrowser";
import { PairCard, PairRow, PairRows } from "./PairCard";
import { ProductThumb } from "./ProductThumb";
import { PctTicket, Ticket } from "./Ticket";

/**
 * The one system behind every list of swaps: category, biggest savings, brand, ingredient and
 * dupe pages. The same head and the same grid on the same canvas band as the home page.
 */

/** Past this many swaps a list gets filters. Shorter lists ship no client code of their own. */
const FILTER_FROM = 13;

/** Leaves off what a card doesn't read. */
function toCard(p: Pair): PairSummary {
  return { ...toSummary(p), title: "", keywords: "" };
}

function toRow(p: Pair): BrowseRow {
  return {
    slug: p.slug,
    aisle: p.category,
    shelf: p.subcategory.replace(/\s+-\s+/g, ": "),
    match: p.match_type,
    market: p.market,
    photo: Boolean(p.brand.photo || p.alternative.photo),
    tier: photoTier(p.brand.photo, p.alternative.photo),
    pct: Math.round(p.savingsPct * 10) / 10,
    unit: Number((p.alternative.ppu * unitDisplay(p.brand.unit).factor * APPROX_USD[p.currency]).toPrecision(4)),
    checked: p.price_checked,
  };
}

/** Props for PairBrowser: a light row for every swap, and card data for the first screen only. */
export function browseProps(pairs: Pair[], { hideMedicine = false }: { hideMedicine?: boolean } = {}) {
  const rows = pairs.map(toRow);
  const first = firstScreenSlugs(rows, hideMedicine);
  return { rows, cards: pairs.filter((p) => first.has(p.slug)).map(toCard), hideMedicine };
}

/** Cache Components needs at least one param. A placeholder with no catalogue row falls through to notFound(). */
export function atLeastOneParam(slugs: string[]) {
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "__none__" }];
}

export function bestSaving(pairs: { savingsPct: number }[]) {
  return pairs.reduce((best, p) => Math.max(best, p.savingsPct), 0);
}

export function swapCount(n: number) {
  return `${n} swap${n === 1 ? "" : "s"}`;
}

type Crumb = { href?: string; label: string };

function Crumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center text-[13px] font-medium text-muted">
        {crumbs.map((c, i) => (
          <li key={c.label} className="flex min-w-0 items-center">
            {i > 0 && <ChevronRight className="mx-0.5 h-3 w-3 shrink-0" aria-hidden="true" />}
            {c.href ? (
              <Link href={c.href} className="inline-flex min-h-11 items-center hover:text-ink hover:underline md:min-h-8">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="inline-flex min-h-11 items-center text-ink-2 md:min-h-8">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The two links every list carries: how the swaps are checked, and where the photos come from. */
export function ListLinks() {
  const link = "inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-0";
  return (
    <span className="flex gap-3 md:justify-end">
      <Link href="/how-we-verify" className={link}>
        How we check
      </Link>
      <Link href="/credits" className={link}>
        Photos
      </Link>
    </span>
  );
}

/** "Average saving 34%. Prices last checked November 2026." */
export function PriceFacts({ pairs }: { pairs: { savingsPct: number; price_checked: string }[] }) {
  const average = pairs.reduce((sum, p) => sum + p.savingsPct, 0) / (pairs.length || 1);
  const latest = pairs.reduce((newest, p) => (p.price_checked > newest ? p.price_checked : newest), "");
  return (
    <>
      {pairs.length > 1 && (
        <>
          Average saving <span className="num">{Math.round(average)}%</span>.{" "}
        </>
      )}
      {latest && <>Prices last checked {monthYear(latest)}.</>}
      <ListLinks />
    </>
  );
}

/** Breadcrumb, H1 and what the list is on the left. The biggest saving as a shelf ticket on the right. */
export function ShelfHead({
  crumbs,
  title,
  intro,
  best = 0,
  facts,
}: {
  crumbs: Crumb[];
  title: ReactNode;
  intro?: ReactNode;
  /** The biggest saving, 0 to 100. Leaves the ticket off at 0. */
  best?: number;
  facts?: ReactNode;
}) {
  const n = Math.round(best);
  return (
    <header className="container-page pb-4 md:pb-5">
      <Crumbs crumbs={crumbs} />
      <div className="grid gap-x-10 gap-y-3 md:grid-cols-[minmax(0,1fr)_auto] md:pt-1">
        <div className="min-w-0">
          <h1 className="display text-[1.75rem] md:text-[2.5rem]">{title}</h1>
          {intro && <p className="mt-2 max-w-[68ch] text-[15px] text-ink-2 md:text-base">{intro}</p>}
        </div>
        {(n > 0 || facts) && (
          <div className="flex items-center gap-3 md:max-w-60 md:flex-col md:items-end md:gap-2 md:text-right">
            {n > 0 && (
              <Ticket size="lg" sub="biggest saving" label={`Up to ${n}% cheaper per unit`} className="shrink-0">
                −{n}%
              </Ticket>
            )}
            {facts && <p className="text-[13px] leading-snug text-ink-2">{facts}</p>}
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * A plain list with no client code of its own, for lists too short to need filtering. Keeps the order
 * it's given inside each photo tier, with cards first and swaps with no photo as text rows after them.
 */
export function SwapGrid({ pairs, lazy = false }: { pairs: Pair[]; lazy?: boolean }) {
  const tier = (p: Pair) => photoTier(p.brand.photo, p.alternative.photo);
  const ordered = [...pairs].sort((a, b) => tier(a) - tier(b));
  const cards = ordered.filter((p) => tier(p) !== NO_PHOTO_TIER);
  const rows = ordered.filter((p) => tier(p) === NO_PHOTO_TIER);
  return (
    <>
      {cards.length > 0 && (
        <ul className={SWAP_GRID}>
          {cards.map((p, i) => (
            <li key={p.slug} className="min-w-0">
              <PairCard pair={toCard(p)} eager={!lazy && i === 0} />
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <PairRows headed={cards.length > 0}>
          {rows.map((p) => (
            <li key={p.slug} className="min-w-0">
              <PairRow pair={toCard(p)} />
            </li>
          ))}
        </PairRows>
      )}
    </>
  );
}

/** Biggest saving first. Long lists get the filters, short ones stay plain. */
export function SwapList({ path, pairs }: { path: string; pairs: Pair[] }) {
  if (pairs.length >= FILTER_FROM) return <PairBrowser path={path} {...browseProps(pairs)} />;
  return <SwapGrid pairs={[...pairs].sort((a, b) => b.savingsPct - a.savingsPct)} />;
}

export type IndexEntry = {
  key: string;
  href: string;
  name: string;
  count: number;
  best: number;
  category?: CategorySlug;
  unit?: string;
  photo: string | null;
  photoName: string;
};

function letterFor(name: string) {
  const first = name.normalize("NFD")[0]?.toUpperCase() ?? "";
  return /[A-Z]/.test(first) ? first : "#";
}

/** Letters to jump between, and under each a dense grid of small cards: photo, name, how many, best saving. */
export function AzIndex({ entries }: { entries: IndexEntry[] }) {
  const groups = new Map<string, IndexEntry[]>();
  for (const e of [...entries].sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const letter = letterFor(e.name);
    groups.set(letter, [...(groups.get(letter) ?? []), e]);
  }
  const letters = [...groups.keys()].sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a < b ? -1 : 1));
  return (
    <>
      <nav aria-label="Jump to a letter">
        <ul className="rail -mx-4 flex overflow-x-auto px-3 sm:-mx-6 sm:px-5 md:mx-0 md:flex-wrap md:px-0">
          {letters.map((l) => (
            <li key={l}>
              <a
                href={`#letter-${l === "#" ? "other" : l}`}
                className="flex h-11 min-w-9 items-center justify-center rounded-tile text-[15px] font-semibold hover:bg-paper hover:underline md:h-9 md:min-w-8"
              >
                {l}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {letters.map((l) => (
        <section key={l} id={`letter-${l === "#" ? "other" : l}`} className="mt-4 scroll-mt-20 md:mt-5">
          <h2 className="display text-xl">{l}</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(groups.get(l) ?? []).map((e) => (
              <li key={e.key} className="min-w-0">
                <Link
                  href={e.href}
                  className="card group flex h-full min-h-14 items-center gap-2.5 p-1.5 pr-2.5 transition-colors hover:border-ink-2"
                >
                  <ProductThumb size="xs" image={e.photo} brand={e.photoName} category={e.category} unit={e.unit} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm leading-snug font-semibold group-hover:underline">{e.name}</span>
                    <span className="num block text-xs font-medium text-muted">{swapCount(e.count)}</span>
                  </span>
                  {e.best > 0 && <PctTicket pct={e.best} size="sm" className="shrink-0" />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Plain links for moving sideways, at phone touch size. */
export function TagLinks({ links }: { links: { href: string; label: ReactNode; key?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {links.map((l) => (
        <li key={l.key ?? l.href}>
          <Link
            href={l.href}
            className="flex min-h-11 items-center rounded-tile border border-line-strong bg-paper px-3 text-sm font-medium hover:border-ink-2 hover:underline md:min-h-9"
          >
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

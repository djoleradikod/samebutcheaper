import { Suspense, type ReactNode } from "react";
import { CountryProvider } from "@/components/CountryProvider";
import { localFor, type Local } from "@/lib/localize";
import { getPathCountry } from "@/lib/path-country";
import { getCountry, getLocal } from "@/lib/server-country";
import { reportedRecords } from "@/lib/reported";

async function ForCountry({ children }: { children: (local: Local) => ReactNode }) {
  const [local] = await Promise.all([getLocal(), reportedRecords()]);
  // The raw reading: an unknown shopper's Local stands in a default country, and client components have to know it's unknown.
  return (
    <CountryProvider country={await getCountry()} others={local.others}>
      {children(local)}
    </CountryProvider>
  );
}

/** A country's view that doesn't depend on the request: a prefixed page's country, or null for the record's own view. */
function FixedView({ country, children }: { country: string | null; children: (local: Local) => ReactNode }) {
  return (
    <CountryProvider country={country} others={false} fixed>
      {children(localFor(country))}
    </CountryProvider>
  );
}

/**
 * The part of a page that depends on the shopper's country. It renders per request, so it has the right currency,
 * prices and stores the first time it shows. Everything outside one of these is in the static HTML, for every country,
 * so it can't name a price or a store. A fallback can be empty but mustn't show any country's data.
 * Client components that read the country only work in here: useCountry throws at build time anywhere else.
 *
 * On a prefixed page (/de/..., see src/lib/country-url.ts) the country is the URL's, so the part renders straight into
 * the static HTML with that country's view and no fallback.
 */
export function CountryPart({
  fallback = <div className="min-h-[70vh]" />,
  children,
}: {
  /** Holds the page's height by default. Pass null for a small piece. */
  fallback?: ReactNode;
  children: (local: Local) => ReactNode;
}) {
  const pathCountry = getPathCountry();
  if (pathCountry) return <FixedView country={pathCountry}>{children}</FixedView>;
  return (
    <Suspense fallback={fallback}>
      <ForCountry>{children}</ForCountry>
    </Suspense>
  );
}

/**
 * A CountryPart for one record's page (a swap, kit or basket) whose stand-in is the record's own view: its own market's
 * prices, currency and stores, nothing converted, the view a crawler and a visitor we can't place get. So the static HTML
 * carries the whole page, readable without JavaScript, and the shopper's own view replaces it in the same place, the same
 * shape, so nothing jumps. `own: false` keeps an empty stand-in for a piece that only some countries show.
 */
export function RecordPart({
  own = true,
  standIn = null,
  children,
}: {
  own?: boolean;
  /** With `own: false`, what holds the piece's place instead (see src/lib/reserve.ts). */
  standIn?: ReactNode;
  children: (local: Local) => ReactNode;
}) {
  return <CountryPart fallback={own ? <FixedView country={null}>{children}</FixedView> : standIn}>{children}</CountryPart>;
}

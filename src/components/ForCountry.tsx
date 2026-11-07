import { Suspense, type ReactNode } from "react";
import { CountryProvider } from "@/components/CountryProvider";
import type { Local } from "@/lib/localize";
import { getCountry, getLocal } from "@/lib/server-country";

async function ForCountry({ children }: { children: (local: Local) => ReactNode }) {
  const local = await getLocal();
  // The raw reading: an unknown shopper's Local stands in a default country, and client components have to know it's unknown.
  return (
    <CountryProvider country={await getCountry()} others={local.others}>
      {children(local)}
    </CountryProvider>
  );
}

/**
 * The part of a page that depends on the shopper's country. It renders per request, so it has the right currency,
 * prices and stores the first time it shows. Everything outside one of these is in the static HTML, for every country,
 * so it can't name a price or a store. A fallback can be empty but mustn't show any country's data.
 * Client components that read the country only work in here: useCountry throws at build time anywhere else.
 */
export function CountryPart({
  fallback = <div className="min-h-[70vh]" />,
  children,
}: {
  /** Holds the page's height by default. Pass null for a small piece. */
  fallback?: ReactNode;
  children: (local: Local) => ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <ForCountry>{children}</ForCountry>
    </Suspense>
  );
}

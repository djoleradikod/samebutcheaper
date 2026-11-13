"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useContext, type ComponentProps } from "react";
import { CountryContext, FixedContext } from "@/lib/client/country";
import { useShopperPrefix } from "@/lib/client/shopper-country";
import { countryOfPath, hrefOnPage, isPrefixable } from "@/lib/country-url";

type Props = ComponentProps<typeof Link>;

const on = (props: Props, country: string | null): Props =>
  typeof props.href === "string" ? { ...props, href: hrefOnPage(props.href, country) } : props;

function FromPath({ shopper, ...props }: Props & { shopper: string | null }) {
  return <Link {...on(props, countryOfPath(usePathname()) ?? shopper)} />;
}

/**
 * next/link that stays within the page's country prefix: on /de/... a link to /compare/x goes to /de/compare/x, and a
 * link to a page with no prefixed form (/brands) goes there unchanged. A drop-in for next/link's default export, so a
 * component switches with its import line.
 *
 * On an unprefixed page the server writes every link as given. In the browser, a shopper whose country has a prefix
 * then gets that country's URLs (src/lib/shopper-links.ts), so what they share or bookmark carries their country.
 *
 * Inside a page's fixed country (every prefixed page) the country is known from the server, so the href is right in
 * the static HTML. Elsewhere (the header and footer) the path is read: at build time for a prerendered page, and at
 * request time for one rendered on demand, which is what the Suspense is for. A link to a page with no prefixed form
 * needs neither. Keep what goes inside small: React sends a finished boundary over 500 bytes later in the stream, so a
 * big one would start out as written even on a prerendered page (the header's logo link is an overlay for that reason).
 */
export default function CountryLink(props: Props) {
  const fixed = useContext(FixedContext);
  const country = useContext(CountryContext);
  const shopper = useShopperPrefix();
  if (typeof props.href === "string" && !isPrefixable(props.href)) return <Link {...props} />;
  // A fixed country with none named is a record's own view standing in on an unprefixed page.
  if (fixed) return <Link {...on(props, country ?? shopper)} />;
  return (
    <Suspense fallback={<Link {...on(props, shopper)} />}>
      <FromPath {...props} shopper={shopper} />
    </Suspense>
  );
}

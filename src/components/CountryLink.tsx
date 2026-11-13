"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useContext, type ComponentProps } from "react";
import { CountryContext, FixedContext } from "@/lib/client/country";
import { countryOfPath, hrefOnPage } from "@/lib/country-url";

type Props = ComponentProps<typeof Link>;

const on = (props: Props, country: string | null): Props =>
  typeof props.href === "string" ? { ...props, href: hrefOnPage(props.href, country) } : props;

function FromPath(props: Props) {
  return <Link {...on(props, countryOfPath(usePathname()))} />;
}

/**
 * next/link that stays within the page's country prefix: on /de/... a link to /compare/x goes to /de/compare/x, and a
 * link to a page with no prefixed form (/brands) goes there unchanged. On an unprefixed page every link is as written.
 * A drop-in for next/link's default export, so a component switches with its import line.
 *
 * Inside a page's fixed country (every prefixed page, and a record's own view) the country is known from the server, so
 * the href is right in the static HTML. Elsewhere (the header and footer) the path is read: at build time for a
 * prerendered page, and at request time for one rendered on demand, which is what the Suspense is for. Until then the
 * link reads as written.
 */
export default function CountryLink(props: Props) {
  const fixed = useContext(FixedContext);
  const country = useContext(CountryContext);
  if (fixed) return <Link {...on(props, country ?? null)} />;
  return (
    <Suspense fallback={<Link {...props} />}>
      <FromPath {...props} />
    </Suspense>
  );
}

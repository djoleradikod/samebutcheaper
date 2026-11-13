import { getAllBundles, getBundle } from "@/lib/catalog";
import { OG_SIZE, shareImage } from "@/lib/og";

export const alt = "A brand's kit rebuilt from cheaper products that cover the same amount";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  const params = getAllBundles().map((b) => ({ slug: b.slug }));
  return params.length ? params : [{ slug: "__no-kits__" }];
}

/** The saving after any extra delivery, as the page leads with it. The kit's own summary says what it is. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = getBundle(slug);
  if (!b) return shareImage({ title: "Same job. Lower price." });
  return shareImage({
    kicker: `Instead of the ${b.bundle.brand} kit`,
    title: `${b.bundle.name.split(/,\s|\s\(/)[0]}, rebuilt`,
    sub: b.summary,
    pct: b.netSavingsPct,
  });
}

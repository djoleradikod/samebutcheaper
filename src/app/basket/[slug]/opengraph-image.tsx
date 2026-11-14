import { getAllPresets, getPreset } from "@/lib/catalog";
import { money } from "@/lib/format";
import { OG_SIZE, shareImage } from "@/lib/og";

export const alt = "A shopping basket priced in brand names and in cheaper swaps, for the same amount";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  const params = getAllPresets().map((p) => ({ slug: p.slug }));
  return params.length ? params : [{ slug: "__no-baskets__" }];
}

/** Both totals buy the same amount, in the basket's own market and currency, as the page's head says. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPreset(slug);
  if (!p) return shareImage({ title: "Same job. Lower price." });
  return shareImage({
    kicker: p.audience,
    title: p.title,
    sub: `${p.lines.length} brand-name items and the cheaper swap for each. ${p.blurb}`,
    pct: p.savingsPct,
    // No totals where a store's affiliate terms withhold a line's prices (src/lib/programme-terms.ts).
    prices: p.withheld ? undefined : { cheap: money(p.altTotal, p.currency), brand: money(p.brandTotal, p.currency), unit: "for the same shop" },
  });
}

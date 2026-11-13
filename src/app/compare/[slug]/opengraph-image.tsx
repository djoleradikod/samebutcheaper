import { getAllPairs, getPair } from "@/lib/catalog";
import { OG_SIZE, shareImage } from "@/lib/og";
import { unitDisplay, unitPrice } from "@/lib/unit-format";

export const alt = "A brand name beside a cheaper product that does the same job";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return getAllPairs().map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pair = getPair(slug);
  if (!pair) return shareImage({ title: "Same job. Lower price." });
  return shareImage({
    kicker: `Instead of ${pair.brand.brand}`,
    title: pair.alternative.brand,
    sub: pair.summary,
    pct: pair.savingsPct,
    prices: {
      cheap: unitPrice(pair.alternative.ppu, pair.brand.unit, pair.currency),
      brand: unitPrice(pair.brand.ppu, pair.brand.unit, pair.currency),
      unit: unitDisplay(pair.brand.unit).label,
    },
  });
}

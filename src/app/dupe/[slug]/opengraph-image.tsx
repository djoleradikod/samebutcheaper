import { getDupe, getDupes } from "@/lib/catalog";
import { OG_SIZE, shareImage } from "@/lib/og";
import { unitDisplay, unitPrice } from "@/lib/unit-format";

export const alt = "Cheaper products that do the same job as a brand name";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return getDupes().map((d) => ({ slug: d.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = getDupe(slug);
  const top = d?.pairs[0];
  if (!d || !top) return shareImage({ title: "Same job. Lower price." });
  const n = d.pairs.length;
  return shareImage({
    kicker: d.actives ? d.actives.join(", ") : d.subcategory,
    title: `Cheaper than ${d.brand}`,
    sub: `${n === 1 ? "1 cheaper match" : `${n} cheaper matches`}, led by ${top.alternative.brand}. ${top.summary}`,
    pct: top.savingsPct,
    prices: {
      cheap: unitPrice(top.alternative.ppu, top.brand.unit, top.currency),
      brand: unitPrice(top.brand.ppu, top.brand.unit, top.currency),
      unit: unitDisplay(top.brand.unit).label,
    },
  });
}

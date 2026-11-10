import { getAllPairs } from "@/lib/catalog";
import { OG_SIZE, shareImage } from "@/lib/og";

export const alt = "SameButCheaper: cheaper products that do the same job as the brand names";
export const size = OG_SIZE;
export const contentType = "image/png";

/** The default share image for every page without its own. */
export default function Image() {
  const pairs = getAllPairs();
  const top = Math.max(...pairs.map((p) => p.savingsPct));
  return shareImage({
    kicker: "Brand names beside cheaper products",
    title: "Same job. Lower price.",
    sub: `${pairs.length} swaps compared per unit, up to ${Math.round(top)}% cheaper, each with at least two sources and an honest list of what differs.`,
  });
}

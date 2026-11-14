/**
 * What a page says about earning, decided per link. A link earns when /go would send the shopper through a tag: a
 * programme switched on by its env setting, or an affiliate feed's tracked link that replaces the store link
 * (docs/feeds.md). Everything else says it earns nothing, in English and German alike.
 */
import { affiliateEnv, type Env } from "./affiliate-links";
import { linkStoreName, linksEarn, mayEarn } from "./affiliate";
import { getT, type Lang } from "./i18n";
import type { Bundle, Pair } from "./types";

type SwapLinks = Pick<Pair, "market" | "alternative" | "brand"> & { prices?: Partial<Pair["prices"]> };
type KitLinks = Pick<Bundle, "market" | "bundle" | "components"> & { prices?: Bundle["prices"] };

/** The sides of a swap whose buy link earns, cheaper one first. */
export function earningSides(pair: SwapLinks, env: Env = affiliateEnv()) {
  return (["alternative", "brand"] as const).filter((s) => mayEarn(pair[s], pair.market, pair.prices?.[s], env));
}

/** The line under a swap's prices. */
export function swapDisclosure(pair: SwapLinks, lang: Lang, env: Env = affiliateEnv(), feedSides?: number) {
  const t = getT(lang);
  const earning = earningSides(pair, env);
  // A store search or bigger pack further down can still carry a tag when these two don't.
  if (earning.length === 0) return linksEarn(env, feedSides) ? t("swap.disclosure.noneHereSomeBelow") : t("swap.disclosure.none");
  if (earning.length === 2) return t("swap.disclosure.both");
  return t("swap.disclosure.one", linkStoreName(pair[earning[0]]));
}

/** Whether any buy link on a kit page earns: the kit itself or one of its pieces. */
export function kitEarns(b: KitLinks, env: Env = affiliateEnv()) {
  return (
    mayEarn(b.bundle, b.market, b.prices?.kit, env) ||
    b.components.some((c) => mayEarn(c, b.market, b.prices?.[`item-${c.replaces}`], env))
  );
}

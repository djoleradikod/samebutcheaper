/**
 * Tracked links that come out of affiliate product feeds (docs/feeds.md). A feed gives each product a link that
 * already carries our publisher account, so the /go redirect sends shoppers there instead of building a link
 * itself. Only these networks' own click hosts are accepted: a feed row can't point /go at an arbitrary site.
 *
 * Shared by the site (src/lib/affiliate-links.ts tagLink, the /go route) and the price scripts (attach.ts).
 * No secrets here: a tracked link is what a shopper's browser sees anyway.
 */

export const FEED_NETWORKS = ["awin", "impact", "cj", "rakuten", "flexoffers"] as const;
export type FeedNetwork = (typeof FEED_NETWORKS)[number];

type LinkRule = {
  network: FeedNetwork;
  /** Click hosts (and their subdomains) the network's tracked links use. */
  hosts?: readonly string[];
  /** Extra test on the path, for networks whose links run on the merchant's own vanity host. */
  path?: RegExp;
  /** The query parameter that carries our click ID, so a sale reported back maps to the click (/api/postback). */
  subId: string;
};

/**
 * Click hosts and sub-ID parameters, from each network's own help pages (cited in scripts/prices/feeds/formats.ts):
 * Awin `awin1.com/pclick.php` and `cread.php` with `clickref`; Rakuten `click.linksynergy.com` with `u1`; CJ's
 * click domains with `sid`; Impact's `/c/<partner>/<ad>/<campaign>` links (on `*.sjv.io`, `*.pxf.io`, `*.7eer.net`,
 * `*.evyy.net` or a merchant's vanity host such as goto.walmart.com) with `subId1`; FlexOffers `track.flexlinks.com`
 * and `track.flexlinkspro.com` with `fobs`.
 */
const RULES: readonly LinkRule[] = [
  { network: "awin", hosts: ["awin1.com"], subId: "clickref" },
  { network: "rakuten", hosts: ["linksynergy.com"], subId: "u1" },
  { network: "cj", hosts: ["anrdoezrs.net", "dpbolvw.net", "jdoqocy.com", "kqzyfj.com", "tkqlhce.com", "emjcd.com"], subId: "sid" },
  { network: "flexoffers", hosts: ["flexlinks.com", "flexlinkspro.com"], subId: "fobs" },
  { network: "impact", hosts: ["sjv.io", "pxf.io", "7eer.net", "evyy.net", "ojrq.net", "goto.walmart.com", "goto.target.com"], path: /^\/c\/\d+\/\d+\/\d+/, subId: "subId1" },
];

const hostMatches = (host: string, hosts: readonly string[]) => hosts.some((h) => host === h || host.endsWith(`.${h}`));

/** The network whose tracked link this is, or null for anything else (a plain store URL, an unknown host, http). */
export function feedLinkNetwork(url: string): FeedNetwork | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  for (const r of RULES) {
    if (r.hosts && !hostMatches(host, r.hosts)) continue;
    if (r.path && !r.path.test(u.pathname)) continue;
    return r.network;
  }
  return null;
}

/** A feed's tracked link with our click ID in the network's sub-ID field; null when it isn't a feed link. */
export function feedClickLink(url: string, clickId: string): { url: string; network: FeedNetwork } | null {
  const network = feedLinkNetwork(url);
  if (!network) return null;
  const u = new URL(url);
  const rule = RULES.find((r) => r.network === network)!;
  if (clickId) u.searchParams.set(rule.subId, clickId);
  return { url: u.toString(), network };
}

/** What the build attaches to a side whose newest reading came from a feed. */
export type FeedInfo = {
  network: string;
  /** The feed's tracked link; only set when feedLinkNetwork accepts it. */
  link?: string;
  /** The day the feed was read. */
  seen: string;
  /** When the feed was read (ISO time), on readings logged since it was kept. A 24-hour price rule counts from it. */
  at?: string;
  stock: "in" | "out" | "unknown";
};

/** Where /go sends a shopper for this side: the feed's tracked link when there is one, else the store URL. */
export function feedLinkOr(seen: { feed?: FeedInfo } | undefined, fallback: string) {
  return seen?.feed?.link ?? fallback;
}

/**
 * Affiliate link engine: turns any store URL into a tracked affiliate link.
 *
 * How a link is chosen, in order:
 *   1. A direct program for the store's host (Amazon Associates, Impact, Awin,
 *      Rakuten, CJ, Partnerize or a raw template), when its IDs are configured.
 *   2. A sub-affiliate network (Skimlinks or Sovrn Commerce) that monetises
 *      thousands of stores we haven't joined directly.
 *   3. The plain URL, so links always work.
 *
 * Every link carries our click ID in the network's sub-ID field, so a sale
 * reported back by the network (see /api/postback) maps to the exact swap,
 * side and country that produced it.
 *
 * All IDs come from env (see .env.example), so nothing secret is in the repo
 * and joining a new program needs no code change.
 */
import { PROGRAMS, type Program } from "./affiliate-programs";
import { feedClickLink } from "./feed-links";

export type Env = Record<string, string | undefined>;

/** Env vars that configure affiliate links. next.config.ts bakes these into AFFILIATE_CONFIG at build time. */
export const AFFILIATE_ENV_PATTERN =
  /^(AFF_[A-Z0-9_]+|AMAZON_ASSOCIATE_TAG|AMAZON_TAGS|AWIN_PUBLISHER_ID|RAKUTEN_SITE_ID|CJ_PID|SKIMLINKS_ID|SOVRN_KEY|AFFILIATE_FALLBACK|WALMART_AFFILIATE_TEMPLATE|TARGET_AFFILIATE_TEMPLATE)$/;

/** The affiliate settings out of an environment, with the two older template vars mapped onto their programs. */
export function pickAffiliateEnv(source: Env): Env {
  const out: Env = {};
  for (const [k, v] of Object.entries(source)) if (AFFILIATE_ENV_PATTERN.test(k) && v?.trim()) out[k] = v.trim();
  if (out.WALMART_AFFILIATE_TEMPLATE && !out.AFF_WALMART_US) out.AFF_WALMART_US = out.WALMART_AFFILIATE_TEMPLATE;
  if (out.TARGET_AFFILIATE_TEMPLATE && !out.AFF_TARGET) out.AFF_TARGET = out.TARGET_AFFILIATE_TEMPLATE;
  return out;
}

let baked: Env | undefined;
/**
 * The settings the site was built with. Most pages are prerendered, and their wording about earning has to
 * match what the links really do, so a value that only exists at run time must not switch tagging on.
 * Outside Next (scripts, tests) there is no baked value, and the live environment is read instead.
 */
export function affiliateEnv(): Env {
  if (baked) return baked;
  const json = process.env.AFFILIATE_CONFIG;
  try {
    baked = json ? (JSON.parse(json) as Env) : pickAffiliateEnv(process.env);
  } catch {
    baked = {};
  }
  return baked;
}

/** Forgets the settings read so far, so a test can change the environment between cases. */
export function resetAffiliateEnv() {
  baked = undefined;
}

export type TaggedLink = {
  url: string;
  /** Program id ("walmart-us"), "skimlinks", "sovrn", or null when untagged. */
  program: string | null;
  network: Program["network"] | "skimlinks" | "sovrn" | null;
};

const hostOf = (u: URL) => u.hostname.replace(/^www\./, "").toLowerCase();

function hostMatches(host: string, hosts: readonly string[]) {
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

/** The program that covers a URL's host, whether or not we've joined it. */
export function programFor(url: string): Program | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  const host = hostOf(u);
  return PROGRAMS.find((p) => hostMatches(host, p.hosts));
}

/** The env var that switches a program on: "walmart-us" -> AFF_WALMART_US. */
export function programEnvKey(id: string) {
  return `AFF_${id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

/** Associates tag for an Amazon storefront, e.g. "amazon.de". */
export function amazonTag(domain: string, env: Env = affiliateEnv()): string | undefined {
  const d = domain.replace(/^www\./, "").toLowerCase();
  for (const entry of (env.AMAZON_TAGS ?? "").split(",")) {
    const [host, tag] = entry.split(":").map((s) => s?.trim());
    if (host && tag && host.toLowerCase().replace(/^www\./, "") === d) return tag;
  }
  return d === "amazon.com" ? env.AMAZON_ASSOCIATE_TAG || undefined : undefined;
}

const enc = encodeURIComponent;

function fillTemplate(template: string, url: string, clickId: string) {
  return template.replaceAll("{url}", enc(url)).replaceAll("{raw_url}", url).replaceAll("{click}", enc(clickId));
}

/** Builds the direct-program link, or null when the program isn't configured. */
function directLink(p: Program, url: string, clickId: string, env: Env): string | null {
  const own = env[programEnvKey(p.id)]?.trim();
  // "1" (or "on"/"true") just switches the program on; any other number is a merchant ID.
  const merchantOverride = own && /^\d{2,}$/.test(own) ? own : undefined;
  const enabled = Boolean(own) && own !== "0" && own !== "false";
  // A full template always wins: "https://...{url}...{click}".
  if (own?.includes("{url}") || own?.includes("{raw_url}")) return fillTemplate(own, url, clickId);

  switch (p.network) {
    case "amazon": {
      const u = new URL(url);
      const tag = amazonTag(hostOf(u), env);
      if (!tag) return null;
      u.searchParams.set("tag", tag);
      return u.toString();
    }
    case "impact": {
      // Value is the program's tracking link from the Impact dashboard, e.g.
      // https://goto.walmart.com/c/1234567/565706/9383
      if (!own || !/^https:\/\//.test(own)) return null;
      const base = new URL(own);
      base.searchParams.set("u", url);
      if (clickId) base.searchParams.set("subId1", clickId);
      return base.toString();
    }
    case "awin": {
      const publisher = env.AWIN_PUBLISHER_ID?.trim();
      const merchant = merchantOverride ?? (enabled ? p.merchantId : undefined);
      if (!publisher || !merchant) return null;
      return `https://www.awin1.com/cread.php?awinmid=${merchant}&awinaffid=${enc(publisher)}&clickref=${enc(clickId)}&ued=${enc(url)}`;
    }
    case "rakuten": {
      const site = env.RAKUTEN_SITE_ID?.trim();
      const mid = merchantOverride ?? (enabled ? p.merchantId : undefined);
      if (!site || !mid) return null;
      return `https://click.linksynergy.com/deeplink?id=${enc(site)}&mid=${mid}&u1=${enc(clickId)}&murl=${enc(url)}`;
    }
    case "cj": {
      // CJ's deep link generator works for any advertiser we're approved for.
      const pid = env.CJ_PID?.trim();
      if (!pid || !enabled) return null;
      return `https://www.anrdoezrs.net/links/${enc(pid)}/type/dlg/sid/${enc(clickId || "x")}/${url}`;
    }
    case "partnerize": {
      // Value is the campaign reference ("camref") from the Partnerize dashboard.
      if (!own) return null;
      return `https://prf.hn/click/camref:${enc(own)}/pubref:${enc(clickId)}/destination:${enc(url)}`;
    }
    case "template":
      return null; // only a full template (handled above) can enable these
  }
}

/** Hosts we never send through a sub-network (our own site, search engines). */
const NEVER_WRAP = ["google.com", "bing.com", "duckduckgo.com"];

function subNetworkLink(url: string, clickId: string, env: Env): TaggedLink | null {
  const order = (env.AFFILIATE_FALLBACK ?? "skimlinks,sovrn").split(",").map((s) => s.trim());
  for (const net of order) {
    if (net === "skimlinks" && env.SKIMLINKS_ID) {
      return {
        url: `https://go.skimresources.com/?id=${enc(env.SKIMLINKS_ID)}&xs=1&url=${enc(url)}&xcust=${enc(clickId)}`,
        program: "skimlinks",
        network: "skimlinks",
      };
    }
    if (net === "sovrn" && env.SOVRN_KEY) {
      return {
        url: `https://redirect.viglink.com?key=${enc(env.SOVRN_KEY)}&u=${enc(url)}&cuid=${enc(clickId)}`,
        program: "sovrn",
        network: "sovrn",
      };
    }
  }
  return null;
}

/**
 * Turns a store URL into the best affiliate link we have for it.
 * `clickId` is our own ID for this click (see newClickId); pass "" when there's none.
 */
export function tagLink(url: string, clickId = "", env: Env = affiliateEnv()): TaggedLink {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { url, program: null, network: null };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { url, program: null, network: null };
  // A tracked link from an affiliate product feed (docs/feeds.md) already carries our account: add the click ID only.
  const feed = feedClickLink(url, clickId);
  if (feed) return { url: feed.url, program: `feed:${feed.network}`, network: feed.network === "flexoffers" ? "template" : feed.network };
  const host = hostOf(u);

  const program = PROGRAMS.find((p) => hostMatches(host, p.hosts));
  if (program) {
    const link = directLink(program, url, clickId, env);
    if (link) return { url: link, program: program.id, network: program.network };
    // Some stores forbid sub-network traffic (Amazon does), so don't fall through.
    if (program.noSubNetwork) return { url, program: null, network: null };
  }
  if (!hostMatches(host, NEVER_WRAP)) {
    const sub = subNetworkLink(url, clickId, env);
    if (sub) return sub;
  }
  return { url, program: null, network: null };
}

/** Programs whose IDs are set, so their links earn. */
export function livePrograms(env: Env = affiliateEnv()): Program[] {
  return PROGRAMS.filter((p) =>
    p.hosts.some((h) => directLink(p, `https://www.${h}/`, "", env) !== null),
  );
}

/** The sub-network that catches stores without a direct program, if one is set. */
export function liveSubNetwork(env: Env = affiliateEnv()): "skimlinks" | "sovrn" | null {
  return (subNetworkLink("https://example.org/", "", env)?.network as "skimlinks" | "sovrn" | undefined) ?? null;
}

/** Short, URL-safe, unguessable ID for one outbound click. */
export function newClickId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

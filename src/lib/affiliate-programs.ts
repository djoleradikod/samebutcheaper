/**
 * Affiliate programs for the stores our catalog links to.
 *
 * Joining a program is a config change, not a code change: set the program's
 * env var (programEnvKey: "walmart-us" -> AFF_WALMART_US) once you're approved.
 * What the value means depends on the network:
 *   amazon      not used; set AMAZON_ASSOCIATE_TAG / AMAZON_TAGS instead
 *   impact      the program's tracking link, e.g. https://goto.walmart.com/c/1234567/565706/9383
 *   awin        "1" (uses merchantId below) or the Awin merchant ID; needs AWIN_PUBLISHER_ID
 *   rakuten     "1" (uses merchantId below) or the Rakuten MID; needs RAKUTEN_SITE_ID
 *   cj          "1" once approved for that advertiser; needs CJ_PID
 *   partnerize  the campaign reference (camref)
 * Any program also accepts a full template with {url} (encoded), {raw_url}
 * and {click} placeholders, for networks or deals not listed here.
 *
 * `terms` is for people (admin page and docs): rates change, so check the
 * network dashboard before relying on them. Researched 2026-11-04, sources in
 * docs/affiliate-playbook.md.
 *
 * This file is shared by server and client code: no secrets here.
 */
import type { MarketCode } from "./markets";

export type Network = "amazon" | "impact" | "awin" | "rakuten" | "cj" | "partnerize" | "template";

export type Program = {
  id: string;
  name: string;
  /** Market the program pays in. Amazon covers several storefronts in one entry. */
  country: MarketCode | "INTL";
  /** Hosts (and their subdomains) that this program covers. */
  hosts: readonly string[];
  network: Network;
  /** Public merchant ID on Awin/Rakuten, when known. */
  merchantId?: string;
  /** Commission and cookie, for people. */
  terms: string;
  /** Store bans sub-network (Skimlinks/Sovrn) traffic or it can't earn there. */
  noSubNetwork?: boolean;
  /** Where to apply. */
  signup: string;
};

const AMAZON_HOSTS = [
  "amazon.com",
  "amazon.co.uk",
  "amazon.ca",
  "amazon.de",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.nl",
  "amazon.se",
  "amazon.pl",
  "amazon.com.be",
  "amazon.com.au",
  "amazon.co.jp",
  "amazon.in",
  "amazon.ae",
  "amazon.sa",
  "amazon.sg",
  "amazon.com.mx",
  "amazon.com.br",
  "amazon.com.tr",
] as const;

export const PROGRAMS: readonly Program[] = [
  {
    id: "amazon",
    name: "Amazon Associates",
    country: "INTL",
    hosts: AMAZON_HOSTS,
    network: "amazon",
    terms: "1-4.5% by category (US: 1% grocery/health, 3% beauty/pet, 4% electronics accessories); 24 h cookie, 90 days for items added to cart; whole-cart credit",
    noSubNetwork: true,
    signup: "https://affiliate-program.amazon.com/",
  },
  // ---- US ----------------------------------------------------------------
  {
    id: "walmart-us",
    name: "Walmart Creator / Affiliates",
    country: "US",
    hosts: ["walmart.com"],
    network: "impact",
    terms: "1-4% by category (OTC and health ~1-3%); 3-day cookie",
    signup: "https://affiliates.walmart.com/",
  },
  {
    id: "target",
    name: "Target Partners",
    country: "US",
    hosts: ["target.com"],
    network: "impact",
    terms: "1-8% by category (health 1%, beauty and baby up to 8%); 7-day cookie",
    signup: "https://partners.target.com/",
  },
  {
    id: "ulta",
    name: "Ulta Beauty",
    country: "US",
    hosts: ["ulta.com"],
    network: "impact",
    terms: "~2-5%; 7-day cookie",
    signup: "https://app.impact.com/",
  },
  {
    id: "chewy",
    name: "Chewy",
    country: "US",
    hosts: ["chewy.com"],
    network: "partnerize",
    terms: "~4% plus new-customer bounty; Autoship orders",
    signup: "https://www.chewy.com/app/content/affiliate-program",
  },
  {
    id: "anker",
    name: "Anker",
    country: "US",
    hosts: ["anker.com"],
    network: "impact",
    terms: "~5-8%; 30-day cookie",
    signup: "https://app.impact.com/",
  },
  {
    id: "ugreen",
    name: "UGREEN",
    country: "US",
    hosts: ["ugreen.com"],
    network: "impact",
    terms: "~5-10%",
    signup: "https://app.impact.com/",
  },
  {
    id: "logitech",
    name: "Logitech",
    country: "US",
    hosts: ["logitech.com", "logitechg.com"],
    network: "impact",
    terms: "~2-5%",
    signup: "https://app.impact.com/",
  },
  {
    id: "belkin",
    name: "Belkin",
    country: "US",
    hosts: ["belkin.com"],
    network: "impact",
    terms: "~3-5%",
    signup: "https://app.impact.com/",
  },
  {
    id: "bestbuy",
    name: "Best Buy",
    country: "US",
    hosts: ["bestbuy.com"],
    network: "impact",
    terms: "~0.5-1% on most items; 1-day cookie",
    signup: "https://app.impact.com/",
  },
  {
    id: "homedepot",
    name: "The Home Depot",
    country: "US",
    hosts: ["homedepot.com"],
    network: "impact",
    terms: "1-8% by category; 1-day cookie",
    signup: "https://app.impact.com/",
  },
  {
    id: "samsclub",
    name: "Sam's Club",
    country: "US",
    hosts: ["samsclub.com"],
    network: "impact",
    terms: "membership bounty plus % on some items",
    signup: "https://app.impact.com/",
  },
  {
    id: "cvs",
    name: "CVS",
    country: "US",
    hosts: ["cvs.com"],
    network: "cj",
    terms: "~2-4%",
    signup: "https://www.cj.com/",
  },
  {
    id: "walgreens",
    name: "Walgreens",
    country: "US",
    hosts: ["walgreens.com"],
    network: "cj",
    terms: "~1-5%",
    signup: "https://www.cj.com/",
  },
  {
    id: "iherb",
    name: "iHerb",
    country: "INTL",
    hosts: ["iherb.com"],
    network: "template",
    terms: "5% new customers, lower for returning; ships to 180+ countries",
    signup: "https://www.iherb.com/info/affiliates",
  },
  {
    id: "vitacost",
    name: "Vitacost",
    country: "US",
    hosts: ["vitacost.com"],
    network: "cj",
    terms: "~5-10%",
    signup: "https://www.cj.com/",
  },
  {
    id: "thorne",
    name: "Thorne",
    country: "US",
    hosts: ["thorne.com"],
    network: "impact",
    terms: "~10-15%",
    signup: "https://app.impact.com/",
  },
  {
    id: "dermstore",
    name: "Dermstore",
    country: "US",
    hosts: ["dermstore.com"],
    network: "rakuten",
    terms: "~5-8%",
    signup: "https://rakutenadvertising.com/",
  },
  {
    id: "petsmart",
    name: "PetSmart",
    country: "US",
    hosts: ["petsmart.com"],
    network: "impact",
    terms: "~1-8%",
    signup: "https://app.impact.com/",
  },
  // ---- UK ----------------------------------------------------------------
  {
    id: "boots",
    name: "Boots",
    country: "GB",
    hosts: ["boots.com"],
    network: "awin",
    merchantId: "2041",
    terms: "~2-5% by category",
    signup: "https://ui.awin.com/",
  },
  {
    id: "superdrug",
    name: "Superdrug",
    country: "GB",
    hosts: ["superdrug.com"],
    network: "awin",
    merchantId: "2700",
    terms: "~3-5%",
    signup: "https://ui.awin.com/",
  },
  {
    id: "lookfantastic",
    name: "LOOKFANTASTIC",
    country: "GB",
    hosts: ["lookfantastic.com"],
    network: "awin",
    merchantId: "2082",
    terms: "~5-10%",
    signup: "https://ui.awin.com/",
  },
  {
    id: "theordinary",
    name: "The Ordinary (DECIEM)",
    country: "INTL",
    hosts: ["theordinary.com", "deciem.com"],
    network: "rakuten",
    terms: "~5-8%",
    signup: "https://rakutenadvertising.com/",
  },
  // ---- Germany -----------------------------------------------------------
  {
    id: "shopapotheke",
    name: "Shop Apotheke (Redcare)",
    country: "DE",
    hosts: ["shop-apotheke.com", "redcare-apotheke.de"],
    network: "awin",
    merchantId: "11329",
    terms: "~4-6% on OTC (not on prescription drugs)",
    signup: "https://ui.awin.com/",
  },
  {
    id: "docmorris",
    name: "DocMorris",
    country: "DE",
    hosts: ["docmorris.de"],
    network: "awin",
    terms: "~3-6% on OTC",
    signup: "https://ui.awin.com/",
  },
  {
    id: "aponeo",
    name: "Aponeo",
    country: "DE",
    hosts: ["aponeo.de"],
    network: "awin",
    terms: "~5-7% on OTC",
    signup: "https://ui.awin.com/",
  },
  {
    id: "medikamente-per-klick",
    name: "medikamente-per-klick",
    country: "DE",
    hosts: ["medikamente-per-klick.de"],
    network: "awin",
    terms: "~5-8% on OTC",
    signup: "https://ui.awin.com/",
  },
  // ---- Canada ------------------------------------------------------------
  {
    id: "walmart-ca",
    name: "Walmart Canada",
    country: "CA",
    hosts: ["walmart.ca"],
    network: "rakuten",
    terms: "~1-4%",
    signup: "https://rakutenadvertising.com/",
  },
];

export function programById(id: string) {
  return PROGRAMS.find((p) => p.id === id);
}

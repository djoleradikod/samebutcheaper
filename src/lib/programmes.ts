/**
 * Which affiliate network carries each store's programme, with the public page that says so
 * (data/sellers/programmes.json). The registry is research, for people: it ranks what to join next
 * (docs/research/R9-programmes.md, `npm run report:revenue`). Switching a programme on is still its env
 * setting in src/lib/affiliate-programs.ts. Pure, no secrets.
 */
import { z } from "zod";
import registry from "../../data/sellers/programmes.json";
import { PROGRAMS } from "./affiliate-programs";

export const PROGRAMME_NETWORKS = ["amazon", "impact", "awin", "cj", "rakuten", "flexoffers", "partnerize", "direct", "none", "unknown"] as const;
export type ProgrammeNetwork = (typeof PROGRAMME_NETWORKS)[number];

/**
 * The rules a programme's terms set, as the code applies them (src/lib/programme-terms.ts). Every rule set must be
 * backed by a quoted clause that names it, so nothing is applied that a page doesn't say. A rule left out is one we
 * haven't found, not a permission: docs/research/R11-programme-terms.md says what was looked for.
 */
export const TERM_RULES = ["priceAlerts", "priceHistory", "prices", "priceNotice", "email", "dupeWording", "disclosure", "images", "barredPaths"] as const;
export type TermRule = (typeof TERM_RULES)[number];

const clauseSchema = z
  .object({
    /** The rules this clause backs. */
    rules: z.array(z.enum(TERM_RULES)).min(1),
    /** Section or heading, as the page numbers it. */
    section: z.string().min(1),
    /** The words, quoted from the page. */
    quote: z.string().min(1),
    /** The page, when it isn't the terms block's own source. */
    source: z.string().url().optional(),
  })
  .strict();

export const termsSchema = z
  .object({
    /** false: the terms bar price tracking or price alerts for the store's products (src/lib/watch-terms.ts). */
    priceAlerts: z.boolean().optional(),
    /** false: no price history (past prices as a chart or table) for the store's products, which is price tracking. */
    priceHistory: z.boolean().optional(),
    /**
     * A price for the store's products may be shown only when it came from the programme itself (its product feed or
     * its API) no more than maxAgeHours before the site was built. Otherwise the page says "see the price at <store>".
     */
    prices: z.object({ only: z.enum(["feed", "api"]), maxAgeHours: z.number().int().positive() }).strict().optional(),
    /** The notice the terms want beside any price we show for the store (wording in the dictionaries, terms.notice.*). */
    priceNotice: z.enum(["store-price-applies", "as-of-time"]).optional(),
    /**
     * Email: "none" bars the store's name, products and links in email without its written permission; "no-links"
     * bars its affiliate links in email (ours link only to our own pages); "opt-in" allows them to opted-in readers.
     */
    email: z.enum(["none", "no-links", "opt-in"]).optional(),
    /** false: "dupe" may not be used to compare the store's products with another brand's. */
    dupeWording: z.boolean().optional(),
    /**
     * The disclosure the terms ask for, shown while the link earns: a label beside each link ("paid-link"), or a set
     * statement on the site ("amazon-associate").
     */
    disclosure: z.enum(["paid-link", "amazon-associate"]).optional(),
    /** "programme": product images only as the programme supplies them, so our own photos of its products are left out. */
    images: z.enum(["programme"]).optional(),
    /** true: the terms say the programme's tracking may only run after the visitor's consent (src/lib/consent.ts). */
    consentBeforeTracking: z.boolean().optional(),
    /** Paths on the store's site we may not link to, such as its pharmacy. */
    barredPaths: z.array(z.string().startsWith("/")).optional(),
    /** The programme's own terms page. */
    source: z.string().url(),
    /** The rules in a sentence or two, for people. */
    quote: z.string().min(1),
    /** When the page was read, ISO date. */
    checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** The quoted clauses behind each rule above. */
    clauses: z.array(clauseSchema).default([]),
  })
  .strict()
  .refine((t) => TERM_RULES.every((r) => t[r] === undefined || t.clauses.some((c) => c.rules.includes(r))), {
    message: "every rule needs a quoted clause that names it",
    path: ["clauses"],
  });

export type ProgrammeTerms = z.infer<typeof termsSchema>;

const entrySchema = z
  .object({
    /** The network the store's own programme runs on; "direct" is the store's own scheme, "none" a store that says it has none. */
    network: z.enum(PROGRAMME_NETWORKS),
    /** The id in src/lib/affiliate-programs.ts that switches it on, when there is one. */
    programme: z.string().optional(),
    /** Countries the programme pays for. */
    markets: z.array(z.string().length(2)).default([]),
    /** The network's or the store's own public page that says this programme exists and where. */
    source: z.string().url().optional(),
    /** Where to apply, when it isn't the source page. */
    signup: z.string().url().optional(),
    note: z.string().default(""),
    /**
     * What the programme's own terms say about how we may use its links, prices and name, where we have read them.
     * Only a rule the cited page states goes here; a programme without this block has terms we haven't read, not terms
     * that allow all.
     */
    terms: termsSchema.optional(),
  })
  .refine((e) => e.network === "unknown" || e.source, { message: "a programme claim needs a source page", path: ["source"] })
  .refine((e) => !e.programme || PROGRAMS.some((p) => p.id === e.programme), { message: "programme is not an id in affiliate-programs.ts", path: ["programme"] });

export const registrySchema = z.object({
  checked: z.string(),
  method: z.string(),
  /** Terms a network's publisher agreement sets for every programme on it, applied under each store's own. */
  networks: z.record(z.string(), z.object({ terms: termsSchema }).strict()).default({}),
  stores: z.record(z.string(), entrySchema),
});

export type ProgrammeEntry = z.infer<typeof entrySchema>;

const parsed = registrySchema.safeParse(registry);
/** The registry, or an empty one when the file doesn't parse (the test in scripts/tests/programmes.test.ts fails then). */
export const PROGRAMME_REGISTRY: Record<string, ProgrammeEntry> = parsed.success ? parsed.data.stores : {};
/** Network-wide terms, by network id. */
export const NETWORK_TERMS: Record<string, ProgrammeTerms> = parsed.success
  ? Object.fromEntries(Object.entries(parsed.data.networks).map(([n, v]) => [n, v.terms]))
  : {};

/** The registry entry for a store id, "unknown" when it has none. */
export function programmeOf(store: string): ProgrammeEntry {
  return PROGRAMME_REGISTRY[store] ?? { network: "unknown", markets: [], note: "" };
}

/** Where to sign up: the signup page, else the source page. */
export function signupOf(e: ProgrammeEntry) {
  return e.signup ?? e.source ?? null;
}

const hostOf = (url: string | null | undefined) => {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

/**
 * The store a buy link opens, as the registry keys it: an Amazon address is Amazon, a named retailer is itself,
 * and an "other" row is named from its host (ulta.com -> ulta, us.ugreen.com -> ugreen), as sellers.ts does.
 */
export function linkStore(side: { retailer: string; url?: string | null }): string {
  const host = hostOf(side.url);
  if (host?.startsWith("amazon.")) return "amazon";
  if (side.retailer !== "other") return side.retailer;
  if (!host) return "unknown";
  return host.replace(/^(?:shop|store|us|uk|ca|de|ie|eu|en)\./, "").split(".")[0].replace(/-online$/, "");
}

/** The store a logged click went to, from its retailer column ("tesco", or "tesco:GB" for a store search) and host. */
export function clickStore(retailer: string, host: string | null): string {
  const id = retailer.split(":")[0];
  if (host?.startsWith("amazon.")) return "amazon";
  if (id && id !== "other") return id;
  return host ? linkStore({ retailer: "other", url: `https://${host}/` }) : "unknown";
}

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
     * What the programme's own terms say about how we may use its prices, where we have read them. Only a rule the
     * cited page states goes here; a programme without this block has terms we haven't read, not terms that allow all.
     */
    terms: z
      .object({
        /** false: the terms bar price tracking or price alerts for the store's products (src/lib/watch-terms.ts). */
        priceAlerts: z.boolean().optional(),
        /** The programme's own terms page that says so. */
        source: z.string().url(),
        /** The clause, quoted, with its section. */
        quote: z.string().min(1),
        /** When the page was read, ISO date. */
        checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .strict()
      .optional(),
  })
  .refine((e) => e.network === "unknown" || e.source, { message: "a programme claim needs a source page", path: ["source"] })
  .refine((e) => !e.programme || PROGRAMS.some((p) => p.id === e.programme), { message: "programme is not an id in affiliate-programs.ts", path: ["programme"] });

export const registrySchema = z.object({
  checked: z.string(),
  method: z.string(),
  stores: z.record(z.string(), entrySchema),
});

export type ProgrammeEntry = z.infer<typeof entrySchema>;

const parsed = registrySchema.safeParse(registry);
/** The registry, or an empty one when the file doesn't parse (the test in scripts/tests/programmes.test.ts fails then). */
export const PROGRAMME_REGISTRY: Record<string, ProgrammeEntry> = parsed.success ? parsed.data.stores : {};

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

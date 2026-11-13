import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  index,
  uniqueIndex,
  pgEnum,
  boolean,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";

/** Outbound affiliate clicks, used to see which swaps people actually buy. */
export const clicks = pgTable(
  "clicks",
  {
    id: serial("id").primaryKey(),
    pairSlug: varchar("pair_slug", { length: 160 }).notNull(),
    side: varchar("side", { length: 16 }).notNull(), // "alternative" | "brand" | "item-N" | "search"
    retailer: varchar("retailer", { length: 32 }).notNull(),
    referrer: text("referrer"),
    visitorHash: varchar("visitor_hash", { length: 64 }),
    /** Our ID for this click, sent to the network as the sub-ID and returned on a sale. */
    clickId: varchar("click_id", { length: 24 }),
    /** Affiliate program that tagged the link ("walmart-us", "skimlinks"), null when untagged. */
    program: varchar("program", { length: 40 }),
    /** Shopper's country (from the country cookie). */
    country: varchar("country", { length: 2 }),
    /** Store host we sent them to, for spotting stores we have no program for. */
    host: varchar("host", { length: 80 }),
    /** First-touch traffic source (utm_source or referring site), from the sbc_src cookie set in src/proxy.ts. */
    source: varchar("source", { length: 40 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("clicks_pair_idx").on(t.pairSlug),
    index("clicks_created_idx").on(t.createdAt),
    uniqueIndex("clicks_click_id_idx").on(t.clickId),
  ],
);

/**
 * Sales reported by affiliate networks (server-to-server postbacks to
 * /api/postback, or imported reports). One row per network order; a later
 * report for the same order updates its status and commission.
 */
export const conversions = pgTable(
  "conversions",
  {
    id: serial("id").primaryKey(),
    network: varchar("network", { length: 24 }).notNull(),
    orderId: varchar("order_id", { length: 120 }).notNull(),
    clickId: varchar("click_id", { length: 24 }),
    program: varchar("program", { length: 40 }),
    sale: numeric("sale", { precision: 12, scale: 2 }),
    commission: numeric("commission", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    /** "pending" | "approved" | "reversed" */
    status: varchar("status", { length: 16 }).default("pending").notNull(),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("conversions_order_idx").on(t.network, t.orderId),
    index("conversions_click_idx").on(t.clickId),
    index("conversions_created_idx").on(t.createdAt),
  ],
);

export const submissionStatus = pgEnum("submission_status", [
  "new",
  "researching",
  "accepted",
  "rejected",
]);

/** Swaps suggested by visitors through /suggest. */
export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    brandProduct: text("brand_product").notNull(),
    alternativeProduct: text("alternative_product"),
    reason: text("reason"),
    evidenceUrl: text("evidence_url"),
    email: varchar("email", { length: 320 }),
    status: submissionStatus("status").default("new").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("submissions_status_idx").on(t.status)],
);

/**
 * Newsletter list ("new swaps every week"), with double opt-in: a sign-up is "pending" until the address
 * confirms through the emailed link, and only "confirmed" rows may be sent to. `token` is the secret in that
 * link and in every unsubscribe link, so it stays the same for the life of the row.
 */
export const subscribers = pgTable(
  "subscribers",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    source: varchar("source", { length: 64 }),
    /** "pending" | "confirmed" | "unsubscribed" */
    status: varchar("status", { length: 16 }).default("pending").notNull(),
    token: varchar("token", { length: 64 }),
    /** Country selected when they signed up, for sending swaps they can buy. */
    country: varchar("country", { length: 2 }),
    /** When the last confirmation email went out (null: none sent yet, for example before email was set up). */
    confirmSentAt: timestamp("confirm_sent_at", { withTimezone: true }),
    /** Proof of consent: when the link in the email was followed. */
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("subscribers_email_idx").on(t.email),
    uniqueIndex("subscribers_token_idx").on(t.token),
    index("subscribers_status_idx").on(t.status),
  ],
);

/** Small facts the server keeps about itself, such as when upkeep last ran. */
export const appState = pgTable("app_state", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Product lookups from /check (text, barcode, photo). Lookups with no verified
 * swap are the research queue: what shoppers want that we don't cover yet.
 */
export const lookups = pgTable(
  "lookups",
  {
    id: serial("id").primaryKey(),
    kind: varchar("kind", { length: 16 }).notNull(), // "text" | "barcode" | "photo" | "product"
    query: varchar("query", { length: 200 }),
    source: varchar("source", { length: 16 }),
    sourceId: varchar("source_id", { length: 80 }),
    productName: varchar("product_name", { length: 200 }),
    verified: boolean("verified").default(false).notNull(),
    country: varchar("country", { length: 2 }),
    visitorHash: varchar("visitor_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("lookups_created_idx").on(t.createdAt), index("lookups_verified_idx").on(t.verified)],
);

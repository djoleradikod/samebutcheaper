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
  integer,
  date,
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
    /**
     * The weekly letter, consented to on its own: "no" | "pending" (asked, waiting for the link in the email) | "yes".
     * An address can be confirmed for a price watch only, and still never get the letter. Sends need status
     * "confirmed" and this "yes".
     */
    newsletter: varchar("newsletter", { length: 8 }).default("pending").notNull(),
    /** Proof of consent to the letter itself: when its confirm link was followed. */
    letterConfirmedAt: timestamp("letter_confirmed_at", { withTimezone: true }),
    /** When the letter was last switched off on its own (an address with nothing on is deleted 30 days later). */
    letterStoppedAt: timestamp("letter_stopped_at", { withTimezone: true }),
    /**
     * SHA-256 of the secret in the newest confirmation email for the letter. Only the hash is kept; each email gets a
     * fresh secret, and following it clears this, so a link works once (src/lib/newsletter.ts).
     */
    confirmHash: varchar("confirm_hash", { length: 64 }),
    /** When the last confirmation email for the weekly letter went out (null: none sent yet, for example before email was set up). */
    confirmSentAt: timestamp("confirm_sent_at", { withTimezone: true }),
    /** Proof of consent: when the link in the email was followed. */
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("subscribers_email_idx").on(t.email),
    uniqueIndex("subscribers_token_idx").on(t.token),
    uniqueIndex("subscribers_confirm_idx").on(t.confirmHash),
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

/**
 * "Something wrong?" reports from swap and kit pages. No account and no email: just what was wrong, an optional
 * short note, the shopper's country and the daily-changing visitor hash the click log uses (never an IP address).
 */
export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    /** "pair" | "bundle" */
    recordKind: varchar("record_kind", { length: 8 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    /** "price" | "stock" | "product" | "other" */
    kind: varchar("kind", { length: 16 }).notNull(),
    note: varchar("note", { length: 300 }),
    country: varchar("country", { length: 2 }),
    visitorHash: varchar("visitor_hash", { length: 64 }),
    /** "open" | "resolved" | "dismissed" */
    status: varchar("status", { length: 16 }).default("open").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("reports_slug_idx").on(t.recordKind, t.slug),
    index("reports_status_idx").on(t.status, t.createdAt),
  ],
);

/**
 * What shoppers looked for and we had nothing for: zero-result searches on /search ("search") and products /check
 * could read but has no swap for ("check"). Counted per query, country and day, with nothing about who asked.
 */
export const wanted = pgTable(
  "wanted",
  {
    id: serial("id").primaryKey(),
    /** Lower case, single spaces, at most 80 characters. */
    query: varchar("query", { length: 80 }).notNull(),
    /** "search" | "check" */
    source: varchar("source", { length: 8 }).notNull(),
    /** Two letters, or "" when we don't know the country. */
    country: varchar("country", { length: 2 }).default("").notNull(),
    day: date("day").notNull(),
    count: integer("count").default(1).notNull(),
  },
  (t) => [uniqueIndex("wanted_key_idx").on(t.query, t.source, t.country, t.day), index("wanted_day_idx").on(t.day)],
);

/**
 * "Tell me when you add it", from a search with no results. Tied to a subscriber and double opt-in like
 * everything else that leads to an email: "pending" until the link in the email is followed.
 */
export const wishes = pgTable(
  "wishes",
  {
    id: serial("id").primaryKey(),
    subscriberId: integer("subscriber_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    query: varchar("query", { length: 80 }).notNull(),
    country: varchar("country", { length: 2 }),
    /** "pending" | "active" | "stopped" (they asked) | "answered" (we added a matching swap and told them) */
    status: varchar("status", { length: 16 }).default("pending").notNull(),
    /** SHA-256 of the secret in the newest confirmation email for this request. */
    confirmHash: varchar("confirm_hash", { length: 64 }),
    confirmSentAt: timestamp("confirm_sent_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    /** The swap we wrote about when it was answered. */
    answeredSlug: varchar("answered_slug", { length: 160 }),
  },
  (t) => [
    uniqueIndex("wishes_key_idx").on(t.subscriberId, t.query),
    index("wishes_query_idx").on(t.query),
    uniqueIndex("wishes_confirm_idx").on(t.confirmHash),
  ],
);

/**
 * "Email me if this changes" on a swap. Holds the swap's prices when the watch began or when we last wrote about
 * it; a new catalogue build that moves them far enough sends one email (see src/lib/watches.ts).
 */
export const watches = pgTable(
  "watches",
  {
    id: serial("id").primaryKey(),
    subscriberId: integer("subscriber_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 160 }).notNull(),
    /** The swap's title when the watch began, for telling them about it after it's gone. */
    title: varchar("title", { length: 200 }).notNull(),
    /** "pending" | "active" | "stopped" (they asked) | "ended" (the swap was withdrawn and we said so) */
    status: varchar("status", { length: 16 }).default("pending").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    unit: varchar("unit", { length: 24 }).notNull(),
    altPrice: numeric("alt_price", { precision: 12, scale: 4 }).notNull(),
    altPpu: numeric("alt_ppu", { precision: 16, scale: 8 }).notNull(),
    brandPpu: numeric("brand_ppu", { precision: 16, scale: 8 }).notNull(),
    savingsPct: numeric("savings_pct", { precision: 6, scale: 2 }).notNull(),
    /** The record's price_checked when these prices were taken. */
    priceChecked: varchar("price_checked", { length: 16 }),
    /** SHA-256 of the secret in the newest confirmation email for this watch. */
    confirmHash: varchar("confirm_hash", { length: 64 }),
    confirmSentAt: timestamp("confirm_sent_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("watches_key_idx").on(t.subscriberId, t.slug),
    index("watches_status_idx").on(t.status),
    uniqueIndex("watches_confirm_idx").on(t.confirmHash),
  ],
);

/**
 * Every email sent to a subscriber: confirmations, price-watch notices and weekly letters. A row is claimed before
 * the send (unique per subscriber, kind and key), so a second run, or two at once, can't send the same thing twice.
 * `items` holds the slugs a weekly letter carried, so the next one skips them.
 */
export const sends = pgTable(
  "sends",
  {
    id: serial("id").primaryKey(),
    subscriberId: integer("subscriber_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    /** "confirm" | "watch" | "weekly" | "wish" (the swap a "tell me when you add it" asked for) */
    kind: varchar("kind", { length: 16 }).notNull(),
    /** What was sent: "2026-W46" for a letter, "watch-12:<prices>" for a watch notice, "wish-7" for an answered wish, "letter:<time>" for a confirmation. */
    key: varchar("key", { length: 160 }).notNull(),
    /** "sending" | "sent" | "empty" (nothing new for this subscriber in that letter) */
    status: varchar("status", { length: 16 }).default("sending").notNull(),
    providerId: varchar("provider_id", { length: 80 }),
    items: jsonb("items"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("sends_key_idx").on(t.subscriberId, t.kind, t.key), index("sends_created_idx").on(t.createdAt)],
);

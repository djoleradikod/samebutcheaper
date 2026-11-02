import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

/** Outbound affiliate clicks, used to see which swaps people actually buy. */
export const clicks = pgTable(
  "clicks",
  {
    id: serial("id").primaryKey(),
    pairSlug: varchar("pair_slug", { length: 160 }).notNull(),
    side: varchar("side", { length: 16 }).notNull(), // "alternative" | "brand"
    retailer: varchar("retailer", { length: 32 }).notNull(),
    referrer: text("referrer"),
    visitorHash: varchar("visitor_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("clicks_pair_idx").on(t.pairSlug), index("clicks_created_idx").on(t.createdAt)],
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

/** Newsletter list ("new swaps every week"). */
export const subscribers = pgTable(
  "subscribers",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    source: varchar("source", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("subscribers_email_idx").on(t.email)],
);

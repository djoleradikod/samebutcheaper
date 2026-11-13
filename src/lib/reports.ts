import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";

/**
 * "Something wrong?" reports from swap and kit pages, and the admin queue they feed. A record with three or more
 * open "price changed" or "out of stock" reports from different visitors in 14 days goes to the top of the queue.
 */
type DB = PostgresJsDatabase<typeof schema>;
const { reports } = schema;

export const REPORT_KINDS = ["price", "stock", "product", "other"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export const REPORT_LABEL: Record<ReportKind, string> = {
  price: "Price changed",
  stock: "Out of stock",
  product: "Not the same product",
  other: "Something else",
};
export const isReportKind = (v: unknown): v is ReportKind => typeof v === "string" && (REPORT_KINDS as readonly string[]).includes(v);

export const NOTE_MAX = 300;
export const FLAG_COUNT = 3;
export const FLAG_DAYS = 14;
const URGENT: ReportKind[] = ["price", "stock"];

/**
 * A note as we store it: single spaces, no control characters, at most NOTE_MAX characters, with anything that
 * looks like an email address or phone number taken out (we don't want contact details in a public-facing queue).
 */
export function cleanNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw
    .normalize("NFKC")
    // Control characters, including newlines, become spaces.
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\S+@\S+\.\S+/g, "[email removed]")
    .replace(/\+?\d[\d\s()./-]{7,}\d/g, (m) => (m.replace(/\D/g, "").length >= 9 ? "[number removed]" : m))
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, NOTE_MAX) : null;
}

export async function recordReport(
  db: DB,
  input: { recordKind: "pair" | "bundle"; slug: string; kind: ReportKind; note?: string | null; country?: string | null; visitorHash?: string | null; now?: Date },
) {
  const [row] = await db
    .insert(reports)
    .values({
      recordKind: input.recordKind,
      slug: input.slug.slice(0, 160),
      kind: input.kind,
      note: cleanNote(input.note),
      country: input.country && /^[A-Z]{2}$/.test(input.country) ? input.country : null,
      visitorHash: input.visitorHash?.slice(0, 64) ?? null,
      ...(input.now ? { createdAt: input.now } : {}),
    })
    .returning({ id: reports.id });
  return row.id;
}

export type QueueGroup = {
  recordKind: string;
  slug: string;
  /** Three or more open price or stock reports from different visitors in the last 14 days. */
  flagged: boolean;
  urgentRecent: number;
  latest: Date;
  items: (typeof reports.$inferSelect)[];
};

/** Open reports, grouped by record: flagged records first, then the record with the newest report. */
export async function reportQueue(db: DB, now = new Date(), limit = 500): Promise<QueueGroup[]> {
  const rows = await db.select().from(reports).where(eq(reports.status, "open")).orderBy(desc(reports.createdAt)).limit(limit);
  const since = now.getTime() - FLAG_DAYS * 86400000;
  const groups = new Map<string, QueueGroup>();
  const who = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = `${r.recordKind}:${r.slug}`;
    let g = groups.get(key);
    if (!g) {
      g = { recordKind: r.recordKind, slug: r.slug, flagged: false, urgentRecent: 0, latest: r.createdAt, items: [] };
      groups.set(key, g);
      who.set(key, new Set());
    }
    g.items.push(r);
    if (URGENT.includes(r.kind as ReportKind) && r.createdAt.getTime() >= since) {
      // One visitor reporting twice counts once; a report whose hash has been dropped counts on its own.
      who.get(key)!.add(r.visitorHash ?? `#${r.id}`);
      g.urgentRecent = who.get(key)!.size;
    }
  }
  const list = [...groups.values()];
  for (const g of list) g.flagged = g.urgentRecent >= FLAG_COUNT;
  return list.sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.latest.getTime() - a.latest.getTime());
}

export async function openReportCount(db: DB) {
  const [row] = await db.select({ n: count() }).from(reports).where(eq(reports.status, "open"));
  return row?.n ?? 0;
}

/** Resolves or dismisses reports: by id, or every open one on a record. */
export async function closeReports(
  db: DB,
  target: { ids: number[] } | { recordKind: string; slug: string },
  status: "resolved" | "dismissed",
  now = new Date(),
) {
  const where =
    "ids" in target
      ? and(inArray(reports.id, target.ids.length ? target.ids : [-1]), eq(reports.status, "open"))
      : and(eq(reports.recordKind, target.recordKind), eq(reports.slug, target.slug), eq(reports.status, "open"));
  const done = await db.update(reports).set({ status, closedAt: now }).where(where).returning({ id: reports.id });
  return done.length;
}

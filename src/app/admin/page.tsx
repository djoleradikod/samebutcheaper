import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { and, desc, eq, gte, sql, count } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getPair, getSiteStats } from "@/lib/catalog";
import { subscriberCounts } from "@/lib/newsletter";
import { Revenue } from "./Revenue";
import { Readiness } from "./Readiness";
import { LetterPanel, MostWanted, OpenReportsStat, ReportQueue } from "./Feedback";
import { setSubmissionStatus } from "./actions";
import { PriceWatchAdmin } from "@/components/PriceWatchAdmin";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <section className="admin-tables container-page py-10">
      <h1 className="display text-4xl font-medium">Dashboard</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <AdminData />
      </Suspense>
      <PriceWatchAdmin />
    </section>
  );
}

async function AdminData() {
  await connection();
  const db = getDb();
  const stats = getSiteStats();
  if (!db) {
    return <p className="mt-6 text-warn">DATABASE_URL is not configured, so there is no click or suggestion data.</p>;
  }
  const since = daysAgo(30);
  const wantedName = sql<string>`lower(coalesce(${schema.lookups.productName}, ${schema.lookups.query}))`;
  const [[totals], topPairs, subs, list, wanted, [lookupTotals]] = await Promise.all([
    db
      .select({
        clicks: count(),
        visitors: sql<number>`count(distinct ${schema.clicks.visitorHash})`.mapWith(Number),
      })
      .from(schema.clicks)
      .where(gte(schema.clicks.createdAt, since)),
    db
      .select({ slug: schema.clicks.pairSlug, side: schema.clicks.side, n: count() })
      .from(schema.clicks)
      .where(gte(schema.clicks.createdAt, since))
      .groupBy(schema.clicks.pairSlug, schema.clicks.side)
      .orderBy(desc(count()))
      .limit(25),
    db.select().from(schema.submissions).orderBy(desc(schema.submissions.createdAt)).limit(50),
    subscriberCounts(db),
    db
      .select({
        name: wantedName,
        n: count(),
        countries: sql<string>`string_agg(distinct ${schema.lookups.country}, ', ')`,
        kinds: sql<string>`string_agg(distinct ${schema.lookups.kind}, ', ')`,
      })
      .from(schema.lookups)
      .where(and(gte(schema.lookups.createdAt, since), eq(schema.lookups.verified, false)))
      .groupBy(wantedName)
      .orderBy(desc(count()))
      .limit(40),
    db
      .select({
        n: count(),
        verified: sql<number>`count(*) filter (where ${schema.lookups.verified})`.mapWith(Number),
      })
      .from(schema.lookups)
      .where(gte(schema.lookups.createdAt, since)),
  ]);

  return (
    <div className="mt-8 space-y-10">
      <div className="num grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Swaps live" value={stats.pairs} />
        <Stat label="Clicks (30 days)" value={totals?.clicks ?? 0} />
        <Stat label="Unique clickers per day (30 days)" value={totals?.visitors ?? 0} />
        <Stat label={`Subscribers confirmed (${list.pending} waiting to confirm)`} value={list.confirmed} />
        <OpenReportsStat />
      </div>

      <Readiness />

      <Revenue since={since} />

      <ReportQueue />

      <div>
        <h2 className="text-xl font-semibold">Top outbound clicks, last 30 days</h2>
        <table className="card num mt-3 w-full overflow-hidden text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr><th className="p-3">Swap</th><th className="p-3">Side</th><th className="p-3 text-right">Clicks</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {topPairs.map((r) => (
              <tr key={`${r.slug}-${r.side}`}>
                <td className="p-3">{getPair(r.slug)?.title ?? r.slug}</td>
                <td className="p-3">{r.side}</td>
                <td className="p-3 text-right font-semibold">{r.n}</td>
              </tr>
            ))}
            {topPairs.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-muted">No clicks yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Research queue: most checked products without a verified swap</h2>
        <p className="mt-1 text-sm text-muted">
          Last 30 days · {lookupTotals?.n ?? 0} product checks, {lookupTotals?.verified ?? 0} of them had a verified swap.
        </p>
        <table className="card num mt-3 w-full overflow-hidden text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr><th className="p-3">Product or search</th><th className="p-3">How</th><th className="p-3">Countries</th><th className="p-3 text-right">Checks</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {wanted.map((r) => (
              <tr key={r.name ?? "unknown"}>
                <td className="p-3">{r.name ?? "(unknown)"}</td>
                <td className="p-3 text-muted">{r.kinds}</td>
                <td className="p-3 text-muted">{r.countries ?? ""}</td>
                <td className="p-3 text-right font-semibold">{r.n}</td>
              </tr>
            ))}
            {wanted.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-muted">No product checks yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <MostWanted />

      <div>
        <h2 className="text-xl font-semibold">Suggestions</h2>
        <div className="mt-3 space-y-3">
          {subs.map((s) => (
            <div key={s.id} className="card p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">
                  {s.brandProduct}
                  {s.alternativeProduct ? <span className="text-accent"> → {s.alternativeProduct}</span> : null}
                </p>
                {/* Keyed by status: React resets a form after its action, and a select then needs a fresh mount to show the saved value. */}
                <form key={s.status} action={setSubmissionStatus} className="flex items-center gap-2 text-xs text-muted">
                  <span>{s.createdAt.toISOString().slice(0, 10)}</span>
                  <input type="hidden" name="id" value={s.id} />
                  <select name="status" defaultValue={s.status} aria-label="Status" className="rounded border border-line-strong bg-paper px-2 py-1">
                    {schema.submissionStatus.enumValues.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <button type="submit" className="rounded border border-line-strong px-2 py-1 font-medium text-ink">Save</button>
                </form>
              </div>
              {s.reason && <p className="mt-2 text-ink-2">{s.reason}</p>}
              <p className="mt-2 text-xs text-muted">
                {s.evidenceUrl && (
                  <a href={s.evidenceUrl} className="text-accent underline" target="_blank" rel="noreferrer">
                    evidence
                  </a>
                )}
                {s.email && <> · {s.email}</>}
              </p>
            </div>
          ))}
          {subs.length === 0 && <p className="text-muted">No suggestions yet.</p>}
        </div>
      </div>

      <LetterPanel />

      <div>
        <h2 className="text-xl font-semibold">Downloads</h2>
        <p className="mt-1 text-sm text-muted">
          CSV files. The subscriber file holds confirmed addresses only, the ones that may be emailed
          ({list.unsubscribed} have unsubscribed).
        </p>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {(["subscribers", "submissions", "clicks", "conversions", "lookups", "reports", "wanted"] as const).map((k) => (
            <li key={k}>
              <a href={`/admin/export/${k}`} className="btn btn-ghost" download>
                {k}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value.toLocaleString("en-US")}</p>
    </div>
  );
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

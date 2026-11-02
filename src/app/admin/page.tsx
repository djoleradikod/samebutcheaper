import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { desc, gte, sql, count } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getPair, getSiteStats } from "@/lib/catalog";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <section className="container-page py-10">
      <h1 className="display text-4xl font-medium">Dashboard</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <AdminData />
      </Suspense>
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
  const [[totals], topPairs, subs, [subCount]] = await Promise.all([
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
    db.select({ n: count() }).from(schema.subscribers),
  ]);

  return (
    <div className="mt-8 space-y-10">
      <div className="num grid gap-3 sm:grid-cols-4">
        <Stat label="Swaps live" value={stats.pairs} />
        <Stat label="Clicks (30 days)" value={totals?.clicks ?? 0} />
        <Stat label="Unique clickers per day (30 days)" value={totals?.visitors ?? 0} />
        <Stat label="Subscribers" value={subCount?.n ?? 0} />
      </div>

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
        <h2 className="text-xl font-semibold">Suggestions</h2>
        <div className="mt-3 space-y-3">
          {subs.map((s) => (
            <div key={s.id} className="card p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">
                  {s.brandProduct}
                  {s.alternativeProduct ? <span className="text-accent"> → {s.alternativeProduct}</span> : null}
                </p>
                <p className="text-xs text-muted">
                  {s.status} · {s.createdAt.toISOString().slice(0, 10)}
                </p>
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

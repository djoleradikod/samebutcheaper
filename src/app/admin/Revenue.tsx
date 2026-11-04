import { and, desc, eq, gte, isNull, ne, sql, count } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getBundle, getPair } from "@/lib/catalog";
import { PROGRAMS } from "@/lib/affiliate-programs";
import { programEnvKey, programFor, tagLink } from "@/lib/affiliate-links";

/**
 * Affiliate money on the dashboard: which links are tagged, which swaps earn
 * (EPC), and which stores we send shoppers to without earning anything, so
 * the next program to join is obvious.
 */
export async function Revenue({ since }: { since: Date }) {
  const db = getDb();
  if (!db) return null;
  const c = schema.clicks;
  const v = schema.conversions;
  const earned = sql<number>`coalesce(sum(${v.commission}) filter (where ${v.status} <> 'reversed'), 0)`.mapWith(Number);

  const [[tagged], money, bySwap, leaks] = await Promise.all([
    db
      .select({ all: count(), tagged: sql<number>`count(${c.program})`.mapWith(Number) })
      .from(c)
      .where(gte(c.createdAt, since)),
    db
      .select({ currency: v.currency, earned, sales: count() })
      .from(v)
      .where(and(gte(v.createdAt, since), ne(v.status, "reversed")))
      .groupBy(v.currency),
    db
      .select({
        slug: c.pairSlug,
        clicks: sql<number>`count(distinct ${c.id})`.mapWith(Number),
        sales: sql<number>`count(distinct ${v.id}) filter (where ${v.status} <> 'reversed')`.mapWith(Number),
        earned,
      })
      .from(c)
      .leftJoin(v, eq(v.clickId, c.clickId))
      .where(gte(c.createdAt, since))
      .groupBy(c.pairSlug)
      .orderBy(desc(earned), desc(sql`count(distinct ${c.id})`))
      .limit(25),
    db
      .select({ host: c.host, n: count() })
      .from(c)
      .where(and(gte(c.createdAt, since), isNull(c.program)))
      .groupBy(c.host)
      .orderBy(desc(count()))
      .limit(15),
  ]);

  const rate = tagged?.all ? Math.round((100 * tagged.tagged) / tagged.all) : 0;
  const earnedText = money.length ? money.map((m) => fmt(m.earned, m.currency)).join(" + ") : "0";
  const salesCount = money.reduce((n, m) => n + m.sales, 0);
  const live = PROGRAMS.filter((p) => isLive(p.id, p.network));
  const sub = process.env.SKIMLINKS_ID ? "Skimlinks" : process.env.SOVRN_KEY ? "Sovrn Commerce" : null;

  return (
    <div className="space-y-10">
      <div className="num grid gap-3 sm:grid-cols-4">
        <Stat label="Clicks with an affiliate tag (30 days)" value={`${rate}%`} />
        <Stat label="Commission, pending + approved (30 days)" value={earnedText} />
        <Stat label="Sales reported (30 days)" value={salesCount.toLocaleString("en-US")} />
        <Stat
          label="Programs live"
          value={`${live.length} of ${PROGRAMS.length}${sub ? ` + ${sub}` : ""}`}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold">Earnings by swap, last 30 days</h2>
        <p className="mt-1 text-sm text-muted">
          EPC is commission per click. Feature the swaps with the highest EPC, and research more like them.
        </p>
        <table className="card num mt-3 w-full overflow-hidden text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="p-3">Swap</th>
              <th className="p-3 text-right">Clicks</th>
              <th className="p-3 text-right">Sales</th>
              <th className="p-3 text-right">Commission</th>
              <th className="p-3 text-right">EPC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bySwap.map((r) => (
              <tr key={r.slug}>
                <td className="p-3">{getPair(r.slug)?.title ?? getBundle(r.slug)?.title ?? r.slug}</td>
                <td className="p-3 text-right">{r.clicks}</td>
                <td className="p-3 text-right">{r.sales}</td>
                <td className="p-3 text-right font-semibold">{r.earned.toFixed(2)}</td>
                <td className="p-3 text-right">{r.clicks ? (r.earned / r.clicks).toFixed(3) : "0"}</td>
              </tr>
            ))}
            {bySwap.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted">No clicks yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Clicks that earned nothing, by store</h2>
        <p className="mt-1 text-sm text-muted">
          Shoppers we sent to these stores without an affiliate tag. Join the top ones first.
        </p>
        <table className="card num mt-3 w-full overflow-hidden text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr><th className="p-3">Store</th><th className="p-3">Program to join</th><th className="p-3 text-right">Clicks</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leaks.map((r) => {
              const p = r.host ? programFor(`https://${r.host}/`) : undefined;
              return (
                <tr key={r.host ?? "unknown"}>
                  <td className="p-3">{r.host ?? "(older clicks, store not logged)"}</td>
                  <td className="p-3 text-muted">
                    {p ? (
                      <a href={p.signup} className="text-accent underline" target="_blank" rel="noreferrer">
                        {p.name} ({p.network})
                      </a>
                    ) : (
                      "none listed; a sub-network (Skimlinks or Sovrn) may cover it"
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold">{r.n}</td>
                </tr>
              );
            })}
            {leaks.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-muted">Every click was tagged.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Affiliate programs</h2>
        <p className="mt-1 text-sm text-muted">
          Switch a program on by setting its env var once you&apos;re approved (see docs/affiliate-playbook.md). Terms
          are a guide; check the network dashboard.
        </p>
        <table className="card mt-3 w-full overflow-hidden text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="p-3">Program</th>
              <th className="p-3">Network</th>
              <th className="p-3">Terms</th>
              <th className="p-3">Env</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {PROGRAMS.map((p) => (
              <tr key={p.id}>
                <td className="p-3">
                  <a href={p.signup} className="font-medium text-accent underline" target="_blank" rel="noreferrer">
                    {p.name}
                  </a>{" "}
                  <span className="text-xs text-muted">{p.country}</span>
                </td>
                <td className="p-3 text-muted">{p.network}</td>
                <td className="p-3 text-xs text-ink-2">{p.terms}</td>
                <td className="p-3 font-mono text-xs">
                  {p.network === "amazon" ? "AMAZON_ASSOCIATE_TAG, AMAZON_TAGS" : programEnvKey(p.id)}
                </td>
                <td className="p-3">
                  {isLive(p.id, p.network) ? (
                    <span className="font-semibold text-accent">live</span>
                  ) : (
                    <span className="text-muted">not set</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A program is live when a real link to one of its stores gets tagged by it. */
function isLive(id: string, network: string) {
  const p = PROGRAMS.find((x) => x.id === id);
  if (!p) return false;
  const host = network === "amazon" ? "amazon.com" : p.hosts[0];
  const live = tagLink(`https://www.${host}/`, "test").program === id;
  if (live || network !== "amazon") return live;
  return Boolean(process.env.AMAZON_TAGS);
}

function fmt(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

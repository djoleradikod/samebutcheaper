import Link from "next/link";
import { and, count, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getBundle, getPair } from "@/lib/catalog";
import { isoWeek } from "@/lib/letter";
import { letterSettings } from "@/lib/letter-settings";
import { mailConfigured } from "@/lib/mail";
import { COUNTRY_OPTIONS, countryName } from "@/lib/markets";
import { FLAG_COUNT, FLAG_DAYS, openReportCount, REPORT_LABEL, reportQueue, type ReportKind } from "@/lib/reports";
import { mostWanted, waitingList, type WantedRow } from "@/lib/wanted";
import { closeReport } from "./actions";
import { LetterTestForm } from "./LetterTestForm";

/**
 * The admin's view of the loops that keep the site true and bring people back: "Something wrong?" reports, what
 * shoppers wanted and didn't find, and the weekly letter. Each is one line in page.tsx.
 */

/** The overview card: open reports, and how many records have three or more. */
export async function OpenReportsStat() {
  const db = getDb();
  if (!db) return null;
  const [open, queue] = await Promise.all([openReportCount(db), reportQueue(db)]);
  const flagged = queue.filter((g) => g.flagged).length;
  return (
    <a href="#reports" className="card block p-4 hover:border-ink-2">
      <p className="text-xs text-muted">Open “Something wrong?” reports{flagged ? `, ${flagged} need a look` : ""}</p>
      <p className="mt-1 text-2xl font-semibold">{open.toLocaleString("en-US")}</p>
    </a>
  );
}

function recordTitle(kind: string, slug: string) {
  if (kind === "bundle") {
    const b = getBundle(slug);
    return { title: b?.bundle.name ?? slug, href: b ? `/bundle/${slug}` : null };
  }
  const p = getPair(slug);
  return { title: p?.title ?? slug, href: p ? `/compare/${slug}` : null };
}

function CloseButtons({ id, record, slug, all }: { id?: number; record?: string; slug?: string; all?: boolean }) {
  return (
    <span className="flex gap-1.5">
      {(["resolved", "dismissed"] as const).map((status) => (
        <form key={status} action={closeReport}>
          {id ? <input type="hidden" name="id" value={id} /> : null}
          {record ? <input type="hidden" name="record" value={record} /> : null}
          {slug ? <input type="hidden" name="slug" value={slug} /> : null}
          <input type="hidden" name="status" value={status} />
          <button type="submit" className="rounded border border-line-strong px-2 py-1 text-xs font-medium text-ink">
            {status === "resolved" ? (all ? "Resolve all" : "Resolve") : all ? "Dismiss all" : "Dismiss"}
          </button>
        </form>
      ))}
    </span>
  );
}

/** Open reports, grouped by page, newest first; pages with three or more price or stock reports lead. */
export async function ReportQueue() {
  const db = getDb();
  if (!db) return null;
  const groups = (await reportQueue(db)).slice(0, 40);
  return (
    <div id="reports" className="scroll-mt-6">
      <h2 className="text-xl font-semibold">“Something wrong?” reports</h2>
      <p className="mt-1 text-sm text-muted">
        Open reports by page, newest first. A page with {FLAG_COUNT} or more “price changed” or “out of stock” reports
        from different visitors in {FLAG_DAYS} days is marked and goes first. Resolve when you&apos;ve fixed the record,
        dismiss when it was right.
      </p>
      <div className="mt-3 space-y-3">
        {groups.map((g) => {
          const { title, href } = recordTitle(g.recordKind, g.slug);
          return (
            <div key={`${g.recordKind}:${g.slug}`} className={`card p-4 text-sm ${g.flagged ? "border-different" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {g.flagged && (
                    <p className="text-xs font-semibold text-different">
                      Needs a look: {g.urgentRecent} price or stock reports in {FLAG_DAYS} days
                    </p>
                  )}
                  <p className="font-semibold">
                    {href ? (
                      <Link href={href} className="underline underline-offset-2">
                        {title}
                      </Link>
                    ) : (
                      <>{title} (no longer in the catalogue)</>
                    )}
                    <span className="ml-2 text-xs font-normal text-muted">{g.recordKind === "bundle" ? "kit" : "swap"}</span>
                  </p>
                </div>
                <CloseButtons record={g.recordKind} slug={g.slug} all />
              </div>
              <ul className="mt-2 divide-y divide-line">
                {g.items.slice(0, 12).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">{REPORT_LABEL[r.kind as ReportKind] ?? r.kind}</span>
                      <span className="ml-2 text-xs text-muted">
                        {r.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC{r.country ? ` · ${r.country}` : ""}
                      </span>
                      {r.note && <span className="mt-0.5 block text-ink-2">{r.note}</span>}
                    </span>
                    <CloseButtons id={r.id} />
                  </li>
                ))}
                {g.items.length > 12 && <li className="py-2 text-xs text-muted">and {g.items.length - 12} more</li>}
              </ul>
            </div>
          );
        })}
        {groups.length === 0 && <p className="text-muted">No open reports.</p>}
      </div>
    </div>
  );
}

function WantedTable({ rows, showCountry }: { rows: WantedRow[]; showCountry: boolean }) {
  return (
    <table className="card num mt-2 w-full overflow-hidden text-sm">
      <thead className="bg-surface-2 text-left text-xs text-muted">
        <tr>
          <th className="p-3">Looked for</th>
          {showCountry && <th className="p-3">Country</th>}
          <th className="p-3">Where</th>
          <th className="p-3 text-right">7 days</th>
          <th className="p-3 text-right">30 days</th>
          <th className="p-3 text-right">Waiting</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={`${r.query}|${r.country}`}>
            <td className="p-3">{r.query}</td>
            {showCountry && <td className="p-3 text-muted">{r.country || "unknown"}</td>}
            <td className="p-3 text-muted">{r.sources}</td>
            <td className="p-3 text-right">{r.last7}</td>
            <td className="p-3 text-right font-semibold">{r.last30}</td>
            <td className="p-3 text-right">
              {r.waiting}
              {r.waitingPending ? <span className="text-muted"> +{r.waitingPending} unconfirmed</span> : null}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={showCountry ? 6 : 5} className="p-6 text-center text-muted">
              Nothing yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Zero-result searches and /check misses, most wanted first, overall and per country. */
export async function MostWanted() {
  const db = getDb();
  if (!db) return null;
  const [overall, perCountry, waits] = await Promise.all([
    mostWanted(db, { byCountry: false, limit: 25 }),
    mostWanted(db, { byCountry: true, limit: 400 }),
    waitingList(db, 200),
  ]);
  const countries = new Map<string, WantedRow[]>();
  for (const r of perCountry) countries.set(r.country, [...(countries.get(r.country) ?? []), r]);
  const order = [...countries.entries()].sort((a, b) => b[1].reduce((n, r) => n + r.last30, 0) - a[1].reduce((n, r) => n + r.last30, 0));
  const listed = new Set(overall.map((r) => r.query));
  const waitingOnly = waits.filter((w) => !listed.has(w.query)).slice(0, 15);
  return (
    <div>
      <h2 className="text-xl font-semibold">Most wanted: looked for and not found</h2>
      <p className="mt-1 text-sm text-muted">
        Searches on /search with no results, and products /check could read but we have no swap for. Each visitor
        counts once per query a day. “Waiting” is how many asked to be told when we add it.{" "}
        <a href="/admin/export/wanted?days=30" className="underline underline-offset-2" download>
          Download CSV (30 days)
        </a>{" "}
        ·{" "}
        <a href="/admin/export/wanted?days=7" className="underline underline-offset-2" download>
          7 days
        </a>
      </p>
      <h3 className="mt-4 text-base font-semibold">All countries</h3>
      <WantedTable rows={overall} showCountry={false} />
      {order.length > 0 && (
        <div className="mt-4 space-y-2">
          {order.map(([cc, rows]) => (
            <details key={cc || "unknown"} className="card p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                {cc ? `${countryName(cc)} (${cc})` : "Country unknown"}{" "}
                <span className="font-normal text-muted">· {rows.reduce((n, r) => n + r.last30, 0)} in 30 days</span>
              </summary>
              <WantedTable rows={rows.slice(0, 15)} showCountry={false} />
            </details>
          ))}
        </div>
      )}
      {waitingOnly.length > 0 && (
        <p className="mt-3 text-sm text-ink-2">
          Also waiting, for searches not in the last 30 days:{" "}
          {waitingOnly.map((w, i) => (
            <span key={w.query}>
              {i > 0 && ", "}
              {w.query} ({w.active}
              {w.pending ? ` +${w.pending}` : ""})
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

const PREVIEW_COUNTRIES = ["US", "GB", "DE", "CA", "IE"];

/** The weekly letter: who gets it, whether it's on, previews and a test send. */
export async function LetterPanel() {
  const db = getDb();
  if (!db) return null;
  const s = schema.subscribers;
  const week = isoWeek(new Date());
  const [[{ n: readers }], [{ n: watching }], weekly] = await Promise.all([
    db.select({ n: count() }).from(s).where(and(eq(s.status, "confirmed"), eq(s.newsletter, "yes"))),
    db.select({ n: count() }).from(schema.watches).where(eq(schema.watches.status, "active")),
    db
      .select({ status: schema.sends.status, n: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.sends)
      .where(and(eq(schema.sends.kind, "weekly"), eq(schema.sends.key, week)))
      .groupBy(schema.sends.status),
  ]);
  const settings = letterSettings(process.env);
  const sentThisWeek = weekly.find((w) => w.status === "sent")?.n ?? 0;
  const state = !settings.on
    ? "Off (NEWSLETTER_WEEKLY is not “on”)."
    : !settings.postalAddress
      ? "Held back: MAIL_POSTAL_ADDRESS is not set."
      : !mailConfigured()
        ? "On, but email isn't set up, so it is only logged."
        : `On: goes out from weekday ${settings.weekday} of each week, up to ${settings.cap} a run.`;
  return (
    <div>
      <h2 className="text-xl font-semibold">Weekly letter and price watches</h2>
      <p className="mt-1 text-sm text-ink-2">
        {state} {readers.toLocaleString("en-US")} confirmed readers; {sentThisWeek} sent this week ({week}).{" "}
        {watching.toLocaleString("en-US")} active price watches.
      </p>
      <p className="mt-2 text-sm text-muted">
        Preview this week&apos;s letter as a new reader would get it:{" "}
        {PREVIEW_COUNTRIES.map((cc, i) => (
          <span key={cc}>
            {i > 0 && " · "}
            <a href={`/admin/letter-preview?country=${cc}`} target="_blank" rel="noopener" className="underline underline-offset-2">
              {cc}
            </a>
          </span>
        ))}
        {" · "}
        <a href="/admin/letter-preview" target="_blank" rel="noopener" className="underline underline-offset-2">
          country unknown
        </a>
      </p>
      <LetterTestForm defaultEmail={process.env.ADMIN_EMAIL?.trim() ?? ""} countries={COUNTRY_OPTIONS} />
    </div>
  );
}

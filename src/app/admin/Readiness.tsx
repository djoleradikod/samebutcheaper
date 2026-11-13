import { getDb } from "@/db";
import { affiliateEnv } from "@/lib/affiliate-links";
import { lastMaintenance } from "@/lib/maintenance";
import { readinessChecks, summarize, type Check } from "@/lib/readiness";
import { dbStatus, MIGRATIONS_EXPECTED } from "@/lib/server/db-status";
import { SITE } from "@/lib/site";
import { runUpkeepNow } from "./actions";

const LEVEL: Record<Check["level"], string> = { blocker: "Must fix", recommended: "Should fix", optional: "Optional" };

/** The launch checklist: what is configured on this server, and what to do about what isn't. */
export async function Readiness() {
  const db = getDb();
  const status = await dbStatus();
  const checks = readinessChecks(process.env, {
    siteUrl: SITE.url,
    ...status,
    migrationsExpected: MIGRATIONS_EXPECTED,
    affiliateEnv: affiliateEnv(),
  });
  const { ready, blockers, recommended } = summarize(checks);
  const upkeep = db ? await lastMaintenance(db).catch(() => null) : null;

  return (
    <div>
      <h2 className="text-xl font-semibold">Launch checklist</h2>
      <p className={`mt-1 text-sm ${ready ? "text-same" : "text-different"}`}>
        {ready
          ? recommended.length
            ? `Safe to open to the public. ${recommended.length} thing${recommended.length === 1 ? "" : "s"} below would make it earn or work better.`
            : "Everything is set."
          : `${blockers.length} thing${blockers.length === 1 ? "" : "s"} to fix before opening to the public.`}
      </p>
      <table className="stack card mt-3 w-full overflow-hidden text-sm">
        <thead className="bg-surface-2 text-left text-xs text-muted">
          <tr><th className="p-3">Check</th><th className="p-3">Now</th><th className="p-3">What to do</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {checks.map((c) => (
            <tr key={c.id}>
              <td className="p-3 align-top">
                <span className={`font-semibold ${c.ok ? "text-same" : c.level === "blocker" ? "text-different" : "text-warn"}`}>
                  {c.ok ? "OK" : LEVEL[c.level]}
                </span>
                <span className="block">{c.label}</span>
              </td>
              <td data-label="Now" className="p-3 align-top text-ink-2">{c.detail}</td>
              <td data-label="What to do" className="p-3 align-top text-muted">{c.ok ? "" : c.fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form action={runUpkeepNow} className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span>
          Daily upkeep (old data removed, waiting confirmation emails, price watches and the weekly letter sent):{" "}
          {upkeep
            ? `last ran ${upkeep.ranAt.slice(0, 16).replace("T", " ")} UTC. ${upkeep.pendingSubscribersDeleted} unconfirmed sign-ups and ${upkeep.lookupsDeleted} old product checks removed, ${upkeep.confirmationsSent} confirmation emails sent, ${upkeep.watchMailsSent ?? 0} price-watch emails sent${upkeep.watchChangesUnsent ? ` (${upkeep.watchChangesUnsent} only logged)` : ""}. Weekly letter: ${upkeep.letter ?? "not run"}.`
            : "has not run yet."}
        </span>
        <button type="submit" className="rounded border border-line-strong px-2 py-1 font-medium text-ink">Run now</button>
      </form>
    </div>
  );
}

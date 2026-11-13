/**
 * Records shoppers have reported as changed (src/lib/reports.ts flaggedRecords), as last loaded by
 * src/lib/reported.ts. A runtime signal like a stale price: such a record keeps its page but never leads a ranked
 * list (the home page grid, the top of a list page) until an admin resolves the reports.
 *
 * Ranking code is synchronous, so it reads this snapshot. It is the same for every visitor, so a shared copy is
 * correct; the request-time part of each list page (ForCountry) refreshes it through the short-lived cache before
 * it ranks anything. Before the first load, and wherever there is no database, nothing is reported.
 */
type Snapshot = { pair: ReadonlySet<string>; bundle: ReadonlySet<string> };

const g = globalThis as unknown as { __sbcReported?: Snapshot };

export function setReported(next: { recordKind: "pair" | "bundle"; slug: string }[]) {
  g.__sbcReported = {
    pair: new Set(next.filter((r) => r.recordKind === "pair").map((r) => r.slug)),
    bundle: new Set(next.filter((r) => r.recordKind === "bundle").map((r) => r.slug)),
  };
}

export function isReported(kind: "pair" | "bundle", slug: string) {
  return g.__sbcReported?.[kind].has(slug) ?? false;
}

/** Whether a swap may lead a ranked list right now: not a stale price, and not reported as changed. */
export function canLeadNow(p: { slug: string; priceOld: boolean }) {
  return !p.priceOld && !isReported("pair", p.slug);
}

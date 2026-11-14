#!/usr/bin/env node
/**
 * Whether the deploy must rebuild every day: true when PRICE_FEED_URLS has a line for a store whose programme lets us
 * show its prices only from its own feed and only for a limited number of hours (Walmart: 24, data/sellers/programmes.json
 * `terms.prices`). Then a weekly build would show those prices for a day and withhold them for six, so the deploy
 * workflow reads the feed and rebuilds daily; without such a feed it stays weekly (docs/prices-daily.md).
 *
 *   PRICE_FEED_URLS="impact:walmart@US=https://..." node scripts/ci/price-schedule.mjs
 *   daily=true
 *   stores=walmart
 *
 * Writes to $GITHUB_OUTPUT when set. Plain Node with no dependencies, so the workflow's first job runs it without
 * installing anything; scripts/tests/price-schedule.test.ts checks it against src/lib/programme-terms.ts `dailyStores`.
 * Never prints a feed address: only store ids.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Store ids with a line in PRICE_FEED_URLS ("[network:]store@MARKET=url", one per line or comma-separated). */
export function feedLineStores(raw) {
  return [
    ...new Set(
      (raw ?? "")
        .split(/\n+|,(?=\s*(?:[a-z]+:)?[a-z0-9-]+@[A-Z]{2}=)/)
        .map((s) => /^\s*(?:[a-z]+:)?([a-z0-9-]+)@[A-Z]{2}=/.exec(s)?.[1])
        .filter(Boolean),
    ),
  ];
}

/** The stores in `feedUrls` whose price rule a fresh feed can meet and that limits how old a shown price may be. */
export function dailyStores(registry, feedUrls) {
  return feedLineStores(feedUrls)
    .filter((store) => {
      const entry = registry.stores?.[store];
      if (!entry) return false;
      const prices = entry.terms?.prices ?? registry.networks?.[entry.network]?.terms?.prices;
      return prices?.only === "feed" && Number(prices.maxAgeHours) > 0;
    })
    .sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const registry = JSON.parse(readFileSync(new URL("../../data/sellers/programmes.json", import.meta.url), "utf8"));
  const stores = dailyStores(registry, process.env.PRICE_FEED_URLS);
  const out = `daily=${stores.length > 0}\nstores=${stores.join(",")}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out);
  process.stdout.write(out);
}

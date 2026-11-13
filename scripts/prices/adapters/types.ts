import type { Method } from "../observations";
import type { PricedRecord } from "../records";

/** A price a source reports for one side of one record. It becomes an observation if the refresh accepts it. */
export type Candidate = {
  record: string;
  side: string;
  price: number;
  currency: string;
  seen: string;
  source: string;
  url: string;
  method: Method;
  attribution?: string;
  note?: string;
  /** The pack the source says it priced, when it says. Compared with the record's pack before anything changes. */
  pack?: { size: number; unit: string } | null;
  /** Feeds: the network's tracked link, logged so /go can use it. */
  link?: string;
  /** Feeds: "out" when the feed lists it out of stock. Such a candidate is logged but never changes a price. */
  stock?: "in" | "out";
  /** Feeds: matched by name alone, so a person must confirm it (decide.ts sends it to review). */
  needsReview?: string;
};

/** Just what the adapters need from fetch, so tests can hand them recorded responses. */
export type Fetcher = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer>; /** Streamed when present (feeds are large). */ body?: ReadableStream<Uint8Array> | null }>;

export type AdapterContext = {
  today: string;
  fetch: Fetcher;
  env: Record<string, string | undefined>;
  /** Waits between requests to one host. Tests pass a no-op. */
  sleep: (ms: number) => Promise<void>;
};

export type AdapterResult = {
  candidates: Candidate[];
  notes: string[];
  /** Feeds only: what each feed did, for the report, /admin and the readiness check (feed.ts FeedStats). */
  feedStats?: import("./feed").FeedStats[];
};

/**
 * One licensed price source. An adapter only ever reads its own source (an open API, a feed the merchant
 * publishes for affiliates, a file of hand checks), never a store's own pages.
 */
export interface PriceAdapter {
  id: string;
  /** One line on the source and the licence or agreement that lets us use it, for the report. */
  licence: string;
  collect(records: PricedRecord[], ctx: AdapterContext): Promise<AdapterResult>;
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

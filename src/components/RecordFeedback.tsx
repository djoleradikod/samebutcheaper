import { Suspense } from "react";
import { reportedRecords } from "@/lib/reported";
import { RecordFeedbackForms } from "./RecordFeedbackForms";

/**
 * The foot of a swap or kit page: "Email me if this changes" (swaps only) and the "Something wrong?" form. The shoppers'
 * reports note sits by the price instead (ReportedPriceNote).
 */
export function RecordFeedback({ record, slug }: { record: "pair" | "bundle"; slug: string }) {
  return <RecordFeedbackForms record={record} slug={slug} />;
}

/**
 * "Reported by shoppers: ..." by the price, where the shopper decides, when there is a report. Read at request time from
 * a cache that lives a minute (src/lib/reported.ts), so the rest of the page stays prerendered. It takes no room
 * otherwise and shows on few pages, so it has no stand-in.
 */
export function ReportedPriceNote({ record, slug, className = "" }: { record: "pair" | "bundle"; slug: string; className?: string }) {
  return (
    <Suspense fallback={null}>
      <ReportedNote record={record} slug={slug} className={className} />
    </Suspense>
  );
}

/**
 * Three or more shoppers have reported a changed price or no stock in the last two weeks, and nobody at our end
 * has checked yet. Says so plainly, without guessing which way the price went.
 */
async function ReportedNote({ record, slug, className }: { record: "pair" | "bundle"; slug: string; className: string }) {
  const flag = (await reportedRecords()).find((r) => r.recordKind === record && r.slug === slug);
  if (!flag) return null;
  const text =
    flag.stock > 0 && flag.price === 0
      ? "Shoppers report this is out of stock at the store. We're re-checking."
      : flag.stock > 0
        ? "Shoppers report this price has changed or is out of stock. We're re-checking."
        : "Shoppers report this price has changed. We're re-checking.";
  return (
    <p role="note" className={`rounded-card border border-line-strong bg-paper px-4 py-3 text-sm text-ink md:px-5 ${className}`}>
      <span className="font-semibold">Reported by shoppers: </span>
      {text} Until we have, check the price and stock on the store&apos;s own page before you buy.
    </p>
  );
}

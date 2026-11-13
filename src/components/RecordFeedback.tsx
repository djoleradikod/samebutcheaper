import { Suspense } from "react";
import { reportedRecords } from "@/lib/reported";
import { RecordFeedbackForms } from "./RecordFeedbackForms";
import { getT, type Lang } from "@/lib/i18n";

/**
 * The foot of a swap or kit page: "Email me if this changes" (swaps only) and the "Something wrong?" form. The shoppers'
 * reports note sits by the price instead (ReportedPriceNote). The forms read the page's language themselves (useT).
 */
export function RecordFeedback({ record, slug }: { record: "pair" | "bundle"; slug: string }) {
  return <RecordFeedbackForms record={record} slug={slug} />;
}

/**
 * "Reported by shoppers: ..." by the price, where the shopper decides, when there is a report. Read at request time from
 * a cache that lives a minute (src/lib/reported.ts), so the rest of the page stays prerendered. It takes no room
 * otherwise and shows on few pages, so it has no stand-in.
 */
export function ReportedPriceNote({
  record,
  slug,
  className = "",
  lang = "en",
}: {
  record: "pair" | "bundle";
  slug: string;
  className?: string;
  lang?: Lang;
}) {
  return (
    <Suspense fallback={null}>
      <ReportedNote record={record} slug={slug} className={className} lang={lang} />
    </Suspense>
  );
}

/**
 * Three or more shoppers have reported a changed price or no stock in the last two weeks, and nobody at our end
 * has checked yet. Says so plainly, without guessing which way the price went.
 */
async function ReportedNote({ record, slug, className, lang }: { record: "pair" | "bundle"; slug: string; className: string; lang: Lang }) {
  const flag = (await reportedRecords()).find((r) => r.recordKind === record && r.slug === slug);
  if (!flag) return null;
  const t = getT(lang);
  const text =
    flag.stock > 0 && flag.price === 0
      ? t("actions.reportedOut")
      : flag.stock > 0
        ? t("actions.reportedEither")
        : t("actions.reportedPrice");
  return (
    <p role="note" className={`rounded-card border border-line-strong bg-paper px-4 py-3 text-sm text-ink md:px-5 ${className}`}>
      <span className="font-semibold">{t("actions.reportedBy")}</span>
      {text} {t("actions.untilWe")}
    </p>
  );
}

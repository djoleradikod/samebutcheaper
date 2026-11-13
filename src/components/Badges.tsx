import { clientT } from "@/lib/i18n/client-dict";
import type { Lang } from "@/lib/i18n/lang";
import type { MatchType } from "@/lib/types";
import { PctTicket } from "./Ticket";
import { cards } from "@/lib/i18n/en/client/cards";

/** The English this component reads (src/lib/i18n/client-dict.ts). */
const TEXT = { cards };

/** The saving as a shelf ticket. Kept for pages that still ask for a badge. */
export function SavingsBadge({ pct, size = "md" }: { pct: number; size?: "md" | "lg" }) {
  return <PctTicket pct={pct} size={size} />;
}

/** The match level as plain text. */
export function MatchBadge({ type, long = false, lang = "en" }: { type: MatchType; long?: boolean; lang?: Lang }) {
  const t = clientT(lang, TEXT);
  const meta = { label: t("cards.matchLabel", type), short: t("cards.matchShortPlain", type), description: t("cards.matchDescription", type) };
  return (
    <span title={meta.description} className={`text-[13px] font-medium ${type === "same_kind" ? "text-muted" : "text-same"}`}>
      {long ? meta.label : meta.short}
    </span>
  );
}

export function ConfidenceBadge({ confidence, lang = "en" }: { confidence: "high" | "medium"; lang?: Lang }) {
  const t = clientT(lang, TEXT);
  if (confidence === "high")
    return (
      <span className="text-[13px] font-medium text-muted" title={t("cards.confidence.highTitle")}>
        {t("cards.confidence.high")}
      </span>
    );
  return (
    <span
      className="text-[13px] font-medium text-different"
      title={t("cards.confidence.mediumTitle")}
    >
      {t("cards.confidence.medium")}
    </span>
  );
}

import { MATCH_TYPE_META } from "@/lib/categories";
import type { MatchType } from "@/lib/types";
import { PctTicket } from "./Ticket";

/** The saving as a shelf ticket. Kept for pages that still ask for a badge. */
export function SavingsBadge({ pct, size = "md" }: { pct: number; size?: "md" | "lg" }) {
  return <PctTicket pct={pct} size={size} />;
}

/** The match level as plain text. */
export function MatchBadge({ type, long = false }: { type: MatchType; long?: boolean }) {
  const meta = MATCH_TYPE_META[type];
  return (
    <span title={meta.description} className={`text-[13px] font-medium ${type === "same_kind" ? "text-muted" : "text-same"}`}>
      {long ? meta.label : meta.short}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" }) {
  if (confidence === "high")
    return (
      <span className="text-[13px] font-medium text-muted" title="Both labels were confirmed from primary sources">
        Label-verified
      </span>
    );
  return (
    <span
      className="text-[13px] font-medium text-different"
      title="Strong evidence, but not every detail came from a primary source"
    >
      Strong evidence
    </span>
  );
}

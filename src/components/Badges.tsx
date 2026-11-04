import { BadgeCheck, Factory, FlaskConical, Gauge } from "lucide-react";
import { MATCH_TYPE_META } from "@/lib/categories";
import type { MatchType } from "@/lib/types";

export function SavingsBadge({ pct, size = "md" }: { pct: number; size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <span
      className={`num inline-flex shrink-0 items-baseline gap-1 rounded-full whitespace-nowrap bg-highlight font-semibold text-highlight-ink ${
        big ? "px-4 py-1.5 text-lg" : "px-2.5 py-0.5 text-sm"
      }`}
    >
      Save {Math.round(pct)}%
    </span>
  );
}

const MATCH_ICON = {
  identical_active: FlaskConical,
  identical_formula: BadgeCheck,
  same_manufacturer: Factory,
  equivalent_spec: Gauge,
} as const;

export function MatchBadge({ type, long = false }: { type: MatchType; long?: boolean }) {
  const meta = MATCH_TYPE_META[type];
  const Icon = MATCH_ICON[type];
  return (
    <span
      title={meta.description}
      className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-strong"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {long ? meta.label : meta.short}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" }) {
  if (confidence === "high")
    return (
      <span
        className="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-xs text-muted"
        title="Both labels were confirmed from primary sources"
      >
        Label-verified
      </span>
    );
  return (
    <span
      className="inline-flex items-center rounded-full bg-warn-soft px-2.5 py-0.5 text-xs text-warn"
      title="Strong evidence, but not every detail came from a primary source"
    >
      Strong evidence
    </span>
  );
}

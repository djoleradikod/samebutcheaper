import type { ReactNode } from "react";
import type { Currency } from "@/lib/format";
import { Money } from "./Money";

export type TicketSize = "sm" | "md" | "lg";

/**
 * The yellow shelf ticket. It only ever shows a saving, and a card gets one at most.
 * `label` is what a screen reader hears instead of the printed text.
 */
export function Ticket({
  children,
  size = "md",
  sub,
  label,
  grow = false,
  className = "",
}: {
  children: ReactNode;
  size?: TicketSize;
  /** Small second line, for a large ticket. */
  sub?: ReactNode;
  label?: string;
  /** Grow a small ticket to medium where the card has room. */
  grow?: boolean;
  className?: string;
}) {
  return (
    <span className={`ticket ticket-${size} ${grow ? "ticket-up" : ""} ${className}`}>
      {label && <span className="sr-only">{label}</span>}
      <span aria-hidden={label ? true : undefined}>{children}</span>
      {sub && (
        <span className="ticket-sub" aria-hidden={label ? true : undefined}>
          {sub}
        </span>
      )}
    </span>
  );
}

/** "−52%" */
export function PctTicket({
  pct,
  size,
  grow,
  className,
  label,
  german = false,
}: {
  pct: number;
  size?: TicketSize;
  grow?: boolean;
  className?: string;
  /** What a screen reader hears, in the page's language. */
  label?: string;
  /** On a German page: "−52 %", with the space German sets before the sign. */
  german?: boolean;
}) {
  const n = Math.round(pct);
  // No saving to show: a saving under half a percent, or one a store's affiliate terms withhold (programme-terms.ts).
  if (n <= 0) return null;
  return (
    <Ticket size={size} grow={grow} className={className} label={label ?? `${n}% cheaper`}>
      −{n}
      {german ? "\u00a0%" : "%"}
    </Ticket>
  );
}

/** "Save £4.20" */
export function SaveTicket({
  amount,
  currency,
  size,
  sub,
  className,
  word = "Save",
}: {
  amount: number;
  currency: Currency;
  size?: TicketSize;
  sub?: ReactNode;
  className?: string;
  /** "Save", in the page's language. */
  word?: string;
}) {
  // Nothing saved to show, or a saving a store's affiliate terms withhold (src/lib/programme-terms.ts).
  if (!(amount > 0)) return null;
  return (
    <Ticket size={size} sub={sub} className={className}>
      {word} <Money n={amount} from={currency} prose />
    </Ticket>
  );
}

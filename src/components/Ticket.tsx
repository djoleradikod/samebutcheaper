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
}: {
  pct: number;
  size?: TicketSize;
  grow?: boolean;
  className?: string;
}) {
  const n = Math.round(pct);
  return (
    <Ticket size={size} grow={grow} className={className} label={`${n}% cheaper`}>
      −{n}%
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
}: {
  amount: number;
  currency: Currency;
  size?: TicketSize;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <Ticket size={size} sub={sub} className={className}>
      Save <Money n={amount} from={currency} prose />
    </Ticket>
  );
}

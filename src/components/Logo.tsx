/** A shelf ticket with its punched hole, in ink. Yellow stays reserved for real savings. */
export function LogoMark({ className = "h-5 w-[26px] md:h-6 md:w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" className={className} aria-hidden="true">
      <path
        fill="var(--ink)"
        fillRule="evenodd"
        d="M3 0h26a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3Zm4.5 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM13 7v10h3V7h-3Zm6 3v7h7v-7h-7Z"
      />
    </svg>
  );
}

/** The name does what the site does: "Same" at full width, "Cheaper" narrower. */
export function Logo() {
  return (
    <span data-logo className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="text-[1.0625rem] leading-none tracking-tight whitespace-nowrap">
        <span className="font-bold [font-stretch:112%]">SameBut</span>
        <span className="text-[1.1875rem] font-extrabold [font-stretch:75%]">Cheaper</span>
      </span>
    </span>
  );
}

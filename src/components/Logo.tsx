export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <rect x="8" y="11" width="16" height="3.2" rx="1.6" fill="var(--accent-ink)" />
      <rect x="8" y="18" width="10" height="3.2" rx="1.6" fill="var(--accent-ink)" />
      <circle cx="22.5" cy="19.6" r="2.4" fill="var(--highlight)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="text-[1.05rem] font-semibold tracking-tight">
        SameBut<span className="text-accent">Cheaper</span>
      </span>
    </span>
  );
}

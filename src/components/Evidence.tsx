import { AlertTriangle, ExternalLink, Info } from "lucide-react";

export const HEALTH_CATEGORIES = new Set(["otc-medicine", "supplements", "baby", "pet", "skincare-personal-care"]);

export function hostname(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function pathOf(u: string) {
  try {
    const p = new URL(u).pathname;
    return p.length > 1 ? p : "";
  } catch {
    return "";
  }
}

export function SourceList({ sources }: { sources: string[] }) {
  return (
    <section>
      <h2 className="display text-2xl font-medium">Sources</h2>
      <p className="mt-1 text-sm text-muted">What we checked. Look for yourself.</p>
      <ol className="mt-4 space-y-2">
        {sources.map((s, i) => (
          <li key={s} className="flex gap-3 text-sm">
            <span className="num w-5 shrink-0 text-muted">{i + 1}.</span>
            <a
              href={s}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex min-w-0 items-center gap-1 text-accent underline-offset-2 hover:underline"
            >
              <span className="font-medium">{hostname(s)}</span>
              <span className="truncate text-muted">{pathOf(s)}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Differences({ text, title = "Honest differences" }: { text: string; title?: string }) {
  if (!text) return null;
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-surface-2 p-5">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{text}</p>
      </div>
    </div>
  );
}

export function HealthNotice() {
  return (
    <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-5 text-sm text-ink-2">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
      <p className="leading-relaxed">
        This compares labels and published evidence. It isn&apos;t medical advice. Inactive ingredients
        (fillers, dyes, flavours) can differ, which matters if you have allergies. Always read the label, and
        ask a pharmacist, doctor or vet if you&apos;re unsure.
      </p>
    </div>
  );
}

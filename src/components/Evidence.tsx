import Link from "next/link";
import type { CategorySlug, Photo } from "@/lib/types";
import { ProductThumb } from "./ProductThumb";

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
    <section className="min-w-0">
      <h2 className="display text-[22px] md:text-2xl">Sources</h2>
      <p className="mt-1 text-sm text-ink-2">What we checked. Look for yourself.</p>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {sources.map((s) => (
          <li key={s}>
            <a
              href={s}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex min-h-11 min-w-0 items-center py-1.5 text-sm text-cobalt hover:underline"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium">{hostname(s)}</span>
                <span className="text-muted">{pathOf(s)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Differences({ text, title = "What differs" }: { text: string; title?: string }) {
  if (!text) return null;
  return (
    <div className="rounded-card border border-line bg-canvas p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-ink-2">{text}</p>
    </div>
  );
}

export function HealthNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-card border border-different/30 bg-different-soft p-3.5 text-sm text-ink-2 ${className}`}>
      <span className="font-semibold text-ink">Read the label. </span>
      This compares labels and published evidence. It isn&apos;t medical advice. Inactive ingredients (fillers, dyes,
      flavours) can differ, which matters if you have allergies. Ask a pharmacist, doctor or vet if you&apos;re unsure.
    </p>
  );
}

/** The licence's own page, for the licences our photo sources use. Null when we don't know one. */
export function licenceUrl(licence: string) {
  const cc = licence.match(/CC[ -]BY(-SA)?[ -](\d\.\d)/i);
  if (cc) return `https://creativecommons.org/licenses/by${cc[1] ? "-sa" : ""}/${cc[2]}/`;
  if (/CC0/i.test(licence)) return "https://creativecommons.org/publicdomain/zero/1.0/";
  return null;
}

/**
 * One small credit line for both photos under the shelf: each product links to its photo's page, and the
 * credit and licence print once when they match. "Background removed" comes from the credit itself.
 */
export function PhotoLine({ items, className = "" }: { items: { name: string; photo: Photo | null }[]; className?: string }) {
  const linkClass = "underline underline-offset-2 hover:text-ink";
  const photographed = items.filter((i) => i.photo);
  const missing = items.filter((i) => !i.photo);
  const groups = new Map<string, { credit: string; license: string; items: typeof items }>();
  for (const item of photographed) {
    const { credit, license } = item.photo!;
    const key = `${credit}|${license}`;
    const group = groups.get(key) ?? { credit, license, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      {photographed.length > 0 && "Photos: "}
      {[...groups.values()].map((g, i) => {
        const url = licenceUrl(g.license);
        return (
          <span key={`${g.credit}|${g.license}`}>
            {i > 0 && "; "}
            {g.items.map((item, j) => (
              <span key={j}>
                {j > 0 && ", "}
                <a href={item.photo!.page} target="_blank" rel="noopener noreferrer nofollow" className={linkClass}>
                  {item.name}
                </a>
              </span>
            ))}{" "}
            by {g.credit},{" "}
            {url ? (
              <a href={url} target="_blank" rel="noopener" className={linkClass}>
                {g.license}
              </a>
            ) : (
              g.license
            )}
          </span>
        );
      })}
      {photographed.length > 0 && ". "}
      {missing.length > 0 && `No licensed photo of ${missing.map((i) => i.name).join(" or ")} yet.`}
    </p>
  );
}

export type CreditItem = { name: string; brand: string; photo: Photo | null; category?: CategorySlug; unit?: string };

/** Who took each photo, under what licence, where it came from and what we did to it. */
export function PhotoCredits({ items }: { items: CreditItem[] }) {
  if (!items.some((i) => i.photo)) return null;
  return (
    <section className="min-w-0">
      <h2 className="display text-[22px] md:text-2xl">Photo credits</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {items.map((item) => {
          const url = item.photo ? licenceUrl(item.photo.license) : null;
          return (
            <li key={item.name} className="flex gap-3 py-3">
              <ProductThumb
                size="sm"
                image={item.photo?.src ?? null}
                brand={item.brand}
                alt={item.name}
                category={item.category}
                unit={item.unit}
              />
              <div className="min-w-0 text-sm text-ink-2">
                <p className="font-medium text-ink">{item.name}</p>
                {item.photo ? (
                  <>
                    <p className="mt-0.5">
                      {item.photo.credit},{" "}
                      {url ? (
                        <a href={url} target="_blank" rel="noopener" className="text-cobalt underline underline-offset-2">
                          {item.photo.license}
                        </a>
                      ) : (
                        item.photo.license
                      )}
                      .{" "}
                      <a
                        href={item.photo.page}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-cobalt underline underline-offset-2"
                      >
                        Where it came from
                      </a>
                    </p>
                    {/BY-SA/i.test(item.photo.license) && (
                      <p className="mt-0.5 text-[13px] text-muted">Adapted: cropped and placed on white.</p>
                    )}
                  </>
                ) : (
                  <p className="mt-0.5">No licensed photo yet. The drawing is only a placeholder.</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[13px] text-muted">
        Pack designs and trademarks belong to their owners.{" "}
        <Link
          href="/credits"
          className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2 md:min-h-0"
        >
          All photo credits
        </Link>
      </p>
    </section>
  );
}

import Link from "next/link";
import { ArrowRight, Boxes } from "lucide-react";
import type { Bundle } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/categories";
import { money } from "@/lib/format";
import { MatchBadge, SavingsBadge } from "./Badges";

export function BundleCard({ bundle }: { bundle: Bundle }) {
  const cat = CATEGORY_MAP[bundle.category];
  return (
    <Link
      href={`/bundle/${bundle.slug}`}
      className="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
          <Boxes className="h-3.5 w-3.5" /> {cat.name} bundle
        </span>
        <SavingsBadge pct={bundle.savingsPct} />
      </div>
      <p className="mt-4 text-xs text-brand-tone">Instead of the {bundle.bundle.brand} kit</p>
      <p className="text-lg leading-snug font-semibold">{bundle.bundle.name}</p>
      <ul className="mt-3 space-y-1 text-sm text-ink-2">
        {bundle.components.slice(0, 4).map((c) => (
          <li key={c.replaces} className="flex gap-2">
            <span className="text-accent">✓</span>
            <span className="line-clamp-1">{withBrand(c.brand, c.product)}</span>
          </li>
        ))}
        {bundle.components.length > 4 && (
          <li className="text-muted">+{bundle.components.length - 4} more</li>
        )}
      </ul>
      <div className="mt-auto pt-5">
        <div className="num flex items-end justify-between border-t border-line pt-4 text-sm">
          <div>
            <p className="text-xs text-muted">Kit vs DIY</p>
            <p>
              <span className="text-muted line-through">{money(bundle.bundle.price, bundle.currency)}</span>{" "}
              <span className="font-semibold text-accent">{money(bundle.equivalentTotal, bundle.currency)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">You save</p>
            <p className="font-semibold">{money(bundle.savings, bundle.currency)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <MatchBadge type={bundle.match_type} />
          <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>
      </div>
    </Link>
  );
}

function withBrand(brand: string, product: string) {
  return product.toLowerCase().startsWith(brand.toLowerCase()) ? product : `${brand} ${product}`;
}

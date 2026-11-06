import Link from "next/link";
import { ArrowRight, Boxes } from "lucide-react";
import type { Bundle } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/categories";
import { money } from "@/lib/format";
import { MatchBadge, SavingsBadge } from "./Badges";
import { ProductThumb } from "./ProductThumb";

export function BundleCard({ bundle }: { bundle: Bundle }) {
  const cat = CATEGORY_MAP[bundle.category];
  return (
    <Link
      href={`/bundle/${bundle.slug}`}
      className="card group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_14px_34px_-14px_rgba(10,138,82,0.35)]"
    >
      {/* The kit, then the cheaper pieces that replace it */}
      <div className="relative flex items-center gap-3 bg-gradient-to-br from-tint via-white to-surface-2 px-5 pt-5 pb-4">
        <div className="relative opacity-80 grayscale-[35%]">
          <ProductThumb
            image={bundle.photo?.src ?? null}
            brand={bundle.bundle.brand}
            category={bundle.category}
            size="sm"
          />
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-brand-tone shadow-sm ring-1 ring-line">
            Kit
          </span>
        </div>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        <div className="flex -space-x-3">
          {bundle.components.slice(0, 4).map((c) => (
            <ProductThumb
              key={c.replaces}
              image={c.photo?.src ?? null}
              brand={c.brand}
              category={bundle.category}
              unit={c.unit}
              size="sm"
              className="h-12! w-12! ring-2 ring-white"
            />
          ))}
        </div>
        <span className="absolute top-3 right-3">
          <SavingsBadge pct={bundle.savingsPct} />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5 pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
          <Boxes className="h-3.5 w-3.5" /> {cat.name} bundle
        </span>
        <p className="mt-3 text-xs text-brand-tone">
          Instead of the {bundle.bundle.brand} kit
        </p>
        <p className="text-lg leading-snug font-semibold">
          {bundle.bundle.name}
        </p>
        <ul className="mt-3 space-y-1 text-sm text-ink-2">
          {bundle.components.slice(0, 4).map((c) => (
            <li key={c.replaces} className="flex gap-2">
              <span className="text-accent">✓</span>
              <span className="line-clamp-1">
                {withBrand(c.brand, c.product)}
              </span>
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
                <span className="text-muted line-through">
                  {money(bundle.bundle.price, bundle.currency)}
                </span>{" "}
                <span className="font-semibold text-accent">
                  {money(bundle.equivalentTotal, bundle.currency)}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">You save</p>
              <p className="font-semibold">
                {money(bundle.savings, bundle.currency)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <MatchBadge type={bundle.match_type} />
            <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function withBrand(brand: string, product: string) {
  return product.toLowerCase().startsWith(brand.toLowerCase())
    ? product
    : `${brand} ${product}`;
}

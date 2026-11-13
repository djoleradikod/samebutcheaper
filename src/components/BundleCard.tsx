import Link from "@/components/CountryLink";
import type { Bundle } from "@/lib/types";
import { MATCH_TYPE_META } from "@/lib/categories";
import { COLLAGE_CELLS } from "./BasketCard";
import { ProductThumb } from "./ProductThumb";
import { PctTicket } from "./Ticket";
import { ToArrow } from "./UnitPrice";
import { Money } from "./Money";
import { RETAILER_LABEL } from "@/lib/affiliate";
import { kitCaution } from "@/lib/buy-list";

/** A brand's kit on the left, the cheaper pieces that replace it on the right. */
export function BundleCard({ bundle }: { bundle: Bundle }) {
  const pieces = bundle.components.slice(0, 4);
  const match = MATCH_TYPE_META[bundle.match_type];
  const caution = kitCaution(bundle);
  return (
    <Link
      href={`/bundle/${bundle.slug}`}
      className="card group flex h-full min-w-0 flex-col p-2.5 transition-colors hover:border-ink-2"
    >
      <div className="grid grid-cols-2 gap-1.5">
        <ProductThumb
          size="tile"
          image={bundle.photo?.src ?? null}
          brand={bundle.bundle.brand}
          alt={bundle.bundle.name}
          category={bundle.category}
        />
        <div className="relative">
          <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-1">
            {pieces.map((c, i) => (
              <div key={c.replaces} className={`min-h-0 min-w-0 ${COLLAGE_CELLS[pieces.length]?.[i] ?? ""}`}>
                <ProductThumb
                  size="fill"
                  quiet
                  image={c.photo?.src ?? null}
                  brand={c.brand}
                  alt={c.product}
                  category={bundle.category}
                  unit={c.unit}
                  sizes="80px"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-medium text-muted">Instead of the {bundle.bundle.brand} kit</p>
          <PctTicket pct={bundle.netSavingsPct ?? bundle.savingsPct} size="sm" grow className="shrink-0" />
        </div>
        <p className="mt-0.5 line-clamp-3 leading-snug font-semibold group-hover:underline" title={bundle.bundle.name}>
          {bundle.bundle.name}
        </p>
        <ul className="mt-1.5 space-y-0.5 text-[13px] text-ink-2">
          {pieces.map((c) => (
            <li key={c.replaces} className="line-clamp-1">
              {withBrand(c.brand, c.product)}
            </li>
          ))}
          {bundle.components.length > 4 && <li className="text-muted">and {bundle.components.length - 4} more</li>}
        </ul>
        <p className="mt-auto flex flex-wrap items-baseline gap-x-1 pt-2.5 leading-none">
          <span className="text-[13px] font-medium text-muted">Kit</span>
          <span className="price text-base leading-none font-semibold text-muted"><Money n={bundle.bundle.price} from={bundle.currency} /></span>
          <ToArrow className="text-muted" />
          <span className="text-[13px] font-medium text-muted">built yourself</span>
          <span className="price text-xl leading-none text-ink"><Money n={bundle.equivalentTotal} from={bundle.currency} /></span>
        </p>
        {caution && (
          <p className="mt-1.5 text-[13px] font-semibold text-different">
            {caution.moreToday > 0 ? "Costs more today than the kit" : "Small saving after delivery"}
          </p>
        )}
        {bundle.netSavings > 0 && (
          <p className={`text-[13px] font-semibold text-same ${caution ? "" : "mt-1.5"}`}>
            Saves <Money n={bundle.netSavings} from={bundle.currency} prose />{" "}
            <span className="font-medium">{bundle.checkout?.delivery === null ? "before unchecked delivery" : "after delivery"}</span>
          </p>
        )}
        <p className="mt-1.5 flex flex-wrap gap-x-2 text-xs font-medium">
          <span className="text-same" title={match.description}>{match.short}</span>
          <span className="text-muted">{storesLine(bundle.sellers)}</span>
        </p>
      </div>
    </Link>
  );
}

function withBrand(brand: string, product: string) {
  return product.toLowerCase().startsWith(brand.toLowerCase()) ? product : `${brand} ${product}`;
}

/** "One order at Target", or "3 stores": a kit is one checkout, so the number of orders matters. */
function storesLine(sellers: readonly string[]) {
  if (sellers.length === 1) {
    const name = RETAILER_LABEL[sellers[0]];
    return name ? `One order at ${name}` : "One store";
  }
  return `${sellers.length} stores`;
}

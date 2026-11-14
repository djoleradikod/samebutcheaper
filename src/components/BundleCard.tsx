import Link from "@/components/CountryLink";
import type { Bundle } from "@/lib/types";
import { MATCH_TYPE_META } from "@/lib/categories";
import { clientT, type ClientT } from "@/lib/i18n/client-dict";
import type { Lang } from "@/lib/i18n/lang";
import { COLLAGE_CELLS } from "./BasketCard";
import { ProductThumb } from "./ProductThumb";
import { PctTicket } from "./Ticket";
import { ToArrow } from "./UnitPrice";
import { Money } from "./Money";
import { RETAILER_LABEL } from "@/lib/affiliate";
import { kitCaution } from "@/lib/buy-list";
import { cards } from "@/lib/i18n/en/client/cards";
import { kits } from "@/lib/i18n/en/client/kits";
import { productName } from "@/lib/i18n/product-name";
import { withVia, type Via } from "@/lib/via";

/** The English this component reads (src/lib/i18n/client-dict.ts). */
const TEXT = { cards, kits };

/** A brand's kit on the left, the cheaper pieces that replace it on the right. */
export function BundleCard({ bundle, lang = "en", via }: { bundle: Bundle; lang?: Lang; via?: Via }) {
  const t = clientT(lang, TEXT);
  const pieces = bundle.components.slice(0, 4);
  const caution = kitCaution(bundle);
  return (
    <Link
      href={via ? withVia(`/bundle/${bundle.slug}`, via) : `/bundle/${bundle.slug}`}
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
          <p className="text-[13px] font-medium text-muted">{t("kits.insteadOf", bundle.bundle.brand)}</p>
          <PctTicket
            pct={bundle.netSavingsPct ?? bundle.savingsPct}
            size="sm"
            grow
            className="shrink-0"
            label={t("cards.cheaperPct", Math.round(bundle.netSavingsPct ?? bundle.savingsPct))}
            german={lang === "de"}
          />
        </div>
        {lang !== "en" && !bundle.de && <p className="mt-0.5 text-xs font-medium text-muted">{t("kits.inEnglish")}</p>}
        <p lang={lang !== "en" && !bundle.de ? "en" : undefined} className="mt-0.5 line-clamp-3 leading-snug font-semibold group-hover:underline" title={bundle.bundle.name}>
          {(lang !== "en" && bundle.de?.name) || bundle.bundle.name}
        </p>
        <ul className="mt-1.5 space-y-0.5 text-[13px] text-ink-2">
          {pieces.map((c) => (
            <li key={c.replaces} lang={lang !== "en" && !bundle.de ? "en" : undefined} className="line-clamp-1">
              {productName(withBrand(c.brand, c.product), bundle.de ? lang : "en")}
            </li>
          ))}
          {bundle.components.length > 4 && <li className="text-muted">{t("kits.andMore", bundle.components.length - 4)}</li>}
        </ul>
        <p className="mt-auto flex flex-wrap items-baseline gap-x-1 pt-2.5 leading-none">
          <span className="text-[13px] font-medium text-muted">{t("kits.kit")}</span>
          <span className="price text-base leading-none font-semibold text-muted"><Money n={bundle.bundle.price} from={bundle.currency} /></span>
          <ToArrow className="text-muted" />
          <span className="text-[13px] font-medium text-muted">{t("kits.builtYourself")}</span>
          <span className="price text-xl leading-none text-ink"><Money n={bundle.equivalentTotal} from={bundle.currency} /></span>
        </p>
        {caution && (
          <p className="mt-1.5 text-[13px] font-semibold text-different">
            {caution.moreToday > 0 ? t("kits.costsMore") : t("kits.smallSaving")}
          </p>
        )}
        {bundle.netSavings > 0 && (
          <p className={`text-[13px] font-semibold text-same ${caution ? "" : "mt-1.5"}`}>
            {t("kits.saves")} <Money n={bundle.netSavings} from={bundle.currency} prose />{" "}
            <span className="font-medium">{bundle.checkout?.delivery === null ? t("kits.beforeDelivery") : t("kits.afterDelivery")}</span>
          </p>
        )}
        <p className="mt-1.5 flex flex-wrap gap-x-2 text-xs font-medium">
          <span className="text-same" title={t("cards.matchDescription", bundle.match_type)}>{lang === "en" ? MATCH_TYPE_META[bundle.match_type].short : t("cards.matchShort", bundle.match_type)}</span>
          <span className="text-muted">{storesLine(bundle.sellers, t)}</span>
        </p>
      </div>
    </Link>
  );
}

function withBrand(brand: string, product: string) {
  return product.toLowerCase().startsWith(brand.toLowerCase()) ? product : `${brand} ${product}`;
}

/** "One order at Target", or "3 stores": a kit is one checkout, so the number of orders matters. */
function storesLine(sellers: readonly string[], t: ClientT<typeof TEXT>) {
  if (sellers.length === 1) {
    const name = RETAILER_LABEL[sellers[0]];
    return name ? t("kits.oneOrderAt", name) : t("kits.oneStore");
  }
  return t("kits.stores", sellers.length);
}

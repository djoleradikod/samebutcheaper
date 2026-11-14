/**
 * A kit or basket page where a store's affiliate terms withhold some of its prices (src/lib/programme-terms.ts). A kit
 * or basket is its totals, and a total built on a withheld price can't be shown, so the page keeps what stands without
 * one: what it is, how close a match it is, the pieces or lines and where they lead, what differs (safety notes live
 * there, so it always shows), how it was checked and its sources. Every piece names its store and links to it; every
 * basket line names both products and its match, and links to its swap, which says the rest.
 */
import Link from "@/components/CountryLink";
import { ExternalLink } from "lucide-react";
import { atStore, linkStoreName, mayEarn } from "@/lib/affiliate";
import { checkedDate } from "@/lib/freshness";
import { getT, type Lang } from "@/lib/i18n";
import { disclosureFor } from "@/lib/programme-terms";
import { kitWithheldStores, basketWithheldStores } from "@/lib/withheld";
import { getPair } from "@/lib/catalog";
import { withVia } from "@/lib/via";
import type { Bundle, Preset, ProductSide } from "@/lib/types";
import { productName } from "@/lib/i18n/product-name";
import { MatchBadge } from "./Badges";
import { SourceList } from "./Evidence";

type Piece = { key: string; name: string; replaces?: string; side: Pick<ProductSide, "retailer" | "url" | "brand">; href: string };

function PieceRow({ piece, b, lang, primary }: { piece: Piece; b: Bundle; lang: Lang; primary: boolean }) {
  const t = getT(lang);
  const w = b.withheld?.[piece.key];
  const earns = mayEarn(piece.side, b.market, b.prices[piece.key]);
  const label = earns ? (disclosureFor(piece.side, b.market) === "paid-link" ? t("terms.paidLink") : t("swap.adLabel", b.market)) : undefined;
  return (
    <li className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center">
      <div className="min-w-0">
        <p className={`text-[15px] leading-snug ${primary ? "font-semibold" : "font-medium"}`}>{piece.name}</p>
        {piece.replaces && <p className="text-[13px] text-ink-2">{t("terms.replaces", piece.replaces)}</p>}
        <p className="text-[13px] font-medium text-muted">
          {w ? `${t("terms.seePrice", linkStoreName(piece.side))}. ${t("terms.lastChecked", checkedDate(w.date, w.precision, lang))}` : linkStoreName(piece.side)}
        </p>
      </div>
      <div>
        <a href={piece.href} target="_blank" rel="sponsored nofollow noopener" className={`btn w-full text-center ${primary ? "btn-primary" : "btn-ghost"}`}>
          {piece.side.retailer === "other" ? t("swap.seeItOnline") : t("swap.seeItAt", atStore(piece.side.retailer, piece.side.url, lang))}
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
        </a>
        {label && <span className="mt-0.5 block text-center text-[11px] font-medium text-muted">{label}</span>}
      </div>
    </li>
  );
}

/** The body of a kit page whose prices are withheld. `b` is the kit as the page reads it (localised text). */
export function WithheldKit({ b, lang }: { b: Bundle; lang: Lang }) {
  const t = getT(lang);
  const kit: Piece = { key: "kit", name: b.bundle.name, side: b.bundle, href: `/go/${b.slug}/brand` };
  const pieces: Piece[] = b.components.map((c, i) => ({
    key: `item-${c.replaces}`,
    name: c.product.toLowerCase().startsWith(c.brand.toLowerCase()) ? c.product : `${c.brand} ${c.product}`,
    replaces: b.bundle.items[c.replaces]?.name,
    side: c,
    href: `/go/${b.slug}/item-${i}`,
  }));
  return (
    <div className="container-page grid gap-8 py-6 md:py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <p className="max-w-[68ch] text-[15px] text-ink-2">{t("terms.kit", kitWithheldStores(b, lang))}</p>
        <p className="text-[15px]">
          <span className="text-ink-2">{t("kitPage.match")}: </span>
          <MatchBadge type={b.match_type} long lang={lang} />
        </p>
        <section>
          <h2 className="display text-xl md:text-2xl">{t("terms.theKit")}</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            <PieceRow piece={kit} b={b} lang={lang} primary={false} />
          </ul>
        </section>
        <section>
          <h2 className="display text-xl md:text-2xl">{t("terms.thePieces")}</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {pieces.map((p) => (
              <PieceRow key={p.key} piece={p} b={b} lang={lang} primary />
            ))}
          </ul>
        </section>
        {b.differences && (
          <section className="rounded-card border border-different/30 bg-different-soft p-4 md:p-5">
            <h2 className="display text-xl md:text-2xl">{t("kitPage.differs")}</h2>
            <p className="mt-2 max-w-[68ch] text-[15px] text-ink-2">{b.differences}</p>
          </section>
        )}
        <section>
          <h2 className="display text-xl md:text-2xl">{t("kitPage.howChecked")}</h2>
          <p className="mt-2 max-w-[68ch] text-[15px] text-ink-2">{b.evidence}</p>
        </section>
        <SourceList sources={b.sources} lang={lang} />
      </div>
    </div>
  );
}

/** The lines of a basket whose prices are withheld, each leading to its swap. */
export function WithheldBasket({ p, lang, notes = {} }: { p: Preset; lang: Lang; notes?: Record<string, string> }) {
  const t = getT(lang);
  return (
    <section className="container-page pt-6 md:pt-8">
      <p className="max-w-[62ch] text-[15px] text-ink-2">{t("terms.basket", basketWithheldStores(p, getPair, lang))}</p>
      <h2 className="display mt-4 text-xl md:text-2xl">{t("basketPage.whatsInIt")}</h2>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {p.lines.map((l) => {
          const pair = getPair(l.pair);
          const named = (brand: string, product?: string) => {
            const name = product ? productName(product, lang) : "";
            return !name ? brand : name.toLowerCase().startsWith(brand.toLowerCase()) ? name : `${brand} ${name}`;
          };
          return (
            <li key={l.pair} className="py-2.5">
              <Link href={withVia(`/compare/${l.pair}`, "basket")} className="inline-flex min-h-11 flex-col justify-center text-[15px] leading-snug hover:underline">
                <span className="font-semibold">{named(l.altName, pair?.alternative.product)}</span>
                <span className="text-[13px] text-ink-2">{t("terms.insteadOf", named(l.brandName, pair?.brand.product))}</span>
              </Link>
              {pair && (
                <p>
                  <MatchBadge type={pair.match_type} lang={lang} />
                </p>
              )}
              {notes[l.pair] && <p className="max-w-[62ch] text-[13px] text-ink-2">{notes[l.pair]}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

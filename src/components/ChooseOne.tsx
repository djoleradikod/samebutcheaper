"use client";

import { Check, X } from "lucide-react";
import type { ResultLine, SwapView } from "@/lib/receipt/types";
import { useT } from "@/lib/i18n/client";
import { pageShoppingCheck } from "@/lib/i18n/en/pages/shoppingCheck";
import { rich } from "@/lib/i18n/rich";
import { Money } from "./Money";

/** The English this component reads; German is loaded on /de (src/lib/i18n/client-dict.ts). */
const TEXT = { pageShoppingCheck };
const german = () => import("@/lib/i18n/de/pages/shoppingCheck");

export type ChooseLine = Extract<ResultLine, { status: "choose" }>;

/** The key a "which one" answer is kept under, beside the "did you mean" answers (which are keyed by slug). */
export const chooseKey = (line: { index: number }) => `#${line.index}`;

/**
 * Lines that name a brand with several products on file that fit what the line says. The shopper picks the one they
 * buy, or says none of these; nothing is counted until they do.
 */
export function ChooseSection({
  lines,
  swaps,
  onPick,
}: {
  lines: ChooseLine[];
  swaps: Record<string, SwapView>;
  /** The slug picked, or false for none of these. */
  onPick: (line: ChooseLine, pick: string | false) => void;
}) {
  const t = useT(TEXT, german);
  if (!lines.length) return null;
  return (
    <section aria-labelledby="choose-heading" className="print:hidden">
      <h2 id="choose-heading" className="display text-xl md:text-2xl">
        {t("pageShoppingCheck.chooseTitle")}
      </h2>
      <p className="mt-1 max-w-[70ch] text-[13px] text-ink-2 md:text-sm">{t("pageShoppingCheck.chooseNote")}</p>
      <ul className="mt-3 space-y-3">
        {lines.map((l) => {
          const options = l.slugs.filter((slug) => swaps[slug]);
          return (
            <li key={l.index} className="card p-3">
              <p className="font-mono text-[13px] text-muted">{l.text}</p>
              <ul className="mt-2 divide-y divide-line" aria-label={t("pageShoppingCheck.chooseFits", l.text)}>
                {options.map((slug) => {
                  const swap = swaps[slug];
                  return (
                    <li key={slug} className="flex flex-col gap-2 py-2 md:flex-row md:items-center md:gap-4">
                      <p className="min-w-0 flex-1 text-[15px] leading-snug font-semibold">
                        {swap.fromProduct}
                        <span className="font-normal text-ink-2">
                          {" "}
                          {rich(t("pageShoppingCheck.couldBe", swap.to), { amount: <Money n={swap.savings} from={swap.currency} prose /> })}
                        </span>
                      </p>
                      <button
                        type="button"
                        className="btn btn-ghost min-h-11 shrink-0"
                        onClick={() => onPick(l, slug)}
                        aria-label={t("pageShoppingCheck.chooseIBuy", swap.fromProduct)}
                      >
                        <Check className="h-4 w-4" aria-hidden="true" /> {t("pageShoppingCheck.chooseThis")}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="btn btn-ghost mt-1 min-h-11" onClick={() => onPick(l, false)}>
                <X className="h-4 w-4" aria-hidden="true" /> {t("pageShoppingCheck.chooseNone")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

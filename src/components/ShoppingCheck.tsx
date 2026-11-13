"use client";

import Link from "@/components/CountryLink";
import { useRef, useState } from "react";
import { Check, Copy, ImageUp, ListPlus, Loader2, Printer, X } from "lucide-react";
import { useLocal } from "@/lib/client/country";
import { setBuyingOften, useBuyingOften } from "@/lib/client/buyingOften";
import { shrinkImage } from "@/lib/client/photo";
import { setSavedList, useSavedList } from "@/lib/client/savedList";
import { MAX_TEXT } from "@/lib/receipt/parse";
import { countSwap, shareValue, type Counted, type Shared } from "@/lib/receipt/total";
import type { CheckResult, ResultLine, SwapView } from "@/lib/receipt/types";
import { totalText, type FrequencyId } from "@/lib/yearly";
import { MatchBadge } from "./Badges";
import { FrequencySelect } from "./FrequencySelect";
import { Money } from "./Money";
import { ProductThumb } from "./ProductThumb";
import { Ticket } from "./Ticket";
import { ToArrow } from "./UnitPrice";
import { useLang, useT } from "@/lib/i18n/client";
import type { ClientT } from "@/lib/i18n/client-dict";
import { pageShoppingCheck } from "@/lib/i18n/en/pages/shoppingCheck";
import { yearly as yearlyText } from "@/lib/i18n/en/client/yearly";
import { rich } from "@/lib/i18n/rich";

/** The English this file reads (src/lib/i18n/client-dict.ts); the German loads on German pages only. */
const TEXT = { pageShoppingCheck, yearly: yearlyText };
const german = () => import("@/lib/i18n/de/pages/shoppingCheck");
const useCheckT = (): ClientT<typeof TEXT> => useT(TEXT, german);

type Status = { kind: "idle" } | { kind: "busy"; text: string } | { kind: "error"; text: string };

/** A list to try, from the shopper's own market, so the example finds swaps they can buy. */
const EXAMPLES: Record<"US" | "GB" | "DE", string> = {
  US: ["TYLENOL EX STR CPLT 500MG 225CT   13.97 X", "HEINZ KETCHUP 38OZ   4.48", "JIF CREAMY PB 16OZ  2.98", "CERAVE MOIST CREAM 16OZ  17.97", "BANANAS 2.27 LB @ 0.58/LB", "GV 2% MILK GAL  3.12", "SUBTOTAL  45.02", "TAX 1  2.81"].join("\n"),
  GB: ["NUROFEN 200MG 16S          £2.00", "HEINZ TOM KETCHUP 460G     £3.00", "FAIRY ORIGINAL W/UP 320ML  £1.25", "PG TIPS 80S                £3.50", "WARBURTONS TOASTIE 800G    £1.65", "Clubcard Price Saving     -£0.50", "TOTAL                     £10.90"].join("\n"),
  DE: ["NUROFEN 400MG 24ST      7,95 A", "PERSIL COLOR GEL 20WL   4,95 A", "BARILLA FUSILLI 500G    1,79 A", "COCA-COLA 1,25L         1,49 A", "PFAND                   0,25 A", "SUMME EUR              16,43", "Kartenzahlung girocard"].join("\n"),
};

export type SharedStart = { swaps: Record<string, SwapView>; items: Shared[]; hidden: number };

export function ShoppingCheck({ photo, shared }: { photo: boolean; shared: SharedStart | null }) {
  const local = useLocal();
  const t = useCheckT();
  // A German page asks in German and for the country it shows (/de is Germany), whatever the shopper's cookie says.
  const ask = useLang() === "de" ? "?lang=de&country=DE" : "";
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [result, setResult] = useState<CheckResult | null>(() =>
    shared?.items.length
      ? { lines: shared.items.map((s, index) => ({ index, text: "", status: "swap", slug: s.slug, others: 0 })), noise: 0, swaps: shared.swaps }
      : null,
  );
  const [sharedOften] = useState<Record<string, FrequencyId | null>>(() => Object.fromEntries((shared?.items ?? []).map((s) => [s.slug, s.often])));
  /** "Did you mean" answers: true for yes, false for no. Kept for this page view only. */
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const resultRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const busy = status.kind === "busy";
  const example = EXAMPLES[local.listMarket === "US" || local.listMarket === "CA" ? "US" : local.listMarket === "DE" ? "DE" : "GB"];

  async function check(list: string) {
    if (!list.trim()) {
      setStatus({ kind: "error", text: t("pageShoppingCheck.emptyList") });
      return;
    }
    setStatus({ kind: "busy", text: t("pageShoppingCheck.checking") });
    try {
      const res = await fetch(`/check/list/match${ask}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: list.slice(0, MAX_TEXT) }),
      });
      const json = (await res.json().catch(() => null)) as ({ ok: boolean; error?: string } & Partial<CheckResult>) | null;
      if (!json?.ok || !json.lines || !json.swaps) {
        setStatus({ kind: "error", text: json?.error ?? t("pageShoppingCheck.failed") });
        return;
      }
      setAnswers({});
      setResult({ lines: json.lines, noise: json.noise ?? 0, swaps: json.swaps });
      setStatus({ kind: "idle" });
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch {
      setStatus({ kind: "error", text: t("pageShoppingCheck.unreachable") });
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setStatus({ kind: "busy", text: t("pageShoppingCheck.reading") });
      const body = new FormData();
      body.append("image", await shrinkImage(file, 2000), "receipt.jpg");
      const res = await fetch(`/check/list/photo${ask ? "?lang=de" : ""}`, { method: "POST", body });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; lines?: string[] } | null;
      if (!json?.ok || !json.lines?.length) {
        setStatus({ kind: "error", text: json?.error ?? t("pageShoppingCheck.unreadable") });
        return;
      }
      const list = json.lines.join("\n");
      setText(list);
      await check(list);
    } catch {
      setStatus({ kind: "error", text: t("pageShoppingCheck.photoWrong") });
    } finally {
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  return (
    <div>
      <form
        className="card max-w-3xl p-4 print:hidden md:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void check(text);
        }}
      >
        <label htmlFor="shopping-list" className="text-[15px] font-semibold">
          {t("pageShoppingCheck.label")}
        </label>
        <p id="shopping-list-help" className="mt-0.5 text-[13px] text-ink-2">
          {t("pageShoppingCheck.help")}
        </p>
        <textarea
          id="shopping-list"
          aria-describedby="shopping-list-help shopping-list-privacy"
          value={text}
          maxLength={MAX_TEXT}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={example}
          className="mt-2 block w-full resize-y rounded-tile border border-line-strong bg-paper p-3 font-mono text-[15px] leading-relaxed placeholder:text-muted focus:border-cobalt focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary min-h-11" disabled={busy}>
            {t("pageShoppingCheck.submit")}
          </button>
          {photo && (
            <>
              <button type="button" className="btn btn-ghost min-h-11" disabled={busy} onClick={() => uploadRef.current?.click()}>
                <ImageUp className="h-4 w-4" aria-hidden="true" /> {t("pageShoppingCheck.readPhoto")}
              </button>
              <input
                ref={uploadRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
            </>
          )}
          {!text && (
            <button
              type="button"
              className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-cobalt underline underline-offset-2"
              onClick={() => {
                setText(example);
                void check(example);
              }}
            >
              {t("pageShoppingCheck.tryExample")}
            </button>
          )}
        </div>
        <p className="mt-2 min-h-5 text-sm" role="status" aria-live="polite">
          {status.kind === "busy" && (
            <span className="inline-flex items-center gap-2 text-ink-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {status.text}
            </span>
          )}
          {status.kind === "error" && <span className="text-different">{status.text}</span>}
        </p>
        <p id="shopping-list-privacy" className="text-[13px] text-muted">
          {t("pageShoppingCheck.privacy", photo)}
        </p>
      </form>

      {result && (
        <div ref={resultRef} tabIndex={-1} className="mt-6 outline-none md:mt-8">
          <Result result={result} answers={answers} setAnswers={setAnswers} sharedOften={sharedOften} viewingShared={Boolean(shared) && !text} />
        </div>
      )}
      {shared && shared.hidden > 0 && !text && (
        <p className="mt-3 text-[13px] text-ink-2">
          {t("pageShoppingCheck.hiddenShared", shared.hidden)}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------

type Matched = Extract<ResultLine, { status: "swap" | "maybe" }>;
type Line = { line: Matched; swap: SwapView; counted: Counted };

function Result({
  result,
  answers,
  setAnswers,
  sharedOften,
  viewingShared,
}: {
  result: CheckResult;
  answers: Record<string, boolean>;
  setAnswers: (next: Record<string, boolean>) => void;
  sharedOften: Record<string, FrequencyId | null>;
  viewingShared: boolean;
}) {
  const choices = useBuyingOften();
  const saved = useSavedList();
  const local = useLocal();
  const t = useCheckT();
  const lang = useLang();
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const [savedAll, setSavedAll] = useState(false);

  const withSwap = (l: ResultLine): l is Matched => (l.status === "swap" || l.status === "maybe") && Boolean(result.swaps[l.slug]);
  const swaps: Line[] = result.lines
    .filter(withSwap)
    .filter((l) => l.status === "swap" || answers[l.slug] === true)
    .map((l) => ({ line: l, swap: result.swaps[l.slug], counted: countSwap(result.swaps[l.slug], choices, sharedOften[l.slug]) }));
  const maybes = result.lines.filter(withSwap).filter((l) => l.status === "maybe" && answers[l.slug] === undefined);
  const misses = result.lines.filter((l) => l.status === "none" || (withSwap(l) && l.status === "maybe" && answers[l.slug] === false));
  const own = result.lines.filter((l) => l.status === "own").length;
  const example = misses.find((l) => l.counted)?.counted ?? null;

  const yearly = swaps.filter((s): s is Line & { counted: Extract<Counted, { how: "yearly" }> } => s.counted.how === "yearly");
  const once = swaps.filter((s): s is Line & { counted: Extract<Counted, { how: "once" }> } => s.counted.how === "once");
  const perAmount = swaps.filter((s) => s.counted.how === "per-amount").length;
  const assumed = yearly.filter((s) => !s.counted.chosen);
  const amounts = (list: { counted: { amount: number }; swap: SwapView }[]) => list.map((s) => ({ amount: s.counted.amount, currency: s.swap.currency }));

  const shareItems = swaps.map((s) => ({ slug: s.swap.slug, often: s.counted.how === "yearly" && s.counted.chosen ? s.counted.often : null }));
  const shareUrl = () => `${window.location.origin}${lang === "de" ? "/de" : ""}/check/list?s=${shareValue(shareItems)}`;

  const copyLink = () => {
    const url = shareUrl();
    if (!navigator.clipboard) {
      setCopied("failed");
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => setCopied("copied"),
      () => setCopied("failed"),
    );
  };

  const saveAll = () => {
    setSavedList([...saved, ...swaps.map((s) => s.swap.slug)]);
    // A frequency that came with a shared list becomes the shopper's own once they save it.
    for (const s of swaps) {
      const often = sharedOften[s.swap.slug];
      if (often && !choices.swaps[s.swap.slug]) setBuyingOften(s.swap.slug, often);
    }
    setSavedAll(true);
  };

  const notes: string[] = [];
  if (assumed.length) {
    notes.push(t("pageShoppingCheck.assumes", assumed.length, yearly.length, t(`yearly.frequencies.${assumed[0].counted.often}`)));
  } else if (yearly.length) {
    notes.push(t("pageShoppingCheck.chosen"));
  }
  if (once.length && yearly.length) notes.push(t("pageShoppingCheck.plusOnce", totalText(amounts(once), local), once.length));
  if (perAmount) notes.push(t("pageShoppingCheck.perAmount", perAmount));

  return (
    <div className="space-y-6 md:space-y-8">
      <style>{"@media print { body > header, body > nav, body > footer, .band-slot { display: none !important; } main { padding: 0 !important; } }"}</style>
      <section aria-labelledby="keep-heading" className="card p-4 md:p-5">
        <h2 id="keep-heading" className="sr-only">
          {t("pageShoppingCheck.keepHeading")}
        </h2>
        {yearly.length ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg font-semibold md:text-xl">
            {t("pageShoppingCheck.switchingThese", yearly.length)}
            <Ticket size="lg" className="whitespace-normal!">
              {t("pageShoppingCheck.perYear", totalText(amounts(yearly), local))}
            </Ticket>
          </p>
        ) : once.length ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg font-semibold md:text-xl">
            {t("pageShoppingCheck.switching")}
            <Ticket size="lg" className="whitespace-normal!">
              {t("pageShoppingCheck.onceAmount", totalText(amounts(once), local))}
            </Ticket>
          </p>
        ) : (
          <p className="text-lg font-semibold md:text-xl">
            {maybes.length ? t("pageShoppingCheck.checkSuggestions") : t("pageShoppingCheck.nothingFound")}
          </p>
        )}
        {notes.length > 0 && <p className="mt-3 max-w-[70ch] text-[13px] leading-snug text-ink-2 md:text-sm">{notes.join(" ")}</p>}
        {swaps.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            {savedAll ? (
              <Link href="/my-list" className="btn btn-primary min-h-11">
                <Check className="h-4 w-4" aria-hidden="true" /> {t("pageShoppingCheck.savedSee")}
              </Link>
            ) : (
              <button type="button" onClick={saveAll} className="btn btn-primary min-h-11">
                <ListPlus className="h-4 w-4" aria-hidden="true" /> {t("pageShoppingCheck.saveAll")}
              </button>
            )}
            <button type="button" onClick={copyLink} className="btn btn-ghost min-h-11">
              {copied === "copied" ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied === "copied" ? t("pageShoppingCheck.linkCopied") : t("pageShoppingCheck.copyLink")}
            </button>
            <button type="button" onClick={() => window.print()} className="btn btn-ghost min-h-11">
              <Printer className="h-4 w-4" aria-hidden="true" /> {t("pageShoppingCheck.print")}
            </button>
          </div>
        )}
        {copied === "failed" && (
          <p className="mt-2 text-[13px] text-ink-2 print:hidden">
            {t("pageShoppingCheck.copyThis")} <span className="break-all select-all">{shareUrl()}</span>
          </p>
        )}
        {swaps.length > 0 && (
          <p className="mt-2 text-[13px] text-muted print:hidden">{t("pageShoppingCheck.linkHolds")}</p>
        )}
      </section>

      {swaps.length > 0 && (
        <section aria-labelledby="swaps-heading">
          <h2 id="swaps-heading" className="display text-xl md:text-2xl">
            {t("pageShoppingCheck.swapsFor", swaps.length)}
          </h2>
          <ul className="card mt-3 divide-y divide-line">
            {swaps.map((s) => (
              <SwapRow key={s.swap.slug} item={s} viewingShared={viewingShared} />
            ))}
          </ul>
        </section>
      )}

      {maybes.length > 0 && (
        <section aria-labelledby="maybe-heading" className="print:hidden">
          <h2 id="maybe-heading" className="display text-xl md:text-2xl">
            {t("pageShoppingCheck.didYouMean")}
          </h2>
          <p className="mt-1 max-w-[70ch] text-[13px] text-ink-2 md:text-sm">{t("pageShoppingCheck.didYouMeanNote")}</p>
          <ul className="card mt-3 divide-y divide-line">
            {maybes.map((l) => {
              const swap = result.swaps[l.slug];
              return (
                <li key={`${l.index}-${l.slug}`} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[13px] text-muted">{l.text}</p>
                    <p className="text-[15px] leading-snug font-semibold">
                      {swap.fromProduct}
                      <span className="font-normal text-ink-2">
                        {" "}
                        {rich(t("pageShoppingCheck.couldBe", swap.to), { amount: <Money n={swap.savings} from={swap.currency} prose /> })}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="btn btn-primary min-h-11"
                      onClick={() => setAnswers({ ...answers, [l.slug]: true })}
                      aria-label={t("pageShoppingCheck.yesIBuy", swap.fromProduct)}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" /> {t("pageShoppingCheck.yesThatsIt")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost min-h-11"
                      onClick={() => {
                        setAnswers({ ...answers, [l.slug]: false });
                        // We read the brand but don't have the product they buy: count it as wanted, like a line we had nothing for.
                        if (l.counted) countNo(l.counted);
                      }}
                      aria-label={t("pageShoppingCheck.notThis", swap.fromProduct)}
                    >
                      <X className="h-4 w-4" aria-hidden="true" /> {t("pageShoppingCheck.no")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {misses.length > 0 && (
        <section aria-labelledby="miss-heading">
          <h2 id="miss-heading" className="display text-xl md:text-2xl">
            {t("pageShoppingCheck.nothingCheaper")}
          </h2>
          <ul className="mt-2 grid gap-x-6 gap-y-1 text-[15px] text-ink-2 sm:grid-cols-2">
            {misses.map((l) => (
              <li key={l.index} className="font-mono text-[13px]">
                {l.text}
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-[70ch] text-[13px] text-ink-2 print:hidden">
            {example ? t("pageShoppingCheck.countNote", example) : ""}
            {t("pageShoppingCheck.wantSooner")}{" "}
            <Link href="/suggest" className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-0">
              {t("pageShoppingCheck.suggestIt")}
            </Link>
            .
          </p>
        </section>
      )}

      {(own > 0 || result.noise > 0) && (
        <p className="text-[13px] text-muted">
          {[
            own ? t("pageShoppingCheck.own", own) : "",
            result.noise ? t("pageShoppingCheck.skipped", result.noise) : "",
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}
    </div>
  );
}

function SwapRow({ item, viewingShared }: { item: Line; viewingShared: boolean }) {
  const { swap: s, counted, line } = item;
  const t = useCheckT();
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 p-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-x-4">
      <div className="flex gap-1">
        <ProductThumb size="xs" image={s.fromPhoto} brand={s.from} alt={s.fromProduct} className="md:h-16 md:w-16" sizes="(min-width: 768px) 64px, 44px" />
        <ProductThumb size="xs" image={s.toPhoto} brand={s.to} alt={s.toProduct} className="md:h-16 md:w-16" sizes="(min-width: 768px) 64px, 44px" />
      </div>
      <div className="min-w-0">
        {!viewingShared && line.text && <p className="truncate font-mono text-[12px] text-muted">{line.text}</p>}
        <p className="text-[15px] leading-snug font-semibold">
          <Link href={s.href} className="hover:underline">
            {s.fromProduct}
            <ToArrow />
            {s.toProduct}
          </Link>
        </p>
        {/* No dots between the parts: when a part wraps, a dot was left hanging at the end of the line above. */}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-2">
          <MatchBadge type={s.match} />
          <span>
            {rich(t("pageShoppingCheck.lessPer", s.yearly?.pack ?? null, s.savingsPct), { amount: <Money n={s.savings} from={s.currency} prose /> })}
          </span>
          {line.others > 0 && (
            <Link href={s.href} className="font-medium text-cobalt underline underline-offset-2 print:hidden">
              {t("pageShoppingCheck.moreOptions", line.others)}
            </Link>
          )}
        </p>
        {counted.how === "yearly" && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-medium text-ink-2">{t("pageShoppingCheck.youBuyIt")}</span>
            <FrequencySelect value={counted.often} onChange={(next) => setBuyingOften(s.slug, next)} label={t("pageShoppingCheck.howOften", s.fromProduct)} />
            {!counted.chosen && <span className="text-[13px] text-muted">{t("pageShoppingCheck.assumed")}</span>}
          </div>
        )}
      </div>
      <div className="col-start-2 md:col-start-3 md:text-right">
        <LineFigure counted={counted} swap={s} />
      </div>
    </li>
  );
}

function LineFigure({ counted, swap }: { counted: Counted; swap: SwapView }) {
  const t = useCheckT();
  if (counted.how === "per-amount") {
    return <p className="text-[13px] text-ink-2">{t("pageShoppingCheck.noYearly", swap.yearly?.per ?? null)}</p>;
  }
  return (
    <p>
      <span className="price text-[1.375rem] text-ink tabular-nums">
        <Money n={counted.amount} from={swap.currency} />
      </span>
      <span className="ml-1.5 text-xs font-medium text-ink-2 md:ml-0 md:block">{counted.how === "yearly" ? t("pageShoppingCheck.aYear") : t("pageShoppingCheck.once")}</span>
    </p>
  );
}

/** Counts a "did you mean" answered No in the most-wanted log. Best effort: the answer stands whatever happens. */
function countNo(name: string) {
  void fetch("/api/wanted", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: name, source: "check" }),
    keepalive: true,
  }).catch(() => {});
}

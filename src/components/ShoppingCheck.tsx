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
import { frequencyLabel, totalText, type FrequencyId } from "@/lib/yearly";
import { MatchBadge } from "./Badges";
import { FrequencySelect } from "./FrequencySelect";
import { Money } from "./Money";
import { ProductThumb } from "./ProductThumb";
import { Ticket } from "./Ticket";
import { ToArrow } from "./UnitPrice";

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
      setStatus({ kind: "error", text: "Paste a list or a receipt first." });
      return;
    }
    setStatus({ kind: "busy", text: "Checking your list against the catalogue…" });
    try {
      const res = await fetch("/check/list/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: list.slice(0, MAX_TEXT) }),
      });
      const json = (await res.json().catch(() => null)) as ({ ok: boolean; error?: string } & Partial<CheckResult>) | null;
      if (!json?.ok || !json.lines || !json.swaps) {
        setStatus({ kind: "error", text: json?.error ?? "That didn't work. Try again in a moment." });
        return;
      }
      setAnswers({});
      setResult({ lines: json.lines, noise: json.noise ?? 0, swaps: json.swaps });
      setStatus({ kind: "idle" });
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch {
      setStatus({ kind: "error", text: "We couldn't reach the site. Check your connection and try again." });
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setStatus({ kind: "busy", text: "Reading your receipt…" });
      const body = new FormData();
      body.append("image", await shrinkImage(file, 2000), "receipt.jpg");
      const res = await fetch("/check/list/photo", { method: "POST", body });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; lines?: string[] } | null;
      if (!json?.ok || !json.lines?.length) {
        setStatus({ kind: "error", text: json?.error ?? "We couldn't read that photo. Try typing the list instead." });
        return;
      }
      const list = json.lines.join("\n");
      setText(list);
      await check(list);
    } catch {
      setStatus({ kind: "error", text: "Something went wrong with that photo. Try again, or type the list." });
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
          Your shopping list or receipt
        </label>
        <p id="shopping-list-help" className="mt-0.5 text-[13px] text-ink-2">
          One item per line, as you&apos;d write it or as the till printed it. Prices, totals and loyalty lines are skipped.
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
            Check my shopping
          </button>
          {photo && (
            <>
              <button type="button" className="btn btn-ghost min-h-11" disabled={busy} onClick={() => uploadRef.current?.click()}>
                <ImageUp className="h-4 w-4" aria-hidden="true" /> Read a receipt photo
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
              Try an example
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
          We read your list{photo ? " or photo" : ""} only to match it and don&apos;t keep it; we count just the names of products we have no
          swap for, never prices, so we know what to research next.
        </p>
      </form>

      {result && (
        <div ref={resultRef} tabIndex={-1} className="mt-6 outline-none md:mt-8">
          <Result result={result} answers={answers} setAnswers={setAnswers} sharedOften={sharedOften} viewingShared={Boolean(shared) && !text} />
        </div>
      )}
      {shared && shared.hidden > 0 && !text && (
        <p className="mt-3 text-[13px] text-ink-2">
          {shared.hidden === 1 ? "One swap" : `${shared.hidden} swaps`} on the shared list {shared.hidden === 1 ? "isn't" : "aren't"} sold where
          you are, so {shared.hidden === 1 ? "it's" : "they're"} left out.
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
  const shareUrl = () => `${window.location.origin}/check/list?s=${shareValue(shareItems)}`;

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
    const which =
      assumed.length === yearly.length
        ? yearly.length === 1
          ? "This assumes you buy the brand-name pack"
          : "This assumes you buy each brand-name pack"
        : `For ${assumed.length} of the ${yearly.length} swaps, this assumes you buy the brand-name pack`;
    notes.push(`${which} ${frequencyLabel(assumed[0].counted.often)}. We can't know, so set how often below.`);
  } else if (yearly.length) {
    notes.push("At how often you said you buy each brand-name pack, at the dated prices on each swap page.");
  }
  if (once.length && yearly.length) notes.push(`Plus ${totalText(amounts(once), local)} once, from ${once.length === 1 ? "a thing you buy once" : `${once.length} things you buy once`}.`);
  if (perAmount) notes.push(`${perAmount === 1 ? "One swap is" : `${perAmount} swaps are`} priced per wash or per amount, with no pack to count, so ${perAmount === 1 ? "it isn't" : "they aren't"} in it.`);

  return (
    <div className="space-y-6 md:space-y-8">
      <style>{"@media print { body > header, body > nav, body > footer, .band-slot { display: none !important; } main { padding: 0 !important; } }"}</style>
      <section aria-labelledby="keep-heading" className="card p-4 md:p-5">
        <h2 id="keep-heading" className="sr-only">
          What you&apos;d keep
        </h2>
        {yearly.length ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg font-semibold md:text-xl">
            Switching {yearly.length === 1 ? "this" : `these ${yearly.length}`} would keep
            <Ticket size="lg" className="whitespace-normal!">
              {totalText(amounts(yearly), local)} a year
            </Ticket>
          </p>
        ) : once.length ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg font-semibold md:text-xl">
            Switching would keep
            <Ticket size="lg" className="whitespace-normal!">
              {totalText(amounts(once), local)} once
            </Ticket>
          </p>
        ) : (
          <p className="text-lg font-semibold md:text-xl">
            {maybes.length ? "Check the suggestions below to see what you'd keep." : "We didn't find anything on your list with a cheaper swap on file yet."}
          </p>
        )}
        {notes.length > 0 && <p className="mt-3 max-w-[70ch] text-[13px] leading-snug text-ink-2 md:text-sm">{notes.join(" ")}</p>}
        {swaps.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            {savedAll ? (
              <Link href="/my-list" className="btn btn-primary min-h-11">
                <Check className="h-4 w-4" aria-hidden="true" /> Saved. See my list
              </Link>
            ) : (
              <button type="button" onClick={saveAll} className="btn btn-primary min-h-11">
                <ListPlus className="h-4 w-4" aria-hidden="true" /> Save all to my list
              </button>
            )}
            <button type="button" onClick={copyLink} className="btn btn-ghost min-h-11">
              {copied === "copied" ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied === "copied" ? "Link copied" : "Copy a link to this result"}
            </button>
            <button type="button" onClick={() => window.print()} className="btn btn-ghost min-h-11">
              <Printer className="h-4 w-4" aria-hidden="true" /> Print
            </button>
          </div>
        )}
        {copied === "failed" && (
          <p className="mt-2 text-[13px] text-ink-2 print:hidden">
            Copy this link: <span className="break-all select-all">{shareUrl()}</span>
          </p>
        )}
        {swaps.length > 0 && (
          <p className="mt-2 text-[13px] text-muted print:hidden">The link holds only the swaps and how often you buy each, not your list.</p>
        )}
      </section>

      {swaps.length > 0 && (
        <section aria-labelledby="swaps-heading">
          <h2 id="swaps-heading" className="display text-xl md:text-2xl">
            {swaps.length === 1 ? "One swap" : `${swaps.length} swaps`} for what you buy
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
            Did you mean?
          </h2>
          <p className="mt-1 max-w-[70ch] text-[13px] text-ink-2 md:text-sm">
            These lines name a brand we have, but we can&apos;t tell which product. Say yes only if it&apos;s what you buy.
          </p>
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
                        could be {swap.to}, <Money n={swap.savings} from={swap.currency} prose /> less a pack
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="btn btn-primary min-h-11"
                      onClick={() => setAnswers({ ...answers, [l.slug]: true })}
                      aria-label={`Yes, I buy ${swap.fromProduct}`}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" /> Yes, that&apos;s it
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost min-h-11"
                      onClick={() => {
                        setAnswers({ ...answers, [l.slug]: false });
                        // We read the brand but don't have the product they buy: count it as wanted, like a line we had nothing for.
                        if (l.counted) countNo(l.counted);
                      }}
                      aria-label={`No, not ${swap.fromProduct}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" /> No
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
            Nothing cheaper on file yet
          </h2>
          <ul className="mt-2 grid gap-x-6 gap-y-1 text-[15px] text-ink-2 sm:grid-cols-2">
            {misses.map((l) => (
              <li key={l.index} className="font-mono text-[13px]">
                {l.text}
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-[70ch] text-[13px] text-ink-2 print:hidden">
            {example ? `We count the products we had nothing for by their cleaned name alone, such as “${example}”, so the most asked-for get researched first. ` : ""}
            Want one sooner?{" "}
            <Link href="/suggest" className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-0">
              Suggest it
            </Link>
            .
          </p>
        </section>
      )}

      {(own > 0 || result.noise > 0) && (
        <p className="text-[13px] text-muted">
          {[
            own ? `${own === 1 ? "One line is" : `${own} lines are`} already a store brand or a cheaper pick we list.` : "",
            result.noise ? `We skipped ${result.noise === 1 ? "one line" : `${result.noise} lines`} that weren't products, such as totals, payments and loyalty points.` : "",
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
            <Money n={s.savings} from={s.currency} prose /> less per {s.yearly?.pack ?? "pack"}, {Math.round(s.savingsPct)}% cheaper
          </span>
          {line.others > 0 && (
            <Link href={s.href} className="font-medium text-cobalt underline underline-offset-2 print:hidden">
              {line.others === 1 ? "1 more option" : `${line.others} more options`}
            </Link>
          )}
        </p>
        {counted.how === "yearly" && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-medium text-ink-2">You buy it</span>
            <FrequencySelect value={counted.often} onChange={(next) => setBuyingOften(s.slug, next)} label={`How often you buy ${s.fromProduct}`} />
            {!counted.chosen && <span className="text-[13px] text-muted">Assumed</span>}
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
  if (counted.how === "per-amount") {
    return <p className="text-[13px] text-ink-2">Priced {swap.yearly?.per ?? "per amount"}, no yearly figure</p>;
  }
  return (
    <p>
      <span className="price text-[1.375rem] text-ink tabular-nums">
        <Money n={counted.amount} from={swap.currency} />
      </span>
      <span className="ml-1.5 text-xs font-medium text-ink-2 md:ml-0 md:block">{counted.how === "yearly" ? "a year" : "once"}</span>
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

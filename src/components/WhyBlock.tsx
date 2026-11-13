import Link from "@/components/CountryLink";
import { ChevronDown } from "lucide-react";
import { splitSentences, type CompareRow } from "@/lib/compare";
import type { Claim, Pair } from "@/lib/types";
import { buysOnce } from "./BulkBox";
import { citationDate } from "./Finding";
import { getT, type Lang } from "@/lib/i18n";

/** On a German page, the note beside record text that has no German yet, and the `lang` its paragraphs carry. */
function englishMark(lang: Lang, textLang: Lang) {
  return lang === "de" && textLang === "en" ? "en" : undefined;
}

function InEnglish({ lang }: { lang: Lang }) {
  return <span className="ml-2 align-middle font-sans text-[13px] font-medium tracking-normal text-muted">{getT(lang)("record.inEnglish")}</span>;
}

/** Two sentences show only when they fit in about this many characters. */
const EXCERPT_CHARS = 170;

function excerptOf(finding: string) {
  const sentences = splitSentences(finding);
  const take = sentences.length > 1 && `${sentences[0]} ${sentences[1]}`.length <= EXCERPT_CHARS ? 2 : 1;
  return { excerpt: sentences.slice(0, take).join(" "), rest: sentences.slice(take).join(" ") };
}

/** A cited claim as a title and two lines. The rest of the record and every source open in place. */
function FoldedFinding({ claim, className = "", lang }: { claim: Claim & { lang?: Lang }; className?: string; lang: Lang }) {
  const t = getT(lang);
  const { excerpt, rest } = excerptOf(claim.finding);
  const count = claim.sources.length;
  const sources = t("why.sources", count);
  const mark = englishMark(lang, claim.lang ?? "en");
  return (
    <article className={`card group flex flex-col p-4 ${className}`}>
      <h3 className="text-base leading-snug">
        <span lang={mark}>{claim.title}</span>
        {mark && <InEnglish lang={lang} />}
      </h3>
      <p lang={mark} className="mt-1.5 line-clamp-2 text-sm text-ink-2 group-has-[details[open]]:line-clamp-none">{excerpt}</p>
      <details className="group/more mt-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-medium text-cobalt hover:underline [&::-webkit-details-marker]:hidden">
          {rest || claim.caveat ? t("why.readMore", sources) : t("why.see", sources)}
          <ChevronDown className="h-4 w-4 shrink-0 group-open/more:rotate-180" aria-hidden="true" />
        </summary>
        {rest && <p lang={mark} className="mt-1 text-sm text-ink-2">{rest}</p>}
        {claim.caveat && (
          <p className="mt-2 text-sm text-ink-2">
            <span className="font-semibold text-ink">{t("why.evidenceStops")}</span>
            <span lang={mark}>{claim.caveat}</span>
          </p>
        )}
        <ul className="mt-2 text-[13px] font-medium">
          {claim.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2 md:min-h-6"
              >
                {s.publisher}, {citationDate(s.date, lang)}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function FindingGrid({ claims, lang }: { claims: Claim[]; lang: Lang }) {
  return (
    <div className="grid items-start gap-3 xl:grid-cols-2">
      {claims.map((claim, i) => (
        <FoldedFinding key={claim.id} claim={claim} lang={lang} className={claims.length % 2 === 1 && i === 0 ? "xl:col-span-2" : ""} />
      ))}
    </div>
  );
}

/** Longer than this and a result reads better in the table than in one line. */
const SHORT_RESULT = 24;
/** A summary that names a test or a score, worth showing even when the record has its own "why". */
const NAMES_A_TEST = /\b(Which\?|Stiftung Warentest|Öko-Test|Auto Express|Consumer Reports|scored?|test)\b/;
/** The same, in a German summary. */
const NAMES_A_TEST_DE = /(Which\?|Stiftung Warentest|Öko-Test|Auto Express|Consumer Reports|\bTest|\bNote\b|getestet|bewertet)/;

/** The test's name and both results, where they're seen first, with the link beside them. */
function TestLine({ test, brandName, altName, lang }: { test: CompareRow; brandName: string; altName: string; lang: Lang }) {
  const t = getT(lang);
  return (
    <p className="mt-2 text-[15px] text-ink">
      <span className="font-semibold">{test.aspect}</span>
      {test.detail && <span className="text-ink-2"> ({test.detail})</span>}:{" "}
      <span className="font-semibold">
        {altName} {test.alternative}, {brandName} {test.brand}.
      </span>
      {test.source && (
        <>
          {" "}
          <a
            href={test.source}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={t("why.sourceFor", test.aspect)}
            className="inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline underline-offset-2 md:min-h-0"
          >
            {t("why.source")}
          </a>
        </>
      )}
    </p>
  );
}

/**
 * Why the extra money buys little: this swap's own reasoning and any test result, what we checked,
 * then the cited findings, each a title and two lines. Findings that name this subcategory come first,
 * then those about the whole aisle, which don't appear on things you buy once, such as a charger.
 */
export function WhyBlock({
  pair,
  tests,
  caveats,
  className = "",
  lang = "en",
  textLang = "en",
}: {
  pair: Pair;
  /** Test rows from the same-or-different table. */
  tests: CompareRow[];
  /** The record's own notes on price dates, panels and what wasn't checked. */
  caveats: string[];
  className?: string;
  /** The page's language, and the language the record's text came out in. */
  lang?: Lang;
  textLang?: Lang;
}) {
  const t = getT(lang);
  const mark = englishMark(lang, textLang);
  const sub = pair.subcategory.toLowerCase();
  const own = pair.evidence_claims.filter(
    (c) => pair.claims.includes(c.id) || c.subcategories.some((s) => s.toLowerCase() === sub),
  );
  const general = buysOnce(pair.alternative.unit, pair.alternative.size)
    ? []
    : pair.evidence_claims.filter((c) => !own.includes(c));
  const hasFindings = own.length + general.length > 0;
  // "Cost per wash in the test" is detail for the table, not the test's result.
  const short = tests.filter(
    (t) => !/\bin the test$/.test(t.aspect) && t.brand.length <= SHORT_RESULT && t.alternative.length <= SHORT_RESULT,
  );
  const showSummary = pair.why && short.length === 0 && (textLang === "de" ? NAMES_A_TEST_DE : NAMES_A_TEST).test(pair.summary);
  return (
    <section aria-labelledby="why" className={className}>
      <div
        className={`container-page grid gap-x-10 gap-y-6 py-8 md:py-10 ${
          hasFindings ? "lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]" : ""
        }`}
      >
        <div className="min-w-0 max-w-3xl">
          <h2 id="why" className="display text-[22px] md:text-2xl">
            {pair.match_type === "same_kind" ? t("why.headingSameKind") : t("why.heading")}
            {mark && <InEnglish lang={lang} />}
          </h2>
          <p lang={mark} className="mt-2 text-[17px] leading-snug text-ink">{pair.why ?? pair.summary}</p>
          {showSummary && <p lang={mark} className="mt-2 text-[15px] text-ink">{pair.summary}</p>}
          {short.map((row) => (
            <TestLine key={row.aspect} test={row} brandName={pair.brand.brand} altName={pair.alternative.brand} lang={lang} />
          ))}
          <details open className="group/checked mt-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-[15px] font-semibold hover:underline [&::-webkit-details-marker]:hidden">
              {t("why.whatWeChecked")}
              <ChevronDown className="h-4 w-4 shrink-0 group-open/checked:rotate-180" aria-hidden="true" />
            </summary>
            <p lang={mark} className="text-sm text-ink-2">{pair.evidence}</p>
            {caveats.length > 0 && (
              <p className="mt-2 text-sm text-ink-2">
                <span className="font-semibold text-ink">{t("why.worthKnowing")}</span>
                <span lang={mark}>{caveats.join(" ")}</span>
              </p>
            )}
          </details>
          {hasFindings && (
            <Link href="/why" className="inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline underline-offset-2">
              {t("footer.englishOnly", t("why.allFindings"))}
            </Link>
          )}
        </div>
        {hasFindings && (
          <div className="min-w-0 space-y-3">
            {own.length > 0 && <FindingGrid claims={own} lang={lang} />}
            {general.length > 0 && (
              <div>
                <p className="pb-1.5 text-[13px] font-medium text-muted">{t("why.acrossAisle")}</p>
                <FindingGrid claims={general} lang={lang} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** The other side of the ticket, shown across the whole page so it weighs as much as the saving. */
export function BrandWins({
  id,
  brandName,
  altName,
  points,
  wins,
  className = "",
  lang = "en",
  textLang = "en",
}: {
  id: string;
  brandName: string;
  altName: string;
  points: string[];
  /** Researched rows where the brand came out ahead. */
  wins: CompareRow[];
  className?: string;
  lang?: Lang;
  textLang?: Lang;
}) {
  if (wins.length === 0 && points.length === 0) return null;
  const t = getT(lang);
  const mark = englishMark(lang, textLang);
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-16 border-y border-brand-better/25 bg-brand-better-soft ${className}`}
    >
      <div className="container-page grid gap-x-10 gap-y-4 py-8 md:py-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="display text-[22px] text-brand-better md:text-2xl">
            {t("why.brandWinsHeading")}
            {mark && <InEnglish lang={lang} />}
          </h2>
          <p className="mt-2 text-[15px] text-ink-2">
            {t("why.brandWinsIntro", altName)}
          </p>
        </div>
        <div className="min-w-0 space-y-5">
          {wins.length > 0 && (
            <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              {wins.map((r) => (
                <li key={r.aspect} className="min-w-0 text-[15px]">
                  <p className="text-[17px] leading-snug font-semibold text-brand-better">{r.aspect}</p>
                  <p className="mt-1 text-ink">
                    <span className="font-medium">{brandName}:</span> {r.brand}
                  </p>
                  <p className="mt-0.5 text-ink-2">
                    <span className="font-medium">{altName}:</span> {r.alternative}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {points.length > 0 && (
            <ul lang={mark} className="max-w-[70ch] list-disc space-y-2 pl-5 text-[17px] leading-snug text-ink marker:text-brand-better md:text-lg">
              {points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

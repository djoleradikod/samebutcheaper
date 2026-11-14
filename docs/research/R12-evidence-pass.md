# R12: evidence that stands without a price (14 Nov 2026)

When the site joins Walmart's or Amazon's affiliate programme, the catalogue build withholds those stores' prices and
cuts every sentence that quotes a price from a withheld record's prose (`withoutPrices` in `scripts/programme-terms.ts`,
R11). Before this pass, 98 withheld records lost text under `PROGRAMME_TERMS_ON=all`. 20 swaps had nothing left and showed
the fixed "We compared the two listings' pack sizes and prices..." sentence. 15 had under 120 characters left. On many
US medicine pages, the cut removed the only sentence that explained why the cheaper product is the same thing.

This pass edits data only. No rule in `src/lib/schema.ts` or the build had to change.

## Result

| | Before | After |
|---|---|---|
| Withheld records whose evidence falls back to the fixed sentence | 20 | 0 |
| Withheld records with evidence under 120 characters after the cut | 15 | 1 (Libby's pumpkin, 72 characters: it really has only "one ingredient, same can") |
| Withheld summaries that still quote a saving (% less, half the price) | 13 | 0 |
| Cut prose with unbalanced brackets | 1 (Tide: "(membership needed.") | 0 |

Both `npm run catalog` and `PROGRAMME_TERMS_ON=all npm run catalog` pass. With terms on there are still 120 withheld
swaps, 17 kits and 10 baskets. Each rewritten record still loses one sentence when terms are on: the dated price sentence,
which is now written last on purpose.

**Changed: 89 swaps, 16 kits and 1 finding** (`screenwash-own-brand-cleaned-best-cheap-froze` in
`data/evidence/claims.json`). No German text had to change, because none of these records has a German translation.
The one English-text guard fixture that changed is `scripts/tests/fixtures/i18n/us-compare-claritin-vs-equate-loratadine-10mg.txt`.

## The patterns

1. **The price sentence was the proof.** Most of these were US Walmart medicine swaps. Their evidence read "Walmart's
   Claritin listing shows loratadine 10 mg, 70 count, for $38.97...", so the strength and the price sat in one sentence.
   Meanwhile the real proof sat unused in the record's `aspects` rows: DailyMed NDA/ANDA numbers, inactive-ingredient
   lists and OTC monograph categories. The evidence now opens with that proof: same active ingredient and strength,
   the application number ("ANDA 075209, a generic approved as equivalent"), the "Compare to" wording on the pack, and
   what differs. The price comes last in its own dated sentence ("In November 2026 Walmart listed..."). Every
   DailyMed label that the evidence now names is also in `sources`, so it shows in the page's source list (31 URLs
   copied from `aspects`).
2. **Magazine test pairs (UK car and DIY, 17 swaps)** gave the method, then "Rounded prices: around GBP 7 ... (4.5 of 5)",
   so the scores were cut along with the prices. Scores now have a sentence of their own. Prices read as "The
   magazine's rounded prices at the time were...", which also stops presenting a magazine's dated price as today's price.
3. **Summaries carried the saving** ("for about half the price", "costs 41% less"). The build does not cut summaries,
   so on a withheld page they quoted a saving the page may not show, and they went stale whenever prices changed. 13 swap
   and kit summaries now say only what is the same. The saving stays in the dated price sentence.
4. **Kit summaries that were all price** ("...for $6.43 together instead of $11.47") fell back to "The same items,
   bought separately." They now state the match, and the price moved into the evidence.
5. **Undated price notes** ("The Aleve price is a sale price (regular $19.97)") now have a month, and each sits in a
   sentence of its own.
6. **Clause cuts that left fragments.** A semicolon inside brackets left "(membership needed." on the Tide page. The
   fixed sentence said "pack sizes and prices" where the record compared labels. Several "Equate's percentage was not
   shown" caveats were already answered by a DailyMed label in the record's own `aspects`.
7. **The record contradicted itself.** For example, "Gel base may differ" next to an aspect row saying the inactive list
   is identical (Voltaren), and "MiraLAX has no inactive ingredients. Check the Equate label" when the ClearLAX label
   also lists none. The differences text now agrees with the label rows.
8. **Smaller fixes.** Title case on three Open Facts titles (Kikkoman, Heinz ketchup, Hershey's), "I compared" changed
   to "We compared" on Centrum, and a "$2,500 connected-equipment cover" that the price filter read as a price.

## Labels re-read for this pass

DailyMed (US National Library of Medicine, public domain) and the NIH Dietary Supplement Label Database, read on
14 Nov 2026. No store product pages were read.

- Confirmed what the records' aspect rows said: Equate loratadine (ANDA075209), Flonase Allergy Relief (NDA205434) and
  Equate fluticasone (ANDA207957, same inactive list), Equate miconazole 7 (2%, ANDA074164), Pataday Once Daily
  Relief (NDA021545) and Equate olopatadine (ANDA206087, same inactive list), Equate nicotine patch ("NDA authorized
  generic", NDA020165), Kirkland Aller-Tec (ANDA078336), Member's Mark cetirizine (ANDA078336), naproxen (ANDA075168,
  Dr. Reddy's), ClearLAX (ANDA090685, no inactives), diclofenac gel (ANDA211253, Perrigo), fexofenadine
  (ANDA202039, Aurolife) and omeprazole (NDA022032), Kirkland minoxidil foam (ANDA091344, Perrigo), Equate Headache
  Relief Extra Strength (250/250/65 mg, "Compare to Excedrin"), Equate Sensitive toothpaste (5% KNO3, 0.24% NaF), Crest
  Pro-Health Advanced Deep Clean and Equate Pro-Advanced (both stannous fluoride 0.454%), and the Spring Valley
  Melatonin 5 mg label from 2012 (made by Pharmavite).
- **Corrected:** on the Excedrin swap, the aspect row for Equate's monograph status pointed to an Excedrin repackager's
  label (Navajo Manufacturing). It now points to Equate's own label.

## Match type and confidence changes

| Record | Before | After | Why |
|---|---|---|---|
| `cheerios-vs-great-value-toasted-os` | equivalent_spec | **same_kind** | The Great Value ingredient record is unreadable OCR, and no spec or test compares the two. All we know is that both are 12 oz boxes of O-shaped cereal. Its summary and why now say so. |
| `crest-pro-health-advanced-deep-clean-vs-equate-pro-advanced-toothpaste` | same_kind | **identical_active** (medium) | Both DailyMed labels state stannous fluoride 0.454% (0.16% w/v fluoride ion), and the inactive lists differ only in PEG-6 against PEG-8. The confidence stays medium because the Equate label is titled "Pro-Advanced" without the flavour name. |
| `flonase-vs-equate-fluticasone-50mcg` | confidence medium | **high** | The only reason for "medium" was that the Flonase page didn't print 50 mcg. Its DailyMed label does. |
| `pataday-once-daily-vs-equate-olopatadine-0-2` | confidence medium | **high** | Both DailyMed labels were read: same 0.2%, same inactive list. Pataday's label was added to `sources`. |

Several summaries were made weaker on purpose: they no longer state a saving. That is a change in what the summary
claims, not in the evidence.

## Proof weak enough to consider retiring or reworking

- `cheerios-vs-great-value-toasted-os`: now same_kind. The prices also come from two different chains in two
  different states. Retire it, or find a readable Great Value label.
- `hersheys-natural-cocoa-vs-great-value-baking-cocoa` and `hersheys-natural-unsweetened-cocoa-vs-great-value-unsweetened-baking-cocoa`
  are the **same two products** with the same Open Facts barcodes, in two files (`2026-11-us-food.json` and
  `2026-11-mined-1.json`). Keep one.
- `ritz-crackers-vs-krantz-golden-round-crackers`: the ingredient lists are similar but the oils differ, there is no
  test, and the prices are from different chains six months apart. It is equivalent_spec on label order alone.
- `prilosec-otc-vs-equate-omeprazole-20mg` and `prilosec-otc-vs-members-mark-omeprazole-20mg`: they are already
  same_kind. The two use different salt forms under different applications (NDA022032 is not a generic of Prilosec).
  They are honest as they stand, but they make a weak lead swap.
- `zaditor-vs-equate-ketotifen-eye-drops`: its aspect row says Zaditor is under an ANDA and Equate under NDA 021996.
  That looks reversed or mixed with Alaway's approval. Re-read both labels before the next refresh.
- `duracell-coppertop-aaa-vs-kirkland-signature-aaa` (and the AA swap): same_manufacturer rests on one 2016 TV
  interview with Costco's then-CEO, reported second-hand. Nothing newer was found.
- `mr-clean-magic-eraser-extra-durable-vs-amazon-basics-cleaning-eraser`: equivalent_spec on "both are melamine foam"
  plus buyer reports. No spec or test compares the two.
- Medium records where the cheaper side's own label was never seen: `womens-rogaine-2-solution-vs-equate-minoxidil-2-solution`
  (the Equate inactive list is unknown, and DailyMed has no Equate 2% label), `sensodyne-extra-whitening-vs-equate-extra-whitening-sensitive-toothpaste`
  (the DailyMed Equate label is "Sensitive", not tied to the Extra Whitening tube), `cerave-acne-foaming-cream-cleanser-vs-up-and-up-benzoyl-peroxide-4-cleanser`
  (CeraVe's full list was not seen, and cerave.com refused the fetch), and `neutrogena-t-gel-extra-strength-vs-equate-extra-strength-coal-tar`
  (both strengths come from Walmart listings).

## What still reads badly with terms on, for the code owner (W7-A)

1. **Withheld kits drop "what differs".** `WithheldKit` in `src/components/WithheldRecord.tsx` renders `b.evidence` and
   the sources, but not `b.differences`. So safety notes disappear, such as "don't give both forms in the same dosing
   window" on Children's Tylenol and "oral phenylephrine judged ineffective" on DayQuil. The kit's match type isn't
   shown either. Fix: render `b.differences` under its own heading, plus the match label.
2. **Withheld baskets show only brand names** ("Equate / instead of Vaseline"), with no product and no match type, so
   the basket makes no case on its own. Fix: show the product name and the swap's match label per line, as the priced
   basket does.
3. **`withoutPrices` misses "¢".** "85.1¢/fl oz" isn't matched by `PRICE`. Today such text only sits next to a "$"
   figure, so the sentence goes anyway. Add `¢` (`\d\s?¢`) to `PRICE`.
4. **The clause cut ignores brackets.** It split "(membership needed; third-party Walmart sellers charge about $32)"
   at the semicolon and kept "(membership needed.". The data is fixed. In the code, don't split inside brackets, or
   drop a kept clause whose brackets don't balance.
5. **"Prices checked 2 Nov 2026."** shows under the headline on a withheld swap where no price is shown. "Last
   checked by us" on each side already says it. With every price withheld, this line could read "Store prices
   withheld; we last checked on 2 Nov 2026" or be dropped.
6. Summaries are not passed through `withoutPrices`. This pass removed every saving from withheld summaries, but a new
   record could add one back. A test that fails on a withheld record whose summary matches `PRICE` or `% less` would
   keep it that way.

With prices on (the default build), the same ten swap pages, three kits and two baskets read as before. The evidence now
leads with the label proof and ends with the dated price sentence, and the basket totals show.

# Shopper walk-through, November 2026

One pass through the site as a shopper would use it, phone first (390 px, then 1280 px), as a US, UK and German
visitor: home cold, search, open a swap, decide whether to believe it, go to buy, save it, open a kit, paste a list,
ask to be told of changes. Run on a production build with a real phone user agent (headless Chrome counts as a bot,
which never gets a country), 13 November 2026.

The test for each item: would a careful person trust this with their money, and recommend it to a friend?

Screenshots are outside the repository, in the scratch folder of the session that made them:
`S = /tmp/claude-0/-home-claude/6f0ce888-e31a-5621-b6de-5a55f44e1d72/scratchpad`. Before the fixes: `S/w3d-walk/`.
After: `S/w3d-after/`.

Size: S is under an hour, M is up to a day, L is more than a day or needs a decision first.

## Ranked

| # | What a shopper meets | Where | Status |
|---|---|---|---|
| 1 | The shelf on a swap is drawn wrong at every width: the shelf rail sits above the packs, and the "−56%" ticket covers the cheaper product's name. The first thing on the page looks broken. | Swap, all countries. `S/w3d-walk/DE-1280-swap.png` | Fixed. The shelf column spans its four rows again. After: `S/w3d-after/US-1280-swap.png` |
| 2 | On a phone, the shelf shows two pack prices (€5.49 vs €4.99) under a "−56%" ticket, with no pack size or unit price. It reads as a 9% saving labelled 56%. | Swap, phone. `S/w3d-walk/DE-390/05-swap.png` | Fixed. Pack size and unit price show on phones too. After: `S/w3d-after/DE-390-swap.png` |
| 3 | A kit shows "Rebuilt €31.05" in its summary, while the hero says €30.32 and the saving is worked out from €30.32. Two prices for the same thing, a few centimetres apart. (The two figures are "one order at one store" and "the same amount as the kit", but nothing says so.) | Kit. `S/w3d-walk/DE-390/13-kit-full.png`, after: `S/w3d-after/GB-390-kit.png` | Proposed (M): label each figure for what it is ("Same amount as the kit" and "What you pay at checkout"), or show only the one the saving uses in the summary and leave the checkout figure in its section. Needs the owner to pick which leads, and the labels translated. |
| 4 | Search for "advil" as a US shopper: two kits, no swaps, and no word that three Advil swaps exist (priced in Canada). In countries that can opt in to other countries' swaps, a search hid those silently too. | Search. `S/w3d-walk/US-390/03-search.png` | Partly fixed. Where "Show swaps from other countries" would reveal matches (Canada, Ireland, Austria, France, Croatia, Australia and the other fallback countries), search now says "2 more for 'zyrtec' are priced in other countries" with the button, and drops the untrue "We haven't checked a swap" card when there are none here. After: `S/w3d-after/IE-390-search-zyrtec.png`. US, UK and Germany never list other markets' swaps, so they still see nothing; whether to point them at the Canadian page is a product decision (L). |
| 5 | Search always lists kits above swaps, so "advil" or "nurofen" leads with a 5-line kit when the shopper wanted the single box. | Search. `S/w3d-walk/US-390/04-search-full.png` | Fixed. Swaps first; kits lead only when one matches the search better than every swap (by Fuse score). |
| 6 | "Reported by shoppers: this price may have changed" sat at the foot of the page, far from the price it warns about. | Swap, kit. `S/w3d-walk/GB-390/06-swap-full.png` | Fixed (part 1, item 3). The note sits under the offers on a swap and under the buy box on a kit, and a reported kit never leads a list. |
| 7 | "Email me if this changes" is at the very foot of a long swap page, so a shopper who wants to wait for a price drop doesn't find it. | Swap. `S/w3d-walk/GB-390/08-watch.png` | Fixed. A third button beside Save and Share jumps to the form. After: `S/w3d-after/DE-390-swap.png` |
| 8 | A kit's name runs to five lines of 30 px type on a phone, pushing the price below the fold. | Kit. `S/w3d-walk/DE-390/12-kit.png` | Fixed. Names over 120 characters use smaller type. After: `S/w3d-after/GB-390-kit.png` |
| 9 | Pasting "Nurofen" on its own goes to "Did you mean?" instead of matching the obvious swap. | Check a list. `S/w3d-walk/GB-390/15-check-result.png` | Proposed (M): when a line is a bare brand with exactly one swap in the shopper's market, match it as "same kind" rather than asking. Lives in the matcher (`src/app/check/list/match/route.ts`), needs a test set of bare brand names. |
| 10 | A white gap above "Swap a whole basket" on the phone home page makes it look as if something failed to load. | Home, phone. `S/w3d-walk/US-390/01-home.png` | Fixed (part 1, item 7). After: `S/w3d-after/DE-390-home.png` |
| 11 | "Same kind ·" with the dot left hanging at the end of a line when the row wraps. | Check a list results. `S/w3d-walk/GB-390/16-check-result-full.png` | Fixed. Gaps instead of dots. |
| 12 | "before unchecked delivery" on kits is our own jargon; a shopper can't tell whether delivery is extra. | Kit. `S/w3d-walk/DE-390/13-kit-full.png` | Proposed (S, wording): "plus delivery, which we haven't checked". Left as it is because it is shared copy that needs translating. |
| 13 | "about€76.34": the small "about" runs into the price in the kit summary. | Kit. `S/w3d-walk/DE-390/c-kit.png` | Proposed (S): a fixed gap after the qualifier in `Money`, or a non-breaking space in the text. |
| 14 | The cheaper Dawn is Uline's own dish soap, sold only by Uline, an industrial supplier most households have never heard of. That is a fair price, but a shopper may not trust the store or meet its order minimums. | Swap, US. `S/w3d-after/US-390-dawn-uline.png` | Proposed (S, data): the researcher either adds a household-store alternative or a note on who Uline sells to. Not mine to edit (`data/pairs/**`). |
| 15 | A UK kit shown to a German shopper doesn't say clearly, at the top, that the prices are UK prices from UK stores. | Kit, DE. `S/w3d-walk/DE-390/12-kit.png` | Proposed (S): check after this wave. The record note that now holds its place at the top ("We priced this at UK stores...") may already cover it. |
| 16 | A shopper whose country isn't known yet sees a globe with no label in the country picker. | Header, unknown country. `S/w3d-walk/US-390/01-home.png` | Proposed (S): show "Country" next to the globe. Minor. |

## Seen and left alone

- Load times on a cold phone were 0.7 to 1.7 s per page on the local build. No complaint at this size.
- The sticky "Rebuild this kit" bar covers part of full-page screenshots. That is a screenshot artifact, not something a shopper sees.

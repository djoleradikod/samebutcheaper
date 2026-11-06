# Design brief: the shelf ticket

Owner, 6 Nov 2026: this "should look better than camelcamelcamel.com or geizhals.eu or idealo.de". It has to help people buy in bulk,
save on brand names and learn why something shouldn't be overpaid. Images on every item, bundle presets at the top, way less medicine.

Those sites win on density, photos and speed. They lose on clarity: nobody tells you which one to buy or why. We keep the density and
the photos and add the answer: this one, this much cheaper per unit, and here's the proof.

## The idea

A supermarket shelf-edge ticket is the one piece of retail design everyone can read at a glance: a big price, a small unit price, a
yellow ticket for the bargain. Everything on the site is built from that. It belongs to this subject, and no comparison site or AI
landing page looks like it.

## Tokens (globals.css)

- Paper `#ffffff`, canvas `#f3f4f1` for page bands, ink `#15171c`, ink-2 `#40454e`, muted `#6b7079`, line `#e2e4e7`, line-strong `#c9ccd1`.
- Ticket yellow `#ffd60a` with ink text. Reserved for savings. Never on a button, never decoration, and never more than one on a card.
- Cobalt `#1546d6` for links and focus. Primary buttons are ink on white text.
- Semantic only: same `#0b7a48`, different `#8a5a00`, brand better `#b3261e`. Each with a pale fill for table rows.
- Radius: 4px on tickets and tiles, 8px on cards. Nothing larger except the search box (10px). No shadows at rest. A 1px line, and a darker
  line on hover.
- Spacing runs on a 4px grid. Page max width 1320px. Bands are full width with an inner container.

## Type

One family, **Archivo** (variable, with the width axis) through `next/font/google`, `display: "swap"`, Latin subset only. Width does the
work a second typeface would do:

- Prices and tickets: width 75, weight 800, tabular numerals, tight tracking.
- Headings: width 112, weight 700, sentence case. H1 28px on phone, 40px on desktop. Section heads 20 to 24px.
- Body: width 100, weight 400, 15 to 16px, line height 1.5. Labels 12 to 13px, weight 500.

Remove Fraunces and Geist. Monospace isn't needed.

## Parts (build once, use everywhere)

- `Ticket`: plain yellow rectangle showing "-52%" or "Save £4.20". Sizes sm, md, lg. No punched hole: the blind round of 6 Nov read it as a
  stray mark.
- `UnitPrice`: the cheaper price per unit in large condensed ink, the brand's beside it in muted with no strike-through, then "per 100 g".
  Convert per-unit display so it reads naturally (per 100 g, per 100 ml, per sheet, per wash).
- `ProductThumb` (exists): the real photo filling its white tile, and an honest shelf label (brand name, product kind, "No photo yet") when no
  photo exists. A label must never look like a photo or a pack design. Takes `eager` for the LCP image.
- `PairCard`: two tiles side by side, brand left and cheaper right, the ticket beneath the photos and never on one, then brand name to cheaper name,
  the UnitPrice row, the match level as plain text. Dense enough for 4 across at 1320px and 2 across on a phone.
- `BasketCard`: for presets. A 2x2 or overlapping collage of real product photos, the title, who it's for, "Same shop: £64.20 → £31.85",
  a large ticket with the saving, and the item count. This is the most important card on the site.
- `Finding`: a cited claim: the title, the finding in one or two lines, publisher and date as a link.

## Pages

**Home.** The first screen is the shop, not a speech. Thin header with the logo, a wide search and country. A row of aisle links with medicine
last. Then one short line of H1, such as "Same job. Lower price." with the live count of swaps. Then the baskets straight away, 6 across two
rows on desktop and a horizontal snap rail on a phone, with the shopper's market first. Then the biggest savings as a dense PairCard grid
(never medicine). Then "Why it's worth switching": 3 Findings. Then "Buying in bulk": what to stock up on, what to buy to use and what to
buy small, from the shelf-life records. Then all aisles with a photo each. Then the newsletter, then a short FAQ. Remove the big hero, the
receipt card, the washes, the dot pattern and the uppercase eyebrows.

**Category.** H1 with count. Left filter column on desktop (shelf, how strong the match is, market, photo only), a filter sheet on a phone.
Sort by biggest saving, lowest unit price or newest check. A dense grid of PairCards. Medicine category pages keep the health note.

**Swap page.** The answer first: two big photos side by side, price, pack and unit price under each, and the ticket between them. One sentence
of verdict. Buttons to both stores. Then in order: why the extra money buys little (`why`, then Findings with citations); where the brand wins
(`differences`, shown as prominently as the saving); same-or-different table; bulk (break-even from `bulkView`, the bigger pack, shelf life
and storage, a small usage slider); where to buy; sources; photo credits; related swaps.

**Basket page.** `/basket/[slug]`. Collage, title, who it's for, total on both sides, saving. Lines with photos, each with a quantity stepper
that recalculates in the browser, and each linking to its swap. "Save all to my list". How the list was chosen (`research`) and its sources.

**Why hub.** `/why`: all Findings grouped by aisle, then the shelf-life table, with every citation. **Credits.** `/credits`: every photo with its source,
licence and link, plus the note that pack designs and trademarks belong to their owners.

## Rules

- Real content only. Every number comes from the catalogue or a cited record. No invented ratings, counts or testimonials.
- Medicine never appears on the home page above the aisle list, and the copy never leads with it. The health note stays on medicine pages.
- Say "cheaper", "same job", "same spec". Say "same manufacturer" or "identical" only where the record's `match_type` documents it.
- Attribution: on swap pages show the credit under each photo. On lists a small "Photos" link goes to `/credits`.
- Performance: pages stay server-rendered. Ship client JS only for search, filters, the stepper, the slider and My List. The LCP image is
  `eager` with `fetchPriority="high"`; everything below the fold is lazy. Width and height are always set so nothing shifts.
- Accessibility: visible focus, 44px touch targets on phones, real labels, alt text naming the product.
- Writing: plain sentences a shopper would say. No em dashes as asides, no "not X but Y", no sales language, no uppercase eyebrows, no icons
  in coloured circles, no emoji.

## Defaults to avoid

Gradient washes, dot-grid backgrounds, big rounded cards with soft shadows, pill badges everywhere, a serif display face, mint and lime, three
icon-plus-text columns, centred marketing heroes, "trusted by" strips.

# R10: UK and US additions from stores we may read, 14 November 2026

Wave 5 looked for UK, US, Canadian and Irish stores whose robots.txt and terms allow us to read and reuse product
prices, then added swaps from the ones that do. Every verdict, with the clause quoted and its URL, is in
`docs/research/R10-source-verdicts.json`; `scripts/prices/licence.ts` now reads that file after R4 to R7.

All prices below were read on 14 Nov 2026 on the store's own product page. Every record has `price_checked: "2026-11"`
and two hand observations in `data/prices/observations/2026-11.jsonl`, logged with
`npm run prices:refresh -- --manual`, method `hand`, the retailer as source. Pages were read through a summarising
fetch tool, so a quote is the tool's reading of the page; the records name what the page showed and where two fields
on one page disagreed.

## What came out of it

| | Before | After |
|---|---:|---:|
| Swaps | 492 | 514 |
| GB swaps on toolstation.com | 17 | 28 |
| US swaps on batteryjunction.com | 0 | 11 |
| Swaps whose sources are all `ok` (licence report, store terms alone) | 205 | 227 |
| Swaps with a barred source | 228 | 230 |

The two newly barred swaps were already resting on a store this round read for the first time: Best Buy
(`belkin-8k-ultra-high-speed-hdmi-2-1-2m-vs-best-buy-essentials-6ft-8k-hdmi-2-1`) and H-E-B
(`head-and-shoulders-2-in-1-classic-clean-vs-equate-2-in-1-dandruff`). Vitacost and Ocado are barred too, but their
swaps were barred already through their other side.

Added: 22 swaps (11 GB, 11 US). That is short of the 30 asked for. The reason is the stores, not the products: of 30
UK and US shops whose terms we read or tried to read, two new ones allow it (Battery Junction, Monoprice), and only
Toolstation and Battery Junction showed prices to the fetch tool. Viking Direct, `ok` since R5, showed no price figure
on its product pages this time (only an incl./excl. VAT toggle), so it couldn't be used. Canada and Ireland: no
readable store was found this round; nothing was added.

## Which sameness the records prove

Every record is `equivalent_spec`, `medium`: the same size code, chemistry, voltage, cap, light output, standard or
class, compared row by row from the two product pages, with the same row names so the build compares them. Nothing
here is a medicine. Where the brand has something the cheaper one doesn't state (Duracell's bitter coating on coin
cells, a stated storage life, Philips's stated 15,000-hour life, Evo-Stik's paint-over time, Energizer's stated
capacity), the record has a `brand_better` aspect and says so in `differences`. Sale prices are named as such, with
the regular price and the gap at the regular price.

GTINs: the US records carry the UPC that Battery Junction prints on each product page, except Panasonic CR2032,
whose page showed two different codes, so it has none. Every code passed the build's check-digit test. The
Toolstation pages show no barcode (some numbers appear only in safety-data-sheet file names), so the UK records have
none.

## GB: Toolstation (`data/pairs/2026-11-gb-toolstation.json`)

Prices include VAT, as the pages show them.

| Slug | Brand side | Cheaper side | Prices (GBP, brand / cheaper) | Saving per unit |
|---|---|---|---|---|
| `duracell-plus-power-aa-10-vs-gp-super-alkaline-aa-40-gb` | Duracell Plus Power AA LR6 alkaline, pack of 10 (MN1500B10) | GP Super Alkaline AA, pack of 40 | 10.99 / 17.20 for 10 cell vs 40 cell | 60.9% |
| `duracell-plus-power-aaa-10-vs-gp-super-alkaline-aaa-40-gb` | Duracell Plus Power AAA LR03 alkaline, pack of 10 (MN2400B10) | GP Super Alkaline AAA, pack of 40 | 10.99 / 17.29 for 10 cell vs 40 cell | 60.7% |
| `duracell-plus-power-9v-2-vs-gp-super-alkaline-9v-4-gb` | Duracell +100% Plus Power 9V, pack of 2 (S18718) | GP Alkaline Battery Super 9V, pack of 4 | 7.99 / 9.49 for 2 cell vs 4 cell | 40.6% |
| `duracell-cr2032-2-vs-gp-cr2032-4-gb` | Duracell Lithium Coin Cell 3V CR2032, pack of 2 (DLCR2032B2) | GP Lithium Coin 3V CR/DL2032, pack of 4 | 5.00 / 5.25 for 2 cell vs 4 cell | 47.5% |
| `duracell-cr2025-2-vs-gp-cr2025-4-gb` | Duracell Lithium Coin Cell 3V CR2025, pack of 2 | GP Lithium Coin 3V CR/DL2025, pack of 4 | 5.00 / 6.30 for 2 cell vs 4 cell | 37% |
| `philips-led-7w-e27-806lm-vs-wessex-led-a60-5-9w-e27-806lm-gb` | Philips LED A Shape Lamp 7W ES (E27) 806lm, warm white | Wessex LED A60 GLS Bulbs 5.9W ES Warm White 806lm, pack of 5 | 3.91 / 6.99 for 1 bulb vs 5 bulb | 64.2% |
| `philips-led-7w-b22-806lm-6-vs-wessex-led-a60-5-9w-b22-806lm-5-gb` | Philips LED A Shape Lamp 7W BC (B22d) 806lm, warm white, pack of 6 | Wessex LED A60 GLS Bulbs 5.9W BC Warm White 806lm, pack of 5 | 12.88 / 6.49 for 6 bulb vs 5 bulb | 39.5% |
| `aico-ei650-vs-fireangel-fa6620-r-gb` | Aico Ei650 Optical Smoke Alarm, 10-year lithium battery, stand-alone | FireAngel FA6620-R 10 Year Battery Smoke Alarm | 34.99 / 14.99 for 1 alarm vs 1 alarm | 57.2% |
| `evo-stik-trade-decorators-caulk-380ml-vs-soudal-decorators-caulk-290ml-gb` | Evo-Stik Trade Decorators Caulk 380ml, white | Soudal Decorators Caulk 290ml, white | 3.99 / 1.69 for 380 ml vs 290 ml | 44.5% |
| `honeywell-ffp3-moulded-valved-10-vs-maverick-ffp3-moulded-valved-2-gb` | Honeywell Moulded FFP3 Valved Face Mask, pack of 10 | Maverick FFP3 Moulded Valved Disposable Face Mask, pack of 2 | 29.99 / 4.48 for 10 mask vs 2 mask | 25.3% |
| `moldex-2405-ffp2-valved-5-vs-maverick-ffp2-moulded-valved-2-gb` | Moldex 2405 FFP2 Classic Valved Disposable Face Mask, pack of 5 | Maverick FFP2 Moulded Valved Disposable Face Mask, pack of 2 | 21.49 / 3.98 for 5 mask vs 2 mask | 53.7% |

Toolstation's specification tables often disagree with the rest of the page about pack size (a 10-pack listed as
"Pack Size: 12", a 4-pack whose contents say 5). Every record uses the pack the page sells and names the conflict.

## US: Battery Junction (`data/pairs/2026-11-us-batteryjunction.json`)

| Slug | Brand side | Cheaper side | Prices (USD, brand / cheaper) | Saving per unit |
|---|---|---|---|---|
| `duracell-coppertop-aa-4-vs-rayovac-ultra-pro-aa-24` | Duracell Coppertop Duralock AA LR6 alkaline, 4-pack retail card (MN1500B4) | Rayovac Ultra Pro AL-AA-24 alkaline, 24-pack | 7.15 / 9.45 for 4 cell vs 24 cell | 78% |
| `duracell-coppertop-aaa-4-vs-rayovac-ultra-pro-aaa-24` | Duracell Coppertop Power Boost AAA LR03 alkaline, 4-pack retail card (MN2400B4) | Rayovac Ultra Pro AL-AAA-24 alkaline, 24-pack | 6.60 / 10.50 for 4 cell vs 24 cell | 73.5% |
| `duracell-coppertop-9v-2-vs-rayovac-ultra-pro-9v-12` | Duracell Coppertop Duralock 9V 6LR61 alkaline, 2-pack retail card (MN1604B2) | Rayovac Ultra Pro AL-9V-12 alkaline, 12-pack | 11.48 / 16.99 for 2 cell vs 12 cell | 75.3% |
| `duracell-coppertop-d-2-vs-rayovac-ultra-pro-d-12` | Duracell Coppertop Duralock D LR20 alkaline, 2-pack retail card (MN1300B2) | Rayovac Ultra Pro AL-D-12 alkaline, 12-pack | 5.50 / 15.26 for 2 cell vs 12 cell | 53.8% |
| `duracell-coppertop-c-2-vs-rayovac-ultra-pro-c-12` | Duracell Coppertop Duralock C LR14 alkaline, 2-pack retail card (MN1400B2) | Rayovac Ultra Pro AL-C-12 alkaline, 12-pack | 5.40 / 11.48 for 2 cell vs 12 cell | 64.6% |
| `duracell-cr2032-4-vs-panasonic-cr2032` | Duracell Duralock CR2032 3V lithium coin cell, 4-pack retail card (DL2032B4PK) | Panasonic CR2032 3V lithium coin cell, single on a tear strip | 6.21 / 0.45 for 4 cell vs 1 cell | 71% |
| `duracell-cr2025-2-vs-panasonic-cr2025` | Duracell CR2025 3V lithium coin cell, 2-pack retail card (DL2025B2PK) | Panasonic CR2025 3V lithium coin cell, single on a tear strip | 3.47 / 0.50 for 2 cell vs 1 cell | 71.2% |
| `duracell-cr2016-2-vs-panasonic-cr2016` | Duracell CR2016 3V lithium coin cell, 2-pack retail card (DL2016B2PK) | Panasonic CR2016 3V lithium coin cell, single on a tear strip | 3.85 / 0.50 for 2 cell vs 1 cell | 74% |
| `duracell-cr123a-2-vs-panasonic-cr123a-2` | Duracell Ultra DL123A CR123A 3V lithium, 2-pack retail card (DL123AB2PK) | Panasonic CR123A 3V lithium, 2-pack retail card | 16.74 / 5.95 for 2 cell vs 2 cell | 64.5% |
| `energizer-377-vs-maxell-377` | Energizer 377 silver oxide button cell, 1 in a blister pack (377BPZ) | Maxell SR626SW 377 silver oxide button cell, single on a tear strip | 1.13 / 0.85 for 1 cell vs 1 cell | 24.8% |
| `energizer-a76-vs-maxell-lr44` | Energizer A76 LR44 alkaline button cell, 1 in a blister pack (A76BPZ) | Maxell LR44 alkaline button cell, on a tear strip, sold in twos | 1.45 / 0.53 for 1 cell vs 1 cell | 63.4% |

Seven of the 22 US prices were Battery Junction's Black Friday sale prices. Each record gives the regular price and
the saving at regular prices; none drops under 48%. Ratings are on the record only where the page showed a score and
at least 11 ratings (Rayovac AA, Duracell D, both CR2032, Maxell LR44).

## Rejected and held back

| Candidate | Reason |
|---|---|
| Philips LED 13W E27 1521lm vs Sylvania ToLEDo 13W E27 1521lm 4-pack (Toolstation) | Philips's product page said GBP 8.65 and the category page GBP 6.92; Sylvania's pack contents said 1 against a 4-pack title. Two conflicts in one pair |
| Philips GU10 3.8W 345lm 6-pack vs Wessex GU10 glass 3W 345lm 5-pack (Toolstation) | Philips is dimmable and dim-to-warm (2200-2700 K), Wessex isn't: not the same spec |
| Philips LED 9.5W E27 1055lm vs Sylvania ToLEDo 9W E27 1055lm (Toolstation) | Different colour temperature (2700 K against 6500 K) |
| Duracell +100% Plus Power C and D 2-packs vs GP Ultra C and D (Toolstation) | D saving 10%; the Duracell C 2-pack is a clearance line out of stock for delivery; GP's D page lists its type as C |
| Duracell Plus Power AA vs Duracell Procell Constant AA (Toolstation, GBP 10.99 / 7.35 for 10) | A different Duracell line, not the same product; left for a same-maker record once Procell's spec is read |
| Aico Ei208 vs FireAngel FA3820 carbon monoxide alarms (Toolstation) | 4.7% saving |
| Masterplug extension leads (Toolstation) | Only one brand stocked, nothing to compare |
| Soudal expanding foams (Toolstation) | Only one brand stocked |
| Energizer 357 3-pack vs Maxell 357 (Battery Junction) | Maxell dearer per cell |
| Duracell MN1500 bulk vs Coppertop 4-card (Battery Junction) | Same maker; the bulk page doesn't say it is the same cell as the retail Coppertop, and gives a 7-year shelf life against 10 |
| Anything at Viking Direct | Product pages showed no price to the fetch tool on 14 Nov |
| Monoprice cables | Monoprice sells its own brand; no brand-name cable could be priced at a readable US store to compare with |

## Stores read, and what to do about them

Verdicts and quotes are in `R10-source-verdicts.json`. In short:

- **Usable (ok)**: toolstation.com (GB, re-read), batteryjunction.com (US, new), monoprice.com (US, new, no swaps yet),
  viking-direct.co.uk (GB, re-read; prices not visible this round).
- **Barred by their terms**: CVS, Walgreens, Kroger and its banners, H-E-B, Vitacost, Publix, Zoro, Best Buy
  (secondary source), CPC Farnell, Chemist4U, The Independent Pharmacy, Ocado (robots bar the terms page itself).
- **Unknown, so treated as barred**: Staples, Office Depot, B&H, Micro Center, Newegg, Ace Hardware, Screwfix,
  Rowlands Pharmacy, MyPharmacy, Hunt Office, Ebuyer. Most refused the fetch tool or showed only navigation.

Every large US pharmacy and grocer we read bars automated reading or limits use to personal, non-commercial
shopping. So do the UK online pharmacies. There is no readable route to medicine prices in either market today, which
is why nothing here is a medicine. The licensed route is a feed: Walgreens and CVS run affiliate programmes
(not looked up this round), and Boots and Superdrug are on Awin (R9).

### Programmes worth joining for these stores

- **Toolstation** (28 GB swaps now, all ok). `data/sellers/programmes.json` still has it as unknown: an Awin listing
  was not found, and only third-party directories mention a programme. Worth the owner asking Toolstation's affiliate
  team directly (its parent, Travis Perkins, advertises an affiliate programme at travisperkins.co.uk). It is now the
  biggest UK store with readable prices.
- **Battery Junction** (11 US swaps, all ok). No programme found; added to `programmes.json` as unknown. Low value per
  click (baskets of a few dollars), so only worth it through a sub-network such as Skimlinks or Sovrn.
- **Viking Direct**: on Partnerize by `affiliate-programs.ts`, unconfirmed (R9). Its 17 swaps rest on prices we can no
  longer read; a feed would keep them fresh.

## Shared files touched

- `data/sellers/programmes.json`: one entry added, `batteryjunction` (unknown).
- `scripts/prices/licence.ts`: `R10-source-verdicts.json` added to `VERDICT_FILES`, and the comment above it.

## Notes

- Battery Junction's product pages carried quantity tiers; every price used is the single-unit price shown first.
- Panasonic's CR2016 page gives its shelf life as 5 years in one place and 10 in another; the record says so and
  compares no shelf life.
- One Duracell CR2025 page at Toolstation lists the CR2016 maker's code (DLCR2016B2); the record notes it.

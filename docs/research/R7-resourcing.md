# R7: re-sourcing the catalogue onto sources we may read

Written 13 Nov 2026. It covers every swap that rested on a store whose terms bar automated reading, before or after this
round, and says what happened to it. The owner uses the last two tables to decide which affiliate programmes to join first.

## How the counts are made

A swap's source bucket follows `scripts/qa/source_audit.ts`: each side counts as the host of its link (a record citing Open
Prices counts as Open Prices on both sides), and the verdict for that host comes from `R4-source-verdicts.json`, then
`R5-source-verdicts.json`, then `R7-source-verdicts.json` (later files win). A swap is **barred** if either side is barred,
**ok** if both are ok, and **unclear** otherwise. Freshness is the tier the catalogue build gives each swap
(`src/lib/freshness.ts`) on 13 Nov 2026.

| | Before (R4 + R5 verdicts) | After (R4 + R5 + R7 verdicts) |
|---|---:|---:|
| fresh / recent / ageing / stale | 283 / 26 / 55 / 94 | 283 / 27 / 54 / 94 |
| ok / unclear / barred | 129 / 113 / 216 | 169 / 59 / 230 |
| fresh and ok | 45 | 85 |
| fresh or recent, and ok | 53 | 94 |
| GTIN on both sides | 144 | 145 |

With R4's verdicts alone (the starting figures in the brief) the split was 106 ok, 189 unclear, 163 barred; it is now
114 ok, 189 unclear, 155 barred.

What moved the numbers:

- **R7 verdicts.** myTime.de's imprint and AGB were read and contain no clause on reuse or automated access, and its robots
  allow product pages, so its 32 swaps become ok. Apple, Anker and Uline turned out to bar automated reading, so 22 swaps
  move from unclear to barred. That is a truer picture, not a worse catalogue.
- **Re-sourced to APONEO** (ok since R4): seven German pharmacy swaps, from Shop Apotheke, DocMorris and
  medikamente-per-klick. Prices, PZNs, makers and inactive ingredients were re-read on APONEO. Ratings read on Shop
  Apotheke were taken off, and aspects that only a barred page supported were dropped or restated from APONEO.
- **Re-sourced to Alternate** (ok since R4): the Varta Longlife Power vs Intenso Energy Ultra AA 40-pack, matched by the same
  EANs, which are now in the record. Its Pollin rating was removed from `data/evidence/ratings*.json`.
- **Open Prices.** Every barcode on a stale or ageing swap (208) was asked for prices from the last 60 days. Only 18 usable
  readings came back, and only one swap (Dave's Killer Bread vs Simply Nature Seedtastic) got a current reading on both
  sides; it moved from ageing to recent. The other stale and ageing swaps stay as they were: no allowed source prices them.

Two re-sourcing checks found the same packs at an allowed store, but a price had moved more than 35%, so the price watch
sent them to `data/prices/review.json` rather than applying them (see the table). No swap's saving fell under 5%, so none was
withdrawn.

## Per swap

| Market | Swap | Aisle | Barred source(s) | What happened | Licensed route for what stays barred |
|---|---|---|---|---|---|
| DE | `aspirin-vs-ass-500-1a-pharma-de` | otc-medicine | shop-apotheke.com | Moved to aponeo.de (both sides) | n/a |
| DE | `avene-sonnenmilch-dry-touch-vs-dm-sundance-sonnenmilch-lsf-50-de` | skincare-personal-care | shop-apotheke.com | No allowed source found for the brand: aponeo.de lists Avène Sonnenmilch SPF 50 250 ml, not the Dry Touch line. | shop-apotheke.com: Awin (Shop Apotheke DE profile, seen in search, not opened) |
| DE | `ben-u-ron-vs-paracetamol-adgc-500mg-de` | otc-medicine | shop-apotheke.com | aponeo.de has both packs, but both prices are over 35% above the record's (4.99 and 1.39 EUR): in review `8988c42bf7`. Accepted after a second read on 13 Nov 2026 (wave 4): both links on aponeo.de, the Shop Apotheke rating and the claims only that store supported removed. | shop-apotheke.com: Awin (Shop Apotheke DE profile, seen in search, not opened) |
| DE | `blend-a-med-3d-white-luxe-charcoal-vs-lidl-dentalux-seidenweiss-de` | skincare-personal-care | rossmann.de | Not re-sourced (not searched in this round) | rossmann.de: None open (affi.io: Webgains and Affilinet programmes closed) |
| DE | `catsan-ultra-plus-vs-biokats-micro-classic-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `dolormin-extra-vs-ibu-lysin-1a-pharma-400mg-de` | otc-medicine | shop-apotheke.com | Moved to aponeo.de (both sides) | n/a |
| DE | `duracell-electronics-cr2032-vs-intenso-cr2032-de` | batteries | pollin.de | No allowed source found: alternate.de has no Intenso CR2032 6-pack. | pollin.de: Awin (Pollin Electronic DE profile, seen in search, not opened) |
| DE | `duracell-plus-aa-vs-aldi-activ-energy-aa-de` | batteries | rossmann.de | Not re-sourced (not searched in this round) | rossmann.de: None open (affi.io: Webgains and Affilinet programmes closed) |
| DE | `duracell-plus-c-vs-ansmann-alkaline-c-de` | batteries | pollin.de | No allowed source found: alternate.de has no Duracell Plus C 4-pack. | pollin.de: Awin (Pollin Electronic DE profile, seen in search, not opened) |
| DE | `duracell-plus-d-vs-ansmann-alkaline-d-de` | batteries | pollin.de | No allowed source found: alternate.de has no Duracell Plus D 4-pack. | pollin.de: Awin (Pollin Electronic DE profile, seen in search, not opened) |
| DE | `duracell-plus-power-boost-aa-vs-ansmann-alkaline-aa-de` | batteries | pollin.de | No allowed source found: alternate.de lists an Ansmann Alkaline Red 20-pack, not the same product as the record's box set. | pollin.de: Awin (Pollin Electronic DE profile, seen in search, not opened) |
| DE | `fa-empowering-moments-vs-lidl-cien-duschgel-pure-frische-de` | skincare-personal-care | rossmann.de | Not re-sourced (not searched in this round) | rossmann.de: None open (affi.io: Webgains and Affilinet programmes closed) |
| DE | `frosch-all-in-1-spuel-tabs-vs-rossmann-domol-ultra-power-de` | household | rossmann.de | Not re-sourced (not searched in this round) | rossmann.de: None open (affi.io: Webgains and Affilinet programmes closed) |
| DE | `hills-science-plan-adult-huhn-vs-concept-for-life-all-cats-adult-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `imodium-akut-vs-loperamid-abz-akut-2mg-de` | otc-medicine | shop-apotheke.com | Moved to aponeo.de (both sides) | n/a |
| DE | `lavera-pflegedusche-vitalisierend-vs-dm-alverde-pflegedusche-de` | skincare-personal-care | rossmann.de | Not re-sourced (not searched in this round) | rossmann.de: None open (affi.io: Webgains and Affilinet programmes closed) |
| DE | `nivea-volume-wonder-vs-dm-balea-volumen-shampoo-de` | beauty-hair | rossmann.de | Not re-sourced (not searched in this round) | rossmann.de: None open (affi.io: Webgains and Affilinet programmes closed) |
| DE | `nurofen-vs-ibu-ratiopharm-400mg-de` | otc-medicine | shop-apotheke.com | Moved to aponeo.de (both sides) | n/a |
| DE | `oral-b-professional-sensitiv-pro-vs-kaufland-bevola-sensitive-de` | skincare-personal-care | rossmann.de | No allowed source found for the brand: aponeo.de lists Oral-B Professional Zahnfleisch & -schmelz, not Sensitiv Pro. | rossmann.de: None open (affi.io: Webgains and Affilinet programmes closed) |
| DE | `otriven-vs-nasenspray-sine-al-0-1-de` | otc-medicine | shop-apotheke.com | No allowed source found: aponeo.de lists both, but its Otriven page showed no price on 13 Nov 2026. | shop-apotheke.com: Awin (Shop Apotheke DE profile, seen in search, not opened) |
| DE | `panasonic-eneloop-2000-aa-vs-varta-56706-2100-aa-de` | batteries | pollin.de | Not re-sourced (not searched in this round) | pollin.de: Awin (Pollin Electronic DE profile, seen in search, not opened) |
| DE | `panasonic-eneloop-2500-aa-vs-varta-5716-2600-aa-de` | batteries | pollin.de | Not re-sourced (not searched in this round) | pollin.de: Awin (Pollin Electronic DE profile, seen in search, not opened) |
| DE | `pantene-volumen-pur-vs-dm-balea-volumen-shampoo-de` | beauty-hair | rossmann.de | Not re-sourced (not searched in this round) | rossmann.de: None open (affi.io: Webgains and Affilinet programmes closed) |
| DE | `royal-canin-indoor-27-vs-concept-for-life-indoor-cats-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `royal-canin-instinctive-in-gelee-vs-felix-so-gut-wie-es-aussieht-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `royal-canin-kitten-vs-concept-for-life-kitten-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `royal-canin-maxi-adult-vs-concept-for-life-large-adult-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `royal-canin-maxi-puppy-vs-concept-for-life-large-puppy-junior-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `royal-canin-medium-adult-vs-4paws-sunny-hills-softbrocken-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `royal-canin-medium-adult-vs-josera-daily-menu-adult-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `royal-canin-mini-adult-8-vs-concept-for-life-mini-senior-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `royal-canin-mini-adult-vs-concept-for-life-mini-adult-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `royal-canin-sterilised-37-vs-concept-for-life-sterilised-lachs-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `sebamed-wellness-dusche-vs-mueller-aveo-pflegedusche-de` | skincare-personal-care | rossmann.de | No allowed source found for the brand: aponeo.de lists Sebamed Wellness Dusche only as 400 ml, not the record's 200 ml. | rossmann.de: None open (affi.io: Webgains and Affilinet programmes closed) |
| DE | `sensodyne-sensitivitaet-zahnfleisch-vs-kaufland-bevola-sensitive-de` | skincare-personal-care | rossmann.de | No allowed source found for the brand: aponeo.de lists other Sensodyne lines, not Sensitivität & Zahnfleisch. | rossmann.de: None open (affi.io: Webgains and Affilinet programmes closed) |
| DE | `sheba-filets-huhn-vs-miamor-feine-filets-huhn-pur-de` | pet | zooplus.de | Not re-sourced (not searched in this round) | zooplus.de: Awin (zooplus affiliate page: daily CSV product data) |
| DE | `syoss-intense-volume-vs-dm-balea-volumen-shampoo-de` | beauty-hair | rossmann.de | Not re-sourced (not searched in this round) | rossmann.de: None open (affi.io: Webgains and Affilinet programmes closed) |
| DE | `thomapyrin-classic-vs-dolopyrin-al-de` | otc-medicine | docmorris.de, shop-apotheke.com | Moved to aponeo.de (both sides) | n/a |
| DE | `varta-aa-vs-dm-paradies-aa-de` | batteries | rossmann.de | Not re-sourced (not searched in this round) | rossmann.de: None open (affi.io: Webgains and Affilinet programmes closed) |
| DE | `varta-energy-aa-30-vs-ansmann-alkaline-aa-20-de` | batteries | pollin.de | No allowed source found: alternate.de lists an Ansmann Alkaline Red 20-pack, not the record's box set. | pollin.de: Awin (Pollin Electronic DE profile, seen in search, not opened) |
| DE | `varta-longlife-power-9v-vs-ansmann-industrial-9v-de` | batteries | pollin.de | Not re-sourced (not searched in this round) | pollin.de: Awin (Pollin Electronic DE profile, seen in search, not opened) |
| DE | `varta-longlife-power-aa-40-vs-intenso-energy-ultra-aa-40-de` | batteries | pollin.de | Moved to alternate.de (both sides, same EANs) | n/a |
| DE | `varta-longlife-power-aaa-40-vs-intenso-energy-ultra-aaa-40-de` | batteries | pollin.de | alternate.de has both packs (EAN 4008496987924, 4034303027415), but Intenso is 50% above the record (8.99 EUR): in review `7c66ba2e66`. Accepted after a second read on 13 Nov 2026 (wave 4): both links on alternate.de; the storage-life row and the 100-pack, which only pollin supported, removed. | pollin.de: Awin (Pollin Electronic DE profile, seen in search, not opened) |
| DE | `voltaren-forte-vs-diclox-forte-gel-de` | otc-medicine | medikamente-per-klick.de, shop-apotheke.com | Moved to aponeo.de (both sides) | n/a |
| DE | `zovirax-vs-acic-lippenherpescreme-5-de` | otc-medicine | shop-apotheke.com | Moved to aponeo.de (both sides) | n/a |
| GB | `ariel-original-powder-vs-aldi-almat-bio-powder-gb` | household | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `ariel-original-powder-vs-sainsburys-bio-powder-gb` | household | sainsburys.co.uk, tesco.com | Not re-sourced (not searched in this round) | sainsburys.co.uk: None open (affi.io: the Sainsbury's grocery programme on Partnerize is closed); tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `aunt-bessies-beef-dripping-yorkshires-vs-aldi-specially-selected-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `baxters-cream-of-tomato-soup-vs-tesco-cream-of-tomato-soup-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `beconase-vs-tesco-health-hayfever-relief-beclometasone-nasal-spray-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `brabantia-perfectfit-code-m-vs-sainsburys-tie-top-refuse-sacks-60l-gb` | household | sainsburys.co.uk | Not re-sourced (not searched in this round) | sainsburys.co.uk: None open (affi.io: the Sainsbury's grocery programme on Partnerize is closed) |
| GB | `calpol-infant-vs-tesco-health-paracetamol-120mg-5ml-suspension-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `clarityn-vs-tesco-health-loratadine-10mg-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `duracell-recharge-ultra-aa-2500mah-vs-ikea-ladda-aa-2450mah-gb` | batteries | ikea.com | Not re-sourced (not searched in this round) | ikea.com: not checked |
| GB | `fairy-max-power-eucalyptus-vs-aldi-magnum-original-gb` | household | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `fairy-max-power-original-vs-aldi-magnum-original-gb` | household | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `fairy-max-power-original-vs-sainsburys-original-washing-up-liquid-gb` | household | sainsburys.co.uk, tesco.com | Not re-sourced (not searched in this round) | sainsburys.co.uk: None open (affi.io: the Sainsbury's grocery programme on Partnerize is closed); tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `fairy-original-vs-asda-original-washing-up-liquid-gb` | household | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `fairy-original-vs-lidl-w5-original-washing-up-liquid-gb` | household | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `fairy-original-vs-sainsburys-original-washing-up-liquid-gb` | household | sainsburys.co.uk, tesco.com | Not re-sourced (not searched in this round) | sainsburys.co.uk: None open (affi.io: the Sainsbury's grocery programme on Partnerize is closed); tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `fairy-original-washing-up-liquid-vs-aldi-magnum-original-gb` | household | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `felco-2-vs-darlac-expert-bypass-pruner-gb` | garden | crocus.co.uk | Not re-sourced (not searched in this round) | crocus.co.uk: Awin (Crocus profile, seen in search, not opened) |
| GB | `finish-powerball-ultimate-all-in-one-vs-aldi-magnum-premium-gb` | household | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `finish-powerball-ultimate-all-in-one-vs-asda-ultimate-all-in-one-citrus-gb` | household | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `finish-powerball-ultimate-all-in-one-vs-lidl-w5-all-in-one-gb` | household | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `finish-powerball-ultimate-all-in-one-vs-sainsburys-ultimate-all-in-one-gb` | household | sainsburys.co.uk, tesco.com | Not re-sourced (not searched in this round) | sainsburys.co.uk: None open (affi.io: the Sainsbury's grocery programme on Partnerize is closed); tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `finish-powerball-ultimate-plus-vs-tesco-ultra-lemon-gb` | household | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `gaviscon-original-vs-tesco-health-heartburn-indigestion-liquid-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `haagen-dazs-vanilla-vs-aldi-specially-selected-madagascan-vanilla-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `heineken-0-0-vs-lidl-perlenbacher-0-0-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `heinz-beanz-vs-aldi-bramwells-baked-beans-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `heinz-cream-of-tomato-soup-vs-sainsburys-cream-of-tomato-soup-gb` | food-pantry | sainsburys.co.uk, tesco.com | Not re-sourced (not searched in this round) | sainsburys.co.uk: None open (affi.io: the Sainsbury's grocery programme on Partnerize is closed); tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `heinz-tomato-ketchup-vs-co-op-on-the-side-ketchup-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `heinz-tomato-ketchup-vs-waitrose-essential-ketchup-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `hellmanns-real-mayonnaise-vs-sainsburys-real-mayo-gb` | food-pantry | sainsburys.co.uk, tesco.com | Not re-sourced (not searched in this round) | sainsburys.co.uk: None open (affi.io: the Sainsbury's grocery programme on Partnerize is closed); tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `hotel-chocolat-classic-70-vs-tesco-finest-70-dark-hot-chocolate-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `huggies-pure-0-plastic-vs-sainsburys-little-ones-sensitive-wipes-gb` | baby | sainsburys.co.uk | Not re-sourced (not searched in this round) | sainsburys.co.uk: None open (affi.io: the Sainsbury's grocery programme on Partnerize is closed) |
| GB | `imodium-original-vs-tesco-health-loperamide-2mg-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `lemsip-max-all-in-one-vs-tesco-health-max-strength-all-in-one-capsules-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `lemsip-max-cold-flu-capsules-vs-tesco-max-strength-cold-flu-capsules-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `lurpak-spreadable-vs-aldi-nordpak-spreadable-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `melcourt-sylvagrow-ericaceous-15l-vs-rocketgro-ericaceous-40l-gb` | garden | crocus.co.uk | Not re-sourced (not searched in this round) | crocus.co.uk: Awin (Crocus profile, seen in search, not opened) |
| GB | `melcourt-sylvagrow-john-innes-no2-22l-vs-john-innes-peat-free-no2-28l-gb` | garden | crocus.co.uk | Not re-sourced (not searched in this round) | crocus.co.uk: Awin (Crocus profile, seen in search, not opened) |
| GB | `melcourt-sylvagrow-john-innes-no3-22l-vs-john-innes-peat-free-no3-28l-gb` | garden | crocus.co.uk | Not re-sourced (not searched in this round) | crocus.co.uk: Awin (Crocus profile, seen in search, not opened) |
| GB | `melcourt-sylvagrow-multi-purpose-40l-vs-boost-peat-free-46l-gb` | garden | crocus.co.uk | Not re-sourced (not searched in this round) | crocus.co.uk: Awin (Crocus profile, seen in search, not opened) |
| GB | `nescafe-gold-blend-vs-aldi-alcafe-gold-roast-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `nurofen-for-children-vs-tesco-health-ibuprofen-100mg-5ml-suspension-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `nurofen-soft-capsules-vs-tesco-health-ibuprofen-liquid-capsules-200mg-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `nurofen-vs-tesco-health-ibuprofen-200mg-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `nuromol-vs-galpharm-ibuprofen-paracetamol-200-500mg-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `nutella-vs-tesco-hazelnut-chocolate-spread-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `pampers-baby-dry-size-4-vs-tesco-fred-and-flo-ultra-dry-size-4-gb` | baby | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `pampers-harmonie-aqua-vs-tesco-fred-and-flo-biodegradable-wipes-gb` | baby | boots.com, tesco.com | Not re-sourced (not searched in this round) | boots.com: not checked; tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `panadol-advance-vs-tesco-health-paracetamol-500mg-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `panadol-extra-advance-vs-tesco-paracetamol-extra-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `persil-bio-powder-vs-sainsburys-bio-powder-gb` | household | sainsburys.co.uk | Not re-sourced (not searched in this round) | sainsburys.co.uk: None open (affi.io: the Sainsbury's grocery programme on Partnerize is closed) |
| GB | `persil-bio-powder-vs-tesco-tropical-sunshine-bio-powder-gb` | household | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `pg-tips-original-vs-sainsburys-red-label-tea-bags-gb` | food-pantry | sainsburys.co.uk, tesco.com | Not re-sourced (not searched in this round) | sainsburys.co.uk: None open (affi.io: the Sainsbury's grocery programme on Partnerize is closed); tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `piriteze-vs-tesco-health-cetirizine-10mg-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `tetley-original-vs-morrisons-everyday-tea-bags-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `tims-dairy-greek-yogurt-vs-aldi-brooklea-greek-style-yogurt-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `vitax-q4-vs-growmore-general-fertiliser-gb` | garden | crocus.co.uk | Not re-sourced (not searched in this round) | crocus.co.uk: Awin (Crocus profile, seen in search, not opened) |
| GB | `waterwipes-original-vs-superdrug-my-little-star-biodegradable-pure-gb` | baby | boots.com, superdrug.com | Not re-sourced (not searched in this round) | boots.com: not checked; superdrug.com: not checked |
| GB | `yorkshire-tea-vs-waitrose-essential-original-blend-tea-bags-gb` | food-pantry | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| GB | `zovirax-vs-tesco-health-aciclovir-cold-sore-cream-5-gb` | otc-medicine | tesco.com | Not re-sourced (not searched in this round) | tesco.com: FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| IE | `gourmet-gold-pate-recipes-vs-whiskas-1-plus-adult-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `hills-science-plan-adult-chicken-vs-concept-for-life-all-cats-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `hills-science-plan-adult-medium-vs-eukanuba-adult-medium-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `pedigree-adult-classic-vs-rocco-classic-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `royal-canin-indoor-vs-concept-for-life-indoor-cats-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `royal-canin-instinctive-in-jelly-vs-felix-as-good-as-it-looks-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `royal-canin-kitten-vs-purina-one-junior-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `royal-canin-maxi-adult-vs-concept-for-life-large-adult-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `royal-canin-maxi-puppy-vs-concept-for-life-large-puppy-junior-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `royal-canin-medium-adult-vs-josera-daily-menu-adult-duck-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `royal-canin-mini-adult-8-vs-concept-for-life-mini-senior-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `royal-canin-mini-adult-in-gravy-vs-pedigree-pouch-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `royal-canin-mini-adult-vs-concept-for-life-mini-adult-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `royal-canin-regular-fit-vs-smilla-adult-poultry-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `royal-canin-sensible-vs-sanabelle-sensitive-chicken-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `royal-canin-sterilised-37-vs-concept-for-life-sterilised-salmon-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `whiskas-1-plus-adult-vs-felix-as-good-as-it-looks-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| IE | `worlds-best-multiple-cat-vs-super-benek-corn-cat-ie` | pet | zooplus.ie | Not re-sourced (not searched in this round) | zooplus.ie: Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| US | `3m-spray-silicone-lubricant-vs-uline-silicone-lubricant` | tools-diy | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `409-cleaner-degreaser-vs-uline-2in1-cleaner-disinfectant` | household | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `aleve-vs-equate-naproxen-sodium-220mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `aleve-vs-members-mark-naproxen-sodium-220mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `allegra-vs-equate-fexofenadine-180mg` | otc-medicine | business.walmart.com, walmart.com | Not re-sourced (not searched in this round) | business.walmart.com: Walmart Affiliates on Impact (not confirmed for Walmart Business); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `allegra-vs-members-mark-fexofenadine-180mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `apple-140w-power-adapter-vs-anker-140w-4-port-pd-3-1` | tech-tools | anker.com, apple.com | Not re-sourced (not searched in this round) | anker.com: not checked; apple.com: not checked |
| US | `apple-20w-usb-c-power-adapter-vs-anker-nano-20w` | tech-tools | anker.com, apple.com | Not re-sourced (not searched in this round) | anker.com: not checked; apple.com: not checked |
| US | `apple-240w-usb-c-charge-cable-2m-vs-anker-240w-usb-c-cable-6ft` | tech-tools | anker.com, apple.com | Not re-sourced (not searched in this round) | anker.com: not checked; apple.com: not checked |
| US | `apple-30w-usb-c-power-adapter-vs-anker-nano-charger-30w` | tech-tools | target.com, walmart.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `apple-40w-dynamic-power-adapter-vs-anker-nano-45w` | tech-tools | anker.com, apple.com | Not re-sourced (not searched in this round) | anker.com: not checked; apple.com: not checked |
| US | `apple-70w-power-adapter-vs-anker-nano-70w-3-port` | tech-tools | anker.com, apple.com | Not re-sourced (not searched in this round) | anker.com: not checked; apple.com: not checked |
| US | `apple-96w-usb-c-power-adapter-vs-onn-100w-gan-laptop-charger` | tech-tools | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `apple-airtag-4-pack-vs-chipolo-one-spot-4-pack` | tech-tools | apple.com | Not re-sourced (not searched in this round) | apple.com: not checked |
| US | `apple-magic-keyboard-usb-c-vs-logitech-pebble-keys-2-k380s` | tech-tools | apple.com | Not re-sourced (not searched in this round) | apple.com: not checked |
| US | `apple-pencil-usb-c-vs-logitech-crayon-usb-c` | tech-tools | apple.com | Not re-sourced (not searched in this round) | apple.com: not checked |
| US | `apple-usb-c-digital-av-multiport-adapter-vs-ugreen-7-in-1-usb-c-hub` | tech-tools | apple.com | Not re-sourced (not searched in this round) | apple.com: not checked |
| US | `aquaphor-baby-vs-equate-advanced-healing-ointment` | baby | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `aquaphor-healing-ointment-vs-equate-advanced-healing-ointment` | skincare-personal-care | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `belkin-boostcharge-20w-lightning-kit-vs-onn-20w-lightning-kit` | tech-tools | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `benadryl-vs-equate-diphenhydramine-25mg` | otc-medicine | business.walmart.com, walmart.com | Not re-sourced (not searched in this round) | business.walmart.com: Walmart Affiliates on Impact (not confirmed for Walmart Business); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `benefiber-vs-up-up-clear-dissolving-fiber-17-6oz` | supplements | target.com, walmart.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `bounty-select-a-size-vs-uline-deluxe-easy-size-paper-towels` | household | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `caltrate-600-d3-vs-spring-valley-calcium-600-d3` | supplements | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `cascade-platinum-vs-kirkland-ultrashine-dishwasher-pacs` | household | costco.com, walmart.com | Not re-sourced (not searched in this round) | costco.com: not checked; walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `centrum-silver-adults-50-vs-equate-complete-multivitamin-adults-50` | supplements | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `cerave-acne-control-cleanser-vs-up-and-up-salicylic-acid-acne-wash` | skincare-personal-care | target.com, walmart.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `cerave-acne-foaming-cream-cleanser-vs-up-and-up-benzoyl-peroxide-4-cleanser` | skincare-personal-care | target.com, walmart.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `cerave-moisturizing-cream-vs-equate-moisturizing-cream-ceramides` | skincare-personal-care | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `charmin-ultra-soft-vs-uline-ultra-toilet-tissue` | household | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `childrens-motrin-vs-equate-childrens-ibuprofen` | baby | target.com, walmart.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `childrens-tylenol-vs-equate-childrens-acetaminophen` | baby | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `citracal-petites-vs-equate-calcium-citrate-d3-petites` | supplements | target.com, walmart.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `claritin-vs-equate-loratadine-10mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `clorox-disinfecting-wipes-lemon-vs-uline-disinfecting-wipes` | household | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `colace-vs-equate-stool-softener-docusate-100mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `cortizone-10-vs-equate-hydrocortisone-1-percent` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `crest-pro-health-advanced-deep-clean-vs-equate-pro-advanced-toothpaste` | skincare-personal-care | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `dawn-liquid-dish-soap-vs-uline-liquid-dish-soap` | household | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `differin-vs-glenmark-adapalene-gel-0-1` | skincare-personal-care | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `domino-vs-great-value-granulated-sugar-4lb` | food-pantry | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `dulcolax-vs-equate-gentle-laxative-bisacodyl-5mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `duracell-coppertop-aa-vs-kirkland-signature-aa` | tech-tools | costco.com | Not re-sourced (not searched in this round) | costco.com: not checked |
| US | `duracell-coppertop-aaa-vs-kirkland-signature-aaa` | tech-tools | costco.com | Not re-sourced (not searched in this round) | costco.com: not checked |
| US | `emergen-c-immune-plus-vs-equate-vitamin-c-d-zinc-packets` | supplements | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `enfamil-gentlease-vs-parents-choice-gentle-formula` | baby | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `excedrin-extra-strength-vs-equate-extra-strength-headache-relief` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `filtrete-1000-mpr-merv-11-vs-simply-merv-11-16x25x1` | tech-tools | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `finish-quantum-vs-kirkland-ultrashine-dishwasher-pacs` | household | costco.com | Not re-sourced (not searched in this round) | costco.com: not checked |
| US | `flonase-vs-equate-fluticasone-50mcg` | otc-medicine | business.walmart.com, walmart.com | Not re-sourced (not searched in this round) | business.walmart.com: Walmart Affiliates on Impact (not confirmed for Walmart Business); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `frontline-plus-cats-vs-petarmor-plus-cats` | pet | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `frontline-plus-vs-petarmor-plus-dogs-23-44-lbs` | pet | chewy.com, walmart.com | Not re-sourced (not searched in this round) | chewy.com: Impact (chewy.com/app/content/affiliate); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `frontline-plus-vs-petarmor-plus-dogs-45-88-lbs` | pet | chewy.com, walmart.com | Not re-sourced (not searched in this round) | chewy.com: Impact (chewy.com/app/content/affiliate); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `frontline-plus-vs-petarmor-plus-dogs-5-22-lbs` | pet | chewy.com, walmart.com | Not re-sourced (not searched in this round) | chewy.com: Impact (chewy.com/app/content/affiliate); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `frontline-plus-vs-petarmor-plus-dogs-89-132-lbs` | pet | chewy.com, walmart.com | Not re-sourced (not searched in this round) | chewy.com: Impact (chewy.com/app/content/affiliate); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `frontline-plus-vs-sentry-fiproguard-plus-dogs-45-88-lbs` | pet | chewy.com, walmart.com | Not re-sourced (not searched in this round) | chewy.com: Impact (chewy.com/app/content/affiliate); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `glad-forceflex-fresh-13-gallon-vs-uline-max-flex-fresh-13-gallon` | household | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `glad-forceflex-vs-kirkland-flex-tech-13-gallon` | household | costco.com, walmart.com | Not re-sourced (not searched in this round) | costco.com: not checked; walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `gold-bond-extra-strength-powder-vs-equate-extra-strength-body-powder` | skincare-personal-care | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `gorilla-duct-tape-vs-uline-heavy-duty-duct-tape` | tools-diy | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `head-and-shoulders-2-in-1-classic-clean-vs-equate-2-in-1-dandruff` | beauty-hair | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `head-and-shoulders-classic-clean-vs-equate-everyday-clean-dandruff-shampoo` | beauty-hair | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `head-and-shoulders-clinical-strength-vs-equate-selenium-sulfide-shampoo` | beauty-hair | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `heinz-vs-great-value-distilled-white-vinegar-gallon` | food-pantry | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `k9-advantix-ii-vs-advecta-3-dogs-over-55-lbs` | pet | chewy.com, walmart.com | Not re-sourced (not searched in this round) | chewy.com: Impact (chewy.com/app/content/affiliate); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `le-creuset-signature-5-5-qt-vs-lodge-6-qt-enameled-dutch-oven` | kitchen | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `listerine-cool-mint-vs-equate-antiseptic-blue-mint-1-5l` | skincare-personal-care | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `listerine-original-vs-equate-antiseptic-original-1-5l` | skincare-personal-care | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `lysol-toilet-bowl-cleaner-vs-uline-toilet-bowl-cleaner` | household | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `mccormick-vs-good-and-gather-garlic-powder-3-12oz` | food-pantry | target.com, walmart.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `mccormick-vs-good-and-gather-ground-black-pepper-3oz` | food-pantry | target.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript) |
| US | `mccormick-vs-good-and-gather-ground-cinnamon-2-37oz` | food-pantry | target.com, walmart.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `mechanix-original-vs-uline-utility-gloves` | tools-diy | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `mens-rogaine-5-solution-vs-equate-minoxidil-5-solution` | beauty-hair | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `mens-rogaine-foam-vs-kirkland-minoxidil-5-foam` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `metamucil-sugar-free-orange-vs-equate-psyllium-sugar-free-orange` | supplements | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `miralax-vs-equate-clearlax-peg-3350` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `miralax-vs-members-mark-clearlax-peg-3350` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `monistat-7-vs-equate-miconazole-7` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `mr-clean-magic-eraser-vs-uline-amazing-foam-eraser` | household | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `mucinex-vs-equate-mucus-relief-guaifenesin-600mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `mylicon-vs-equate-infant-gas-relief-drops-simethicone` | baby | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `nature-made-melatonin-5mg-vs-spring-valley-melatonin-5mg` | supplements | target.com, walmart.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `neutrogena-t-gel-extra-strength-vs-equate-extra-strength-coal-tar` | beauty-hair | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `nexium-24hr-vs-equate-esomeprazole-20mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `nicoderm-cq-step-1-vs-equate-nicotine-patch-21mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `oxiclean-versatile-vs-up-up-powder-stain-remover` | household | target.com, walmart.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `panoxyl-10-vs-equate-max-strength-acne-foaming-wash` | skincare-personal-care | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `pataday-once-daily-vs-equate-olopatadine-0-2` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `pedialyte-vs-parents-choice-electrolyte-solution-unflavored` | baby | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `pepcid-ac-maximum-strength-vs-equate-famotidine-20mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `plan-b-one-step-vs-my-way-levonorgestrel-1-5mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `prevacid-24hr-vs-equate-lansoprazole-15mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `prilosec-otc-vs-equate-omeprazole-20mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `prilosec-otc-vs-members-mark-omeprazole-20mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `quaker-old-fashioned-vs-great-value-old-fashioned-oats-42oz` | food-pantry | target.com, walmart.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `selsun-blue-medicated-vs-equate-medicated-dandruff-shampoo` | beauty-hair | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `sensodyne-extra-whitening-vs-equate-extra-whitening-sensitive-toothpaste` | skincare-personal-care | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `sensodyne-repair-protect-whitening-vs-equate-restore-defend-sensitive` | skincare-personal-care | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `similac-advance-vs-parents-choice-advantage-formula` | baby | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `similac-sensitive-vs-parents-choice-sensitivity-formula` | baby | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `softsoap-aloe-refill-vs-uline-aloe-hand-soap-refill` | skincare-personal-care | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `splenda-vs-great-value-sucralose-packets` | food-pantry | target.com, walmart.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `thorne-creatine-vs-nutricost-creatine-monohydrate` | supplements | target.com | Not re-sourced (not searched in this round) | target.com: Target Partners (its own programme; network not confirmed, FAQ needs JavaScript) |
| US | `tide-original-liquid-vs-kirkland-ultra-clean-liquid` | household | costco.com, walmart.com | Not re-sourced (not searched in this round) | costco.com: not checked; walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `tylenol-extra-strength-vs-equate-acetaminophen-500mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `vaseline-original-vs-equate-petroleum-jelly-13oz` | skincare-personal-care | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `voltaren-vs-equate-diclofenac-gel-1-percent` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `voltaren-vs-members-mark-diclofenac-gel-1` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `windex-glass-cleaner-vs-uline-glass-cleaner` | household | uline.com | Not re-sourced (not searched in this round) | uline.com: not checked |
| US | `womens-rogaine-2-solution-vs-equate-minoxidil-2-solution` | beauty-hair | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `zaditor-vs-equate-ketotifen-eye-drops` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `zyrtec-vs-equate-cetirizine-10mg` | otc-medicine | business.walmart.com, walmart.com | Not re-sourced (not searched in this round) | business.walmart.com: Walmart Affiliates on Impact (not confirmed for Walmart Business); walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `zyrtec-vs-kirkland-aller-tec-cetirizine-10mg` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| US | `zyrtec-vs-members-mark-cetirizine-10mg-400ct` | otc-medicine | walmart.com | Not re-sourced (not searched in this round) | walmart.com: Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |

### Still barred, by store

| Store | Swaps | Licensed route |
|---|---:|---|
| walmart.com | 88 | Walmart Affiliates on Impact (data feeds in the member centre, per affiliates.walmart.com/faqs) |
| tesco.com | 49 | FlexOffers or Sale Gains (affi.io lists Tesco Groceries open there; Awin closed, Impact inactive; no feed confirmed) |
| zooplus.ie | 18 | Awin (zooplus affiliate page: daily CSV product data); Maxi Zoo Ireland is also on Awin |
| target.com | 14 | Target Partners (its own programme; network not confirmed, FAQ needs JavaScript) |
| zooplus.de | 13 | Awin (zooplus affiliate page: daily CSV product data) |
| uline.com | 13 | not checked |
| rossmann.de | 12 | None open (affi.io: Webgains and Affilinet programmes closed) |
| sainsburys.co.uk | 10 | None open (affi.io: the Sainsbury's grocery programme on Partnerize is closed) |
| pollin.de | 9 | Awin (Pollin Electronic DE profile, seen in search, not opened) |
| apple.com | 9 | not checked |
| crocus.co.uk | 6 | Awin (Crocus profile, seen in search, not opened) |
| costco.com | 6 | not checked |
| chewy.com | 6 | Impact (chewy.com/app/content/affiliate) |
| anker.com | 5 | not checked |
| business.walmart.com | 4 | Walmart Affiliates on Impact (not confirmed for Walmart Business) |
| shop-apotheke.com | 3 | Awin (Shop Apotheke DE profile, seen in search, not opened) |
| boots.com | 2 | not checked |
| ikea.com | 1 | not checked |
| superdrug.com | 1 | not checked |

### Still barred, by network

A swap counts once per network it would need. "not checked" means no programme was looked up this round.

| Network | Swaps it would cover |
|---|---:|
| Impact | 88 |
| Awin | 49 |
| FlexOffers or Sale Gains | 49 |
| not checked | 31 |
| None open | 22 |
| Target Partners (network not confirmed) | 14 |

Rows: 238. Still barred: 230. Moved: 8.

## Reading the route column

- **Impact**: Walmart's affiliate programme runs on Impact and offers data feeds in its member centre
  (affiliates.walmart.com/faqs). Chewy's runs on Impact too (chewy.com/app/content/affiliate). Walmart alone would cover 88
  swaps, more than any other single programme.
- **Awin**: zooplus (DE, IE) publishes daily CSV product data to Awin affiliates (its affiliate page). Shop Apotheke DE,
  Pollin Electronic DE and Crocus showed up as Awin programme profiles in search; those pages were not opened. The price
  watch already reads Awin feeds (`scripts/prices/adapters/feed.ts`), so these are the cheapest to wire in.
- **FlexOffers or Sale Gains**: affi.io lists a Tesco Groceries programme as open on those two, with Tesco's Awin programme
  closed and its Impact one inactive. No product feed was confirmed, and the feed adapter has no reader for either yet.
- **None open**: Sainsbury's grocery programme (Partnerize) and Rossmann's (Webgains, Affilinet) are listed as closed.
- **not checked**: Uline, Apple, Costco, Anker, Boots, Superdrug and IKEA weren't looked up this round.

Network facts come from the networks' and stores' own pages where stated, otherwise from affi.io listings, read on
13 Nov 2026 through a summarising fetch tool. Check a programme's own page before joining it.

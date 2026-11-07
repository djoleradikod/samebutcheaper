# R3: price sources by market and product area

Date: 2026-11-06. This records which retailer pages can be read for a price and a pack size, and what their terms and
robots.txt say. Read-only scouts collected the tables. The lead spot-checked three USABLE terms pages. No bot check, rate
limit or geo-block was bypassed. This is not legal advice.

**No Canadian retailer report reached this document.** CA appears only in the Open Prices section. Treat CA retailers as
not scouted, which is different from scouted and found empty.

## How to read it

| Class | Meaning |
|---|---|
| USABLE | Price and pack readable, terms read, no clause found that bars automated reading. "Provisional" means one check is still open |
| UNCLEAR | Prices may be readable, but the terms or robots.txt were not read in full or not located |
| BARRED | Terms or robots.txt bar automated reading or copying |
| BLOCKED | The site refused or the page did not yield prices (GB and DE scouts also use this for pages with no prices) |
| NO-PRICE | Page opened, no per-item price (US scout only) |

- "None found" means a fetch tool that summarises with a small model reported no matching clause. It is not permission.
- Only the three pages in the next section were reopened by the lead. Every other cell is what a scout reported, including
  all clause quotes. Check a quote at source before relying on it.
- Each USABLE site was tested on one page, usually the homepage. Prices on other pages are untested.
- Paths in the DE table are relative to the site named in the row.

## Spot-check of three USABLE terms pages

Each page was opened with WebFetch on 2026-11-06. The raw visible text was then searched for robot, spider, scrap, crawl,
data mining, automat, harvest, reproduc, copy, and the German vervielf, auslesen and kopier.

| Site | Page | WebFetch outcome | Raw text search |
|---|---|---|---|
| Battery Junction (US) | https://www.batteryjunction.com/policies/terms-of-service | No clause. Terms appear complete | 1 hit: the copyright line |
| 7dayshop (GB) | https://www.7dayshop.com/terms | No clause. The IP section limits use of its logo and graphics, and says "The website may only be used for lawful purposes" | 5 hits: 4 in cart and product text, 1 copyright line |
| pollin.de (DE) | https://www.pollin.de/agb | No clause in §§ 1-11 or the footer. All 104,599 characters read across two calls | 2 hits: product category names |

Outcome: none of the three pages has a clause barring automated reading. The check covers these pages only. It does not
cover linked pages such as privacy policies, or sales terms kept elsewhere. Battery Junction's page is sales terms, so
its class stays provisional until the owner has reviewed it.

## US

Only Battery Junction is USABLE, provisionally. Run started 19:08 UTC.

| Site | Area | URL tested | Price and pack readable | Terms URL | Clause or "none found" | Class |
|---|---|---|---|---|---|---|
| Battery Junction | Batteries | https://www.batteryjunction.com/ | Yes: "Energizer ... LN91 ... 4 Pack Box" $11.80; "Rayovac Ultra Pro AL-AAA-24 ... 24 Pack" $10.50 | https://www.batteryjunction.com/policies/terms-of-service | None found (sales terms page only) | USABLE (provisional) |
| Uline | Cleaning, gloves, janitorial | https://www.uline.com/BL_1019/Cleaning-Supplies | Yes: nitrile gloves, 100 per carton, $17 and $15 (10+ tier) | https://www.uline.com/Terms | None found in summary; linked full PDF not read | UNCLEAR |
| buybuy BABY | Baby | https://buybuybaby.bedbathandbeyond.com/ | Yes: aden+anais 4-Pack swaddles $80.99; 22oz cooler $119.99 | https://buybuybaby.bedbathandbeyond.com/policies.html | Page returned a LinkShare affiliate agreement, not site terms; robots not read | UNCLEAR |
| PetSmart | Pet | https://www.petsmart.com/dog/food/ | Yes: wet dog food 12.5 oz $4.09, 10 oz $3.09 | https://www.petsmart.com/help/terms-and-conditions-H0010.html | "no part of the Site may be copied, reproduced, distributed, republished, downloaded"; "to download, copy, or collect content ... for the benefit of another merchant" | BARRED |
| Webstaurant | Kitchen, cleaning | https://www.webstaurantstore.com/ | Yes: "Oatly ... 12/Case" $39.99; "16 oz ... 1,000/Case" $57.99 | https://www.webstaurantstore.com/policies.html | "Use any robot, spider, or other automatic device, process, or means to access the Services for any purpose" | BARRED |
| Aldi US | Grocery (paper goods) | https://www.aldi.us/products/ | No: categories only | https://www.aldi.us/robots.txt (read) | robots.txt: wildcard group has "Disallow: /" | BARRED (robots) |
| Anker | Cables, chargers | https://www.anker.com/collections/chargers | No: prices only as filter ranges | Not opened | n/a | NO-PRICE |
| Best Buy | Cables | bestbuy.com search URL | No: country landing page only | Not opened | n/a | NO-PRICE |
| Tenergy | Batteries | https://www.tenergy.com/ | No: categories only | Not opened | n/a | NO-PRICE |
| Gardeners.com | Garden | https://www.gardeners.com/ | No: products without prices | Not opened | n/a | NO-PRICE |
| Great Ink | Printer supplies | https://www.greatink.com/ | Not a retailer (PR agency site) | Not opened | n/a | NO-PRICE |
| Chewy | Pet | /b/dry-dog-food-282 | 429 after retry | Not located (guessed URL 404) | n/a | BLOCKED |
| UGREEN | Cables | /collections/usb-c-cables | 429 after retry | Not opened | n/a | BLOCKED |
| Decathlon | Sport, outdoor | /collections/all-products | 429 after retry | Not opened | n/a | BLOCKED |
| EBL (eblofficial.com) | Batteries | Product URL from search | 429 on two URLs | Not opened | n/a | BLOCKED |
| Kroger | Grocery | /search?query=paper towels | Timeout on two attempts | Not opened | n/a | BLOCKED |
| Tractor Supply | Pet, garden, car | /tsc/catalog/motor-oil; homepage | Timeout | Not opened | n/a | BLOCKED |
| Advance Auto Parts | Car | shop.advanceautoparts.com | Timeout | Not opened | n/a | BLOCKED |
| Harbor Freight, Petco, B&H, Monoprice, Northern Tool, Newegg, Adorama, Tooltopia, Batteries Plus, Dollar General, CVS, BJ's, Meijer, Walgreens, Micro Center, Ace, Menards, O'Reilly, AutoZone, Grainger | Various | Homepage or category URLs | 403 (bot check) or error page | Not opened | n/a | BLOCKED |
| Sam's Club | Paper goods | /b/paper-towels/1342 | Bot-verification page | Not opened | n/a | BLOCKED |
| Office Depot | Office, printer | /cm/printers/ink-toner | "Not available in your country" | Not opened | n/a | BLOCKED |

Robots.txt was readable for Battery Junction, Uline, PetSmart, Webstaurant, Chewy, AutoZone and IKEA, and none blocks the
product or listing paths used. Many other robots files returned 403 and are not interpreted. Kroger's returned nothing.

Not verified:

- Uline's full terms PDF and buybuy's Terms of Use section.
- The PetSmart and Webstaurant clause quotes at source.
- Walmart, Target, Costco and Home Depot were not re-tested. R2 records them as barred or blocked.
- No consumer-magazine price with a date was found. The Consumer Reports index showed none.

Chewy and Uline are the most likely to need a feed or account route, or a dated manual check.

## GB

7dayshop is the only site that clears all three checks. Viking Direct and Crocus each have one check open. Run at
19:08 UTC. A 403 was not retried. Ebuyer timed out on three attempts.

| Site | Area | URL tested | Price and pack readable | Terms URL | Clause or "none found" | Class |
|---|---|---|---|---|---|---|
| 7dayshop | Cables, paint, bath | https://www.7dayshop.com/ | Yes (£19.99, "Pack of 5") | https://www.7dayshop.com/terms | None found | USABLE |
| Viking Direct | Office | https://www.viking-direct.co.uk/en/ | Yes (ex VAT, "pack of 5") | PDF on odeu.scene7.com (footer) | None in readable part; PDF partly unreadable | USABLE (provisional) |
| Crocus | Garden | https://www.crocus.co.uk/ | Yes (£12.99, "9cm pot", "2 litre pot") | https://www.crocus.co.uk/terms-and-conditions | None found | USABLE (provisional; robots `/wheelbarrow/` unclear) |
| Which? | Reference prices | https://www.which.co.uk/reviews/printers | Yes (£249.97 etc.), no test date | https://www.which.co.uk/terms-and-conditions | None found | USABLE for reference only |
| Machine Mart | Tools | https://www.machinemart.co.uk/ | Yes (INC VAT, pack in name) | https://www.machinemart.co.uk/business-tcs/ | None found in terms; robots.txt disallows ClaudeBot and GPTBot entirely | BARRED (robots) |
| Trolley | Comparison | https://www.trolley.co.uk/ | Partly | https://www.trolley.co.uk/terms | "You agree not to access the Website through any automated means" | BARRED |
| Home Bargains | Household | https://home.bargains/ (301 from homebargains.co.uk) | Yes (£5.99, "368g", "750ml") | /terms-and-conditions 404 | Not located | UNCLEAR |
| B&Q | DIY, garden | https://www.diy.com/ | Yes (£110, sizes) | Not located | n/a | UNCLEAR |
| Printerland | Office | https://www.printerland.co.uk/ | Yes (ex VAT), pack is toner yield | https://www.printerland.co.uk/termsandconditions-E293.aspx | None found | UNCLEAR (robots 403) |
| Poundland | Household | https://www.poundland.co.uk/ | Prices only, no pack | /terms-and-conditions 404 | Not located | UNCLEAR |
| Duracell UK | Batteries | https://www.duracell.co.uk/ | Certificate error | Not located | n/a | UNCLEAR |
| Wickes | DIY | https://www.wickes.co.uk/paint | No (302 to content-temporarily-down, then 404) | https://www.wickes.co.uk/terms-of-use | None found | BLOCKED |
| Pets at Home | Pet | https://www.petsathome.com/shop/en/pets/dog-food | No (nav only, first 100k chars) | https://www.petsathome.com/terms-and-conditions | None found (truncated) | BLOCKED |
| Zooplus UK | Pet | https://www.zooplus.co.uk/shop/dogs/dog_food | No | Not located | n/a | BLOCKED |
| Jollyes | Pet | https://www.jollyes.co.uk/ | No | https://www.jollyes.co.uk/terms-and-conditions | None found (truncated) | BLOCKED |
| Anker UK | Chargers | https://www.anker.com/uk | Names with wattage, no GBP price | https://www.anker.com/terms-and-conditions | None found | BLOCKED |
| Ebuyer | Cables | https://www.ebuyer.com/store/Cables-Adapters | Timeout x3 | /terms-and-conditions timeout | n/a | BLOCKED |
| Euro Car Parts | Car oil | https://www.eurocarparts.com/engine-oils | No (grid did not render) | https://www.eurocarparts.com/terms-and-conditions | None found | BLOCKED |
| Millers Oils | Car, oil | https://www.millersoils.co.uk/ | No | Not located | n/a | BLOCKED |
| GSF Car Parts | Car | https://www.gsfcarparts.com/ | 403 | Terms 403 | n/a | BLOCKED |
| Dobbies | Garden | https://www.dobbies.com/garden-tools | 403 | Not located | n/a | BLOCKED |
| Thompson & Morgan | Garden | https://www.thompson-morgan.com/ | 403 | Not located | n/a | BLOCKED |
| Robert Dyas | Household | https://www.robertdyas.co.uk/ | 403 | Not located | n/a | BLOCKED |
| The Range | Household | https://www.therange.co.uk/ | 403 | Not located | n/a | BLOCKED |
| B&M | Household | https://www.bmstores.co.uk/ | No product prices | Not located | n/a | BLOCKED |
| Homebase | DIY | https://www.homebase.co.uk/ | No product prices | Not located | n/a | BLOCKED |
| Iceland | Food, household | https://www.iceland.co.uk/ | No (truncated) | Not located | n/a | BLOCKED |
| Morrisons | Groceries | https://groceries.morrisons.com/ | No | Not located | n/a | BLOCKED |
| Waitrose | Groceries | https://www.waitrose.com/ | Timeout, empty shell | Not located | n/a | BLOCKED |
| Ocado | Groceries | https://www.ocado.com/ | Empty shell | Not located | n/a | BLOCKED |
| Superdrug | Health | https://www.superdrug.com/ | 403 | Not located | n/a | BLOCKED |
| Savers | Household | https://www.savers.co.uk/ | 403 | Not located | n/a | BLOCKED |
| Ryman | Office | https://www.ryman.co.uk/ | 403 | Not located | n/a | BLOCKED |
| Cartridge People | Office | https://www.cartridgepeople.com/ | 403 | Not located | n/a | BLOCKED |
| Scan | Tech | https://www.scan.co.uk/ | No | Not located | n/a | BLOCKED |
| Currys | Tech | https://www.currys.co.uk/ | 403 | Not located | n/a | BLOCKED |
| Jewson | Builders | https://www.jewson.co.uk/ | "See price" instead of prices | https://www.jewson.co.uk/terms-and-conditions | None found | BLOCKED |
| Lakeland | Kitchen | https://www.lakeland.co.uk/ | Names with size, no prices | Not located | n/a | BLOCKED |
| Clas Ohlson | Tools | https://www.clasohlson.com/uk/ | No | Not located | n/a | BLOCKED |
| John Lewis | Home, baby | https://www.johnlewis.com/ | No product prices | Not located | n/a | BLOCKED |
| IKEA UK | Home | https://www.ikea.com/gb/en/ | Bundle prices only | Not located | n/a | BLOCKED |
| Decathlon UK | Sport | https://www.decathlon.co.uk/ | 403 | Not located | n/a | BLOCKED |

Not verified: robots for Crocus `/wheelbarrow/`, Printerland robots (403), Home Bargains and Poundland robots and terms,
Viking's PDF beyond its first part, and Duracell.

No agent identifying as ClaudeBot should fetch Machine Mart.

## DE

Three sites pass all three checks. About 20 returned 403 or 404, or showed no readable prices. Clause quotes come from
fetch summaries and were not byte-checked. robots.txt was read with curl, and no file returned has a wildcard rule
disallowing `/`. Mindfactory's bans named bots only. Robots could not be read for toom, budni and office-discount (301,
404 or 502).

| Site | Area | URL tested | Price and pack readable | Terms URL | Clause or "none found" | Class |
|---|---|---|---|---|---|---|
| zooplus.de | Pet | /shop/hunde/hundefutter_trockenfutter | Yes (12 kg, 49,99 €) | /shop/service/agb | None found (first 100k of 107k chars) | USABLE |
| pollin.de | Cables, batteries | / | Yes (INTENSO 40 St, 5,99 €) | /agb | None found | USABLE |
| alternate.de | Electronics, tools | / | Price yes; pack only in names | /HILFE/ALTERNATE/AGB | None found | USABLE |
| marktguru.de | Offers aggregator | / | Yes (Rotkäppchen 3,29 €, €/l) | info.marktguru.de/agb | §4e: "Untersagt ist insbesondere auch der Einsatz von Computerprogrammen zum automatischen Auslesen von Daten." | BARRED |
| kaufda.de | Offers (Bonial) | / | Yes (Krombacher 10,99 €, 1 l) | /AGB | §3e: "Unzulässig ist das Kopieren, Weitergeben, Senden oder Veröffentlichen der Daten in irgendeiner Form" | BARRED |
| kfzteile24.de | Car parts | / | Yes, but page partly a bot-check dialog | /agb | "dürfen nicht vervielfältigt werden" (TecAlliance data) | BARRED |
| anker.com/de | Chargers | /de/ | No per-product price read | /de/policies/terms-of-service | §8.2(2): "einschliesslich Scraping, Data Mining, Datenextraktion, Data Harvesting" | BARRED |
| norma-online.de | Groceries, pet food | /de/angebote/ | Yes (Rum 0,5 l 12,99; Sheba 60x85 g 21,99) | Not found | n/a | UNCLEAR |
| fressnapf.de | Pet | /c/hund/hundefutter/ | Yes (12x195 g, 19,29 €) | /service/agb 404 | n/a | UNCLEAR |
| dehner.de | Garden, pet | / | Price yes; size only as furniture dimensions | /service/agb | None found | UNCLEAR |
| reichelt.de | Electronics | / | Price yes; no pack on tiles | /de/de/shop/service/-12_41 | None barring (§8.2 covers product names and logos) | UNCLEAR |
| viking.de | Office | / | Yes (Post-it 12x100 Blatt, 9,99 €; VARTA 24 St, 13,99 €) | odeu scene7 AGB.pdf | PDF unreadable (binary) | UNCLEAR |
| office-discount.de | Office | / | Pack yes (100 St.); no price read | /hilfe/agb | None found | UNCLEAR |
| toom.de | DIY | / | Yes (Gipskarton 11,23 € / Pack) | toom.de/agb/ | Index only; sub-documents unread | UNCLEAR |
| globus-baumarkt.de | DIY, garden | / | Yes (Knauf 22 kg, 20,00 €; Soudal 300 ml, 8,99 €) | /service/agb 404 | n/a | UNCLEAR |
| hagebau.de | DIY | / | No prices visible (truncated) | /service/agb 404 | n/a | UNCLEAR |
| pflanzen-koelle.de | Garden | / | No prices (navigation only) | Not found | n/a | UNCLEAR |
| ikea.de | Kitchen, storage | /de/de/cat/hundezubehoer | No prices visible | Not visible | n/a | UNCLEAR |
| mytime.de | Baby, drugstore | / | Promo price only, no pack | /agb | None found (§§1-14) | UNCLEAR |
| budni.de | Cleaning, drugstore | / | Yes (TEPE 8 St, 3,99 €; HAKLE 42 ST, 1,29 €) | /nutzungsbedingungen (app terms) | None found; web-shop terms not located | UNCLEAR |
| penny.de | Groceries | /angebote | No product prices | Not in footer | n/a | UNCLEAR |
| edeka.de | Groceries | / | No prices | Not visible | n/a | UNCLEAR |
| guenstiger.de | Price comparison | / | Listing price yes; pack weak | /Text/Nutzungsbedingungen.html 403 | n/a | UNCLEAR |
| test.de (Stiftung Warentest) | Consumer tests | / (redirect); /Batterien-Vergleich/ 404 | € prices but no pack; subscription line | AGB /Hilfe-… unread | n/a | UNCLEAR |
| conrad.de | Electronics | /de/ | 403, 2 tries | n/a | n/a | BLOCKED |
| voelkner.de | Electronics | / | 403, 2 tries | /agb (general; sub-terms unread) | n/a | BLOCKED |
| mindfactory.de | Electronics | / | 403, 2 tries | n/a | Robots bans named bots only | BLOCKED |
| billiger.de | Price comparison | / | 403, 2 tries | n/a | n/a | BLOCKED |
| autodoc.de | Car parts | / | 403, 2 tries | n/a | n/a | BLOCKED |
| kaufland.de | Groceries | / | 403, 2 tries | n/a | n/a | BLOCKED |
| netto-online.de | Groceries | / | 403, 2 tries | n/a | n/a | BLOCKED |
| decathlon.de | Sport | /browse | 403, 1 try | n/a | n/a | BLOCKED |
| globus.de | Groceries, kitchen | / | 403, one attempt; result not cleanly matched to a call, recheck | n/a | n/a | BLOCKED |
| mueller.de | Household, cleaning | / | No prices; bot-check notice | n/a | n/a | BLOCKED |
| ugreen.com/de | Chargers | /de/ | 404 | n/a | n/a | BLOCKED |

Not verified: pack sizes on alternate.de beyond product names, the last 7k characters of the zooplus terms, toom
sub-terms, Viking's PDF, guenstiger.de terms, and budni's web-shop terms. No price-carrying publication gave a dated,
per-product pack price. test.de showed undated book prices behind a subscription line.

The 403s are HTTP responses from the sites, so the ISP NAT rejections on kucni do not explain them.

## USABLE list by area

Only sites classed USABLE are listed. UNCLEAR sites are candidates, not sources. CA is not shown because no retailer
report covers it.

| Area | US | GB | DE |
|---|---|---|---|
| Batteries | Battery Junction (provisional) | none | pollin.de |
| Cables and chargers | none | 7dayshop | pollin.de (cables) |
| Electronics | none | none | alternate.de (pack from names) |
| Tools | none | none | alternate.de (pack from names) |
| Pet | none | none | zooplus.de |
| Household and bath | none | 7dayshop | none |
| Office and printer | none | Viking Direct (provisional); Which? printers (reference only) | none |
| Garden | none | Crocus (provisional) | none |
| Paint and DIY | none | none (see below) | none |
| Car | none | none | none |
| Kitchen | none | none | none |
| Baby | none | none | none |
| Cleaning | none | none | none |
| Groceries | none | none | none |
| Health | none | none | none |

Candidates if their terms get read in full:

- US: Uline (cleaning, B2B), buybuy BABY (baby).
- GB: Home Bargains (household), B&Q (DIY, garden), Printerland (office).
- DE: toom and globus-baumarkt (DIY), viking.de (office), budni (cleaning), fressnapf (pet), norma-online (groceries).

## Where the reports disagree

These are left visible for the owner or the next scout. The tables above keep each scout's class.

1. **7dayshop and paint.** The GB table lists paint as one of its areas, but the GB area list says "Paint and DIY: none".
   Paint is shown as none until a 7dayshop paint item with a pack size is seen.
2. **Home Bargains.** The GB area list put it under household marked UNCLEAR. It is moved to candidates here.
3. **Viking.** The GB scout rates Viking Direct USABLE (provisional) and the DE scout rates viking.de UNCLEAR. Both terms
   are PDFs on the same scene7 host and neither was fully read. The same standard points to UNCLEAR for both.
4. **Anker.** The DE terms bar scraping by name. The GB terms page gave "none found" and the US terms were not opened.
   Anker shows no readable price in any market, so nothing depends on this today.
5. **alternate.de.** It is classed USABLE though its pack size comes only from product names. A pipeline would have to
   parse names, and a wrong parse gives a wrong unit price.
6. **Which? and dates.** R2 calls Which? prices citable "with dates". The GB scout saw no test date on the printers page.
7. **R2 entries now out of date, not edited here.** Trolley is BARRED by its terms, where R2 says no terms were found.
   Open Prices has a licence, where R2 says none was found.

## Open Prices

Open Prices has useful volume for US and DE and is thin for GB and CA. A direct barcode lookup rarely finds a current
price, with 1 hit in 40.

**Licence.** The data is ODbL, per `docs/guides/data.md` and `docs/community/reuses.md` in openfoodfacts/open-prices. The
API docs say to mention the source, comply with ODbL and contribute back added products. The `/terms` page returned no
licence text. The code is AGPL-3.0 (`gh api repos/openfoodfacts/open-prices`, 111 stars, pushed 2026-11-06). Do not import
or link the code.

**Access.** Read the daily dump, not the API.

- `https://prices.openfoodfacts.org/data/prices.jsonl.gz`: about 22.7 MB, regenerated daily, last modified
  2026-11-05 23:08 UTC.
- `https://prices.openfoodfacts.org/data/locations.jsonl.gz`: supplies `osm_address_country_code`, joined on
  `location_id`. 7,614 of 7,808 locations have a country code.
- The `prices` endpoint has no country filter, so the join is needed. No rate limit could be verified.

**Prices by country** (dump, read 2026-11-06; 341,638 rows in total, 1,784 with no country).

| Market | All-years prices | 2026 prices | Latest date | 2026 currency |
|---|---|---|---|---|
| US | 47,129 | 29,801 | 2026-11-05 | USD (29,797) |
| GB | 2,113 | 512 | 2026-11-02 | GBP (512) |
| DE | 17,650 | 7,106 | 2026-11-05 | EUR (7,105) |
| CA | 714 | 90 | 2026-10-27 | CAD (90) |

**Barcode test** (API `product_code`, 10 per market). Barcodes came from `~/ops/sbc-push-20261106/ofsearch.py` brand
queries, not from our catalogue, so this sample does not measure catalogue coverage. Eight of the 40 had any price at all.
The filter itself works: `product_code=3560070283484` returns 12 prices.

| Market | Barcodes with 2026 price in market | Currency | Notes |
|---|---|---|---|
| US | 1/10 | USD | 0013000009867 Heinz Variety ketchup, USD 7.69, 2026-08-04 |
| GB | 0/10 | n/a | 5000157024657 has no prices |
| DE | 0/10 | n/a | 4067796178180 has only a 2025-08-29 EUR 1.45 price |
| CA | 0/10 | n/a | Tim Hortons and Kraft Canada codes had no prices |

Not verified: rate limits and User-Agent policy, whether US 2026 volume comes from a few contributors, the `/api/docs`
endpoint list (a Swagger shell), coverage by product area, and what ODbL's terms require of a catalogue that mixes this data
with others. That last one needs reading before any use.

Sources: https://github.com/openfoodfacts/open-prices (`docs/guides/data.md`, `docs/community/reuses.md`, `API.md`) and
https://prices.openfoodfacts.org/api/v1/prices.

## Added during the November research rounds

**Corrected 7 Nov: see R4.** zooplus and Pollin bar this in their imprints, and Crocus restricts reuse in its terms. This document read only sales terms for German stores and missed those clauses, so read `R4-source-audit.md` before relying on any status here.

Researchers read these sites' robots rules and terms before citing them. This table records what they found; nobody has read the
terms again since. Prices were read through a summarising fetch, so a price on the site is the record, and each swap carries its date.

Swap counts come from the built catalogue of 424 swaps on 7 Nov.

| Site | Market | Swaps citing it | Status | Limits |
|---|---|---|---|---|
| Uline | US | 13 (household 9, tools 3, skincare 1) | Used | |
| Dehner | DE | 2 (garden) | Used | |
| Toolstation | GB | 10 (tools 9, garden 1) | Used | |
| mytime.de | DE | 32 (household 21, baby 5, kitchen 4, skincare 2) | Used | Product pages only. Robots bar `?page=`, `?sort=`, `?category=` and `/api` |
| bacofoil.co.uk | GB | 1 (kitchen) | Used | |
| Open Prices community records | DE 41, US 37, GB 7 | 85 (food 81, household 2, others 2) | Used | Some record shelf prices at Target, Walmart and Aldi stores. The ban on fetching those retailers' own sites still stands |
| reichelt | DE | 0 | Allowed, not cited yet | |
| Rossmann | DE | 0 | Barred | Robots bar ClaudeBot |
| Screwfix | GB | 0 | Barred | |
| Webbs Direct, RHS Plants | GB | 0 | Barred | Terms limit this use |
| Halfords | GB | 0 | Left out | Terms not read |

Auto Express supplies 17 swaps (car 11, tools 6), from one publisher and with rounded prices, so treat that area as thinly sourced. Four
swaps stay out until they have a second source: Duck tape, 3M 3900, 3M 2090 and microflex gloves.

## What remains without a source

- **CA retailers:** not scouted in this round. CA has only Open Prices, with 90 prices in 2026 and 0/10 barcodes.
- **All three scouted markets:** car, kitchen, baby, cleaning, groceries and health have no USABLE retailer. Open Prices
  may help groceries, with the barcode hit rate above.
- **US:** everything except batteries.
- **GB:** batteries, pet, tools, electronics beyond 7dayshop's range, paint and DIY.
- **DE:** household and bath, office and printer, garden, paint and DIY.
- **Dated prices from a publication:** none found in any market. Which? (GB) is reference only with no test date. R2's
  Which? pairs still need their dates confirmed.
- **Feeds and accounts:** Amazon Creators API, Awin and CJ (R2) remain unopened and are the likely route for barred or
  blocked chains. A dated manual check is the other route.

## Added 7 Nov 2026, UK household round

- **Aldi UK:** section 8.1 of its terms bars automated collection. Two battery swaps had cited its product pages, read on 6 Nov before anyone had read those terms. Both citations are gone, and the AAA swap is held because it no longer has two sites. Aldi prices now come only through Which?. Links to Aldi for shoppers stay.
- **Home Bargains:** terms return 403, robots.txt allows product pages. Terms unread, so it isn't a source. One swap had cited it on 6 Nov; that's the same held AAA swap.
- **Morrisons:** my.morrisons.com terms bar storing site content in a retrieval system. Grocery terms unread. Not a source.
- **simplehuman:** terms bar commercial use and copying. Its robots.txt also carries text aimed at AI assistants, asking them to recommend installing a third-party skill. Ignored.
- **Unreadable when tried:** Sainsbury's, Asda and Tesco (403 on robots and terms), Good Housekeeping, The Independent, BBC Good Food, Ocado, Costco, Waitrose. domestos.com's terms link returns 403. cushelle.com has no terms page we could find.
- **Read and usable as second sources for that product:** persil.com/uk, brabantia.com/uk. Neither bars automated reading. cifclean.co.uk doesn't bar it either, but its page doesn't name the product Which? tested, so the two Cif swaps were dropped.
- **Which?:** hides most scores from non-members and test tables carry no product names. We take only what a page prints, and don't match names to scores by elimination. So most UK household swaps show "Same kind".

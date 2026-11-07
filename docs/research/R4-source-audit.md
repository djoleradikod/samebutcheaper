# R4: where the catalogue's prices come from

Written 7 Nov 2026 by `scripts/qa/source_audit.ts`, from `docs/research/R4-source-verdicts.json`. The owner decides what stays. Nothing has been removed.

The catalogue has 458 records. **ok** means the terms were read and don't bar this. **barred** means robots or terms do, as quoted. **unknown** means nobody has read enough to say, which includes any site whose imprint wasn't read: that's where zooplus's clause was. Terms were read through a summarising fetch tool, so check the quotes by hand before relying on them.

A record's source is approximate. One citing Open Prices counts both sides as Open Prices, though some have one side from a store. A record counts against a source if either side uses it. Ratings aren't in this count: 20 ratings read on 7 Nov came from zooplus.de and Pollin.

## What survives

Swaps each country lists by default, with how many are at that country's own prices, how many are rated, and how many have a bigger pack.

| Scenario | Records | IE | GB | DE | US | CA |
|---|---|---|---|---|---|---|
| Today | 458 | 117 (18 own, 57 rated, 27 bigger) | 154 (120 own, 67 rated, 31 bigger) | 201 (150 own, 74 rated, 40 bigger) | 223 (159 own, 47 rated, 18 bigger) | 185 (11 own, 30 rated, 17 bigger) |
| Without barred sources | 295 | 92 (0 own, 35 rated, 11 bigger) | 123 (113 own, 45 rated, 15 bigger) | 146 (105 own, 36 rated, 19 bigger) | 127 (66 own, 32 rated, 18 bigger) | 92 (11 own, 16 rated, 17 bigger) |
| Only sources marked ok | 106 | 11 (0 own, 0 rated, 0 bigger) | 14 (9 own, 1 rated, 0 bigger) | 64 (60 own, 0 rated, 0 bigger) | 46 (37 own, 0 rated, 4 bigger) | 37 (0 own, 0 rated, 4 bigger) |

## Sources

| Source | Market | Records | What the terms say | How the data was obtained | Verdict |
|---|---|---:|---|---|---|
| walmart.com | US | 88 | R2: bars spiders and robots, through a summary. On 7 Nov the terms page showed a bot check. | Records quote "Walmart's listing", so a person or tool read the store's page. The first build on 2 Nov already had them, and R2's rejection is from 6 Nov. Later rounds may have added more. | barred |
| zooplus.ie | IE | 18 | Imprint: "The use of automatic mechanisms (such as search engines, robots and crawlers) in product services or price search engines is also subject to licensing", and storage in databases is prohibited without consent. | Store's product pages, by fetch tool, 7 Nov. Read before the imprint was. | barred |
| target.com | US | 14 | "Make any use of data extraction, scraping, mining or other data gathering tools" and "Make any commercial use of the Site or its Content, including making any collection or use of any product listings". | Store's pages, except where a record cites Open Prices. | barred |
| zooplus.de | DE | 13 | Imprint: "Die Verwendung automatischer Mechanismen (Suchmaschinen, Robots, Crawler), beispielsweise zur Bedienung von Produkt- oder Preissuchmaschinen, ist ebenso genehmigungspflichtig". R3 read only the sales terms. | Store's product pages, by fetch tool. | barred |
| rossmann.de | DE | 12 | R3: robots bar ClaudeBot. Terms page wouldn't load on 7 Nov. | Not recorded. | barred |
| shop-apotheke.com | DE | 10 | "Der Einsatz von Data Mining, Robots, Grabbing, Scraping und/oder ähnlichen Datensammel- und Extraktionsprogrammen" counts as unauthorised access (apotheke_haftung §7). A scout fetched 5 product pages on 7 Nov after reading this, and discarded them. | Store's product pages, by fetch tool. | barred |
| pollin.de | DE | 10 | Imprint: "Die Weiterverwendung des Bild- und Textmaterials ist untersagt." Doesn't name prices or automated access. Robots bar its own AGB and imprint pages. | Store's product pages, by fetch tool. | barred |
| costco.com | US | 6 | Section 9: "Use any data mining, robots, agents or similar data gathering or extraction methods designed to scrape". | Store's pages. | barred |
| crocus.co.uk | GB | 6 | "None of this material may be used without our written permission." Doesn't name prices or automated access. The owner has this one. | Store's product pages, by fetch tool. | barred |
| chewy.com | US | 6 | No copying or republishing, and no commercial exploitation without written consent. Summary was cut short. | Store's pages. | barred |
| business.walmart.com | US | 4 | As walmart.com. | Store's pages. | barred |
| ikea.com | GB | 1 | "None of the content of our website may be copied or otherwise incorporated into or stored in any other web site" (Irish terms, one UK record). | Store's pages. | barred |
| tesco.com | GB | 49 | Not read. R2 rejected it unread, and tesco.ie refuses automated requests. | Records quote "Tesco's listing", from the store's pages. | unknown |
| mytime.de | DE | 32 | R3 found no clause in the AGB and classed it UNCLEAR. Imprint not read. Robots bar ?page=, ?sort= and ?category=. | Store's product pages, by fetch tool. | unknown |
| Auto Express | GB | 17 | Terms not on file. | Rounded prices published in Auto Express group tests. | unknown |
| viking-direct.co.uk | GB | 17 | R3: no clause in the readable part, and the PDF was partly unreadable. | Store's product pages, by fetch tool. Some may be out of date. | unknown |
| uline.com | US | 13 | No clause on the terms page, which points to a PDF nobody could read. | Store's product pages, by fetch tool. | unknown |
| dm.de | DE | 8 | Terms page showed no text on 7 Nov. | Not recorded, except where a record cites Open Prices. | unknown |
| amazon.com | US | 8 | R2: retail pages unread. The Creators API is the allowed automated route. | Not recorded. | unknown |
| toolstation.com | GB | 7 | Terms not found. Robots block a bot named scraper_headless, and product pages aren't barred to others. | Store's product pages, by fetch tool. | unknown |
| dehner.de | DE | 2 | AGB has no clause, as a scout read it. Imprint not read. | Store's product pages, by fetch tool. | unknown |
| Open Prices | US, DE, GB | 85 | ODbL, as the data.gouv.fr listing states it: any use, if we credit Open Prices and share changes to the dataset. Official licence page not read. | Community records from prices.openfoodfacts.org. Some record shelf prices at Walmart, Target and Aldi stores, and no store's site was read for them. | ok |
| alternate.de | DE | 12 | Robots, AGB and imprint read 7 Nov. No clause on reuse or automated access. | Store's product pages, by fetch tool. | ok |
| aponeo.de | DE | 7 | Robots, AGB and imprint read 7 Nov. No clause on reuse or automated access. The imprint says only that the content is protected by copyright. | Store's product pages, by fetch tool. | ok |
| which.co.uk | GB | 4 | R3 read the terms and found no clause. Usable for reference only, and most scores are locked to members. | Prices and scores published in Which? tests. | ok |
| 7dayshop.com | GB | 2 | R3 read the terms and found no clause. A scout on 7 Nov couldn't find the page again. | Store's product pages, by fetch tool. | ok |
| All others, 44 sources | | 131 | Terms not on file. | Not recorded per record. | unknown |

The others: aldi.co.uk (15), shop.rewe.de (12), sainsburys.co.uk (10), apple.com (9), loblaws.ca (9), samsclub.com (6), lidl.co.uk (6), groceries.morrisons.com (5), anker.com (5), lidl.de (4), aldi-sued.de (4), asda.com (4), persil.com (3), app.warehouserunner.com (2), kaufland.de (2), logitech.com (2), belkin.com (2), medikamente-per-klick.de (2), boots.com (2), walmart.ca (2), waitrose.com (2), surlatable.com (1), shop.snapon.com (1), harborfreight.com (1), chipolo.net (1), vitacost.com (1), bestbuy.com (1), mueller.de (1), brabantia.com (1), homedepot.com (1), us.ugreen.com (1), bmstores.co.uk (1), heb.com (1), coop.co.uk (1), docmorris.de (1), mechanix.com (1), petsmart.com (1), penny.de (1), netto-online.de (1), hotelchocolat.com (1), edeka.de (1), superdrug.com (1), bacofoil.co.uk (1), ocado.com (1).

## Before these numbers are used

- Open Prices' ODbL needs a credit on the site and shared changes to the dataset. `/about` and `/how-we-verify` credit it. Nobody has read the official licence page or checked what sharing changes would take.
- A swap that's cut can often come back from a licensed feed. R2 lists Awin and others, and each needs an account.
- Publishing a store's price isn't the same as reading it, and neither is a legal question this audit answers. It records what the terms say.

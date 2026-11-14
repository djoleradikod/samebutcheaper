# R11: what the affiliate programmes' terms let us do

14 Nov 2026. For the owner. For each programme we link to: what its own terms make us do, what the site already
does, and what would get us rejected or thrown out. Every rule quotes the page it comes from, with the address and
the day it was read. Where a page couldn't be read, this says so, and nothing is assumed from it.

The machine-readable version is the `terms` block of each store in `data/sellers/programmes.json` (and `networks` for
a network's own terms). `src/lib/programmes.ts` refuses a rule that has no quoted clause behind it. The site reads
only that registry (`src/lib/programme-terms.ts`); no store is named in the code that applies the rules.

Quotes are short extracts, as the pages read on 14 Nov 2026. Re-read a programme's terms before applying: they
change, and an approval can be reviewed against the version in force on the day.

## Rejection and ban risks today

In order of how likely they are to cost us a programme. Items 1 to 4 are not solved by code.

1. **Walmart: "dupe" in our addresses.** Walmart §3(a) bars using "“dupe” language as a means of product
   comparison to that of another brand". No visible text on a swap page that involves Walmart says "dupe" (the site's
   copy only uses the word to say we don't list scent-alike "dupes"), and a test checks that. But the brand hub pages
   live at `/dupe/<brand>` and are linked from every swap page, Walmart ones included. A reviewer could read the
   address as dupe language. **Decision for you:** rename the path (for example `/cheaper-than/<brand>`, with a
   permanent redirect from `/dupe/`) before applying to Walmart. Not done here: it touches the sitemap, the
   proxy, country URLs, llms.txt and every link to those pages, and it costs whatever ranking the old addresses have.
2. **Walmart: its name beside competitors.** Exhibit A item 16: "You may not place the Trademarks adjacent to
   competitive brands". Every swap with one side at Walmart and the other at Target, Amazon or another store puts both
   store names on one page, sometimes in one row of buttons. That is what the site is. Ask Walmart's affiliate team
   (affiliates-help-ext@wal-mart.com) whether a comparison page counts before relying on the programme; if it does, US
   swaps with a Walmart side would need to link only Walmart.
3. **Walmart: prices must come from Walmart, within 24 hours, on pages built once a week.** §8 and §13. Without
   Walmart's feed nothing of Walmart's is priced (done, below). Once its feed is joined, a price is shown only when
   the feed was read on the day of the build. But the site is rebuilt weekly (`.github/workflows/price-watch.yml` and
   `deploy.yml`, Mondays), so a price shown on Monday is still on the page on Sunday. **Before turning on Walmart's
   feed, the price watch and the deploy must run daily**, or Walmart prices stay withheld (which is safe). Same for
   Amazon's API once we have it.
4. **Amazon: the account closes without sales, and the API needs sales first.** Not a terms breach, but the reason
   Amazon prices stay withheld: Participation Requirements 2(b) allows prices only when Amazon serves them or they come
   from the Creators API or PA API, and docs/affiliate-playbook.md records that the Creators API needs qualifying
   sales first. Every Amazon price is withheld until then (done, below).
5. **FlexOffers (Tesco): our weekly letter.** §4.13: "Publishers may not promote any Advertiser program through
   email, newsletters, SMS, push notifications" without written approval. Our letter never links a store or /go, only
   our own pages, and never names the store, but it does name the cheaper product, which for a Tesco swap is a Tesco
   own-brand product. If FlexOffers reads that as promoting Tesco by email, ask for written approval or leave Tesco
   swaps out of letters by setting Tesco's `email` to `"none"` in the registry (one line, with the clause quoted).
6. **Target: the programme may be closed.** partners.target.com needs JavaScript and couldn't be read. Raptive told
   its publishers the Target affiliate programme was "set to conclude on January 5, 2026"
   (https://help.raptive.com/hc/en-us/articles/42984904871067-The-Target-affiliate-program-is-ending-here-s-what-to-know,
   read 14 Nov 2026). Whether that was Target Partners itself isn't clear. Check before applying.

What was a ban risk and is now handled in code, with the registry switching each rule on: Walmart and Amazon prices
shown without their feed or API (now withheld), price alerts and price history for Walmart and Amazon products (now
off), our own photos of Walmart products (now left out), Walmart's "paid link" label (now beside each Walmart link),
Walmart's name in email (now kept out of every email), and links to walmart.com/pharmacy (now fail the build).

## What the code does now

Applied once, when the catalogue is built (`scripts/programme-terms.ts`, called from `scripts/build-catalog.ts`), so
every page, card, feed, email and search result reads the same result. The build prints what it withheld:

```
Programme terms: prices withheld on 120 swaps, 17 kits, 10 baskets; 244 price histories and 59 photos left out.
```

| Rule in the registry | What the site does | Where |
|---|---|---|
| `prices: {only: "feed", maxAgeHours}` | A price for that store is shown only if its newest reading came from the programme's own network feed, read within the window before the build. Otherwise the side is **withheld**: the page says "See the price at Walmart" and "Last checked by us: <date>", shows no price, no saving, no ticket and no yearly figure, and explains why. Every saving built on it (the swap's %, per pack, score; a kit's totals; a basket's totals) is set to 0 in the catalogue, so it never ranks, never feeds an "up to X%" figure and never reaches a title, description, share image or email. | `src/lib/programme-terms.ts` `priceWithheld`, `src/lib/withheld.ts`, `SwapView.tsx`, `WithheldRecord.tsx`, cards |
| `prices: {only: "api"}` | The same, but no reading of ours meets it: we read no programme API yet. | same |
| `priceNotice` | Beside a price we do show for that store: "If the price at Walmart differs, Walmart's price applies." (Walmart §8) or Amazon's "accurate as of the date/time indicated" sentence. | `priceNotices` in `src/lib/withheld.ts` |
| `priceAlerts: false` | No price watch is offered on a swap whose cheaper product is at that store; with only the brand there, a watch follows the cheaper price alone and its email leaves the saving out. | `src/lib/watch-terms.ts` |
| `priceHistory: false` | That side keeps no price history, so no chart or table of past prices. | build pass |
| `images: "programme"` | Our photo of that side is left out (the page shows its typographic tile), and the credits page drops photos no page shows. | build pass |
| `email: "none"` | Swaps and kits with a side at that store are left out of the weekly letter and of wish answers. | `pairMailable`, `kitMailable` |
| `email: "no-links"` | Already met: our emails link only to our own pages, never to a store or /go. | none needed |
| `disclosure: "paid-link"` | "Paid link" ("Anzeige" in German) beside every earning link to that store, on swap pages, bigger-pack offers, kit pages and withheld kits. | `adFor` in `SwapView.tsx`, `KitView.tsx`, `WithheldRecord.tsx` |
| `disclosure: "amazon-associate"` | Already met: the footer on every page and /disclosure say "As an Amazon Associate we earn from qualifying purchases." whenever an Amazon tag is set. | `SiteFooter.tsx` |
| `dupeWording: false` | Checked by a test against the built pages: no visible text on those swaps says "dupe". | `scripts/tests/programme-terms-pages.test.ts` |
| `barredPaths` | A link to such a path (walmart.com/pharmacy) fails `npm run catalog`. | build pass |

A withheld record's own prose (evidence, why, what differs, its claims, a kit's summary) also loses every sentence
that quotes a price ("Walmart's Claritin listing shows [...] for $38.97"), down to the clauses before the first
price; evidence that was nothing but prices reads "We compared the two listings' pack sizes and prices. The store's
affiliate terms let us show only prices it supplies, so they are left out here." This also drops magazine prices
quoted in evidence on those records (the UK screenwash swap), which is stricter than the terms need but keeps one
rule. The source files in `data/` keep the full text. Ideally the evidence for those swaps is rewritten without
prices (follow-up).

A withheld record is also left out of: the bulk page, My list and the list check, receipt matches, the shopper
"reported price" note, the weekly letter and wish answers. Its page stays up, with what matches and what differs.

**Scope today:** 103 of 170 US swaps (153 Walmart sides, 13 Amazon), 17 of 131 UK swaps (26 Amazon sides), 17 US
kits and 10 baskets (8 US, 2 UK) show no prices. No German, Irish or Canadian swap is affected: none of their
stores has a price rule in the registry.

### Switching it, and before/after

A programme's display rules switch on by themselves when the site is built as a member of it: when its `AFF_*` setting, the Amazon tag or a `PRICE_FEED_URLS` line for the store is set. Until then the site shows the prices we checked ourselves, because the terms bind members. Two settings, read when the catalogue is built, override that:

```sh
PROGRAMME_TERMS_ON=walmart npm run build       # the site as Walmart will require it, before joining
PROGRAMME_TERMS_ON=all npm run build           # every programme's display rules on
PROGRAMME_TERMS_OFF=walmart npm run build      # rules off even though joined: for comparing builds only, never deploy
```

Look at a `PROGRAMME_TERMS_ON` build before applying to a programme, so you know what joining does to its pages: with Walmart and Amazon on, 120 swaps, 17 US kits and 10 baskets show "See the price at ..." instead of a price until a feed supplies one.

Use it to compare before and after on a local build; never on the live site once you have applied to that programme.
It doesn't switch off price-alert rules (`src/lib/watch-terms.ts` reads the registry directly), because those were
already live. To change a rule for good, edit the store's `terms` in `data/sellers/programmes.json` with the clause
quoted; `npm run catalog` refuses a rule without one.

After joining a programme with a price rule, nothing in the code changes: its feed rows (`PRICE_FEED_URLS`, network
matching the registry) meet the rule on the day they are read, and the price is shown on pages built that day.

## Per programme

### Walmart (Impact, US)

Terms: https://affiliates.walmart.com/terms, "Last updated June 2026", read 14 Nov 2026.

**What we must do, and what we do**

| Clause | Words | We |
|---|---|---|
| §3(a) | "include in your Affiliate Website any price tracking and/or price alerting functionality relating to products sold on the Sites;" (barred) | No watches on Walmart prices; no Walmart price history. Done. |
| §8 | "You may include current price information in your product descriptions only if such information is provided to you by Walmart, provided that you remain responsible for maintaining accurate and up-to-date pricing information and disclosing to users, where applicable, that in the event of any price difference between your website and the Site, the price listed on the Site will govern." | Prices only from Walmart's Impact feed, with that notice beside them. Without the feed: "See the price at Walmart" and the date we last checked, no figure. Done. |
| §13 | "updating product information, content and item descriptions (including, but not limited to, product price and availability) within 24 hours of any update" | Feed readings count only on the day of the build. Needs a daily build to be met once prices show (risk 3). |
| §3(a) | "use “dupe” language as a means of product comparison to that of another brand." (barred) | No "dupe" in page text, tested. The `/dupe/` path remains (risk 1). |
| §3(a) | "shorten or obscure a Qualifying Link, including through use of any link shortening service, button, hyperlink or other ad placement, in a way that may mislead or confuse a customer;" (barred) | `/go/<swap>/<side>` is our own redirect, on a button that names the store ("See it at Walmart"), so the destination is never hidden. Met. |
| §3(a) | "link or redirect any Qualifying Link to any website other than our Site" (barred) | /go only ever redirects to the store's own address. Met. |
| §3(b) | "generate or use Electronic Communication using or containing Trademarks [...] or products, or any of the Qualifying Links or URLS provided to you as part of the Program;" without written permission (affiliates-help-ext@wal-mart.com) | No swap or kit with a Walmart side goes in any email. Done. Ask for permission if you want them back. |
| §4 | "labeled as “#WalmartPartner” or “paid link” when including Qualifying Links in your Endorsement" | "Paid link" beside every Walmart link that earns. Done. |
| §2 | "a clear and conspicuous disclosure that it is an advertisement placed next to the Qualifying Links so the disclosure is unavoidable." | The label sits on the button row; the swap page's disclosure line sits under the prices. Met. |
| §3(a) | "promote, or participate in the promotion of, Walmart.com's Pharmacy (www.walmart.com/pharmacy)" (barred) | A pharmacy link fails the build. None exists. |
| §3(a) | "including a Qualifying Link in connection with deceptive or misleading visuals (for example, including an image or a video an item or product that is not sold on the Site, but then linking to a similar product on the Site);" (barred) | Each button links the exact product its photo and name show. Met. |
| Exhibit A, 24 | "You may not use Walmart’s or its vendors or suppliers' logos, trade names, trademarks, graphic images, product images, product references and similar identifying material unless expressly and specifically provided by Walmart for use in the Program" | Our photos of products on Walmart's side are left out. Done. Product names stay: the clause allows them "within a keyword string (i.e. Hanes T-Shirts)", and a name is how a shopper finds the product. |
| Exhibit A, 16 | "You may not place the Trademarks adjacent to competitive brands" | Not met by design (risk 2). |
| Exhibit A, 19 | Walmart names not "IN KEYWORD BIDDING ON SEARCH ENGINES, IN METATAGS [...] IN YOUR DOMAIN NAME, SUBDOMAIN, OR ANY OTHER PART OF YOUR UNIVERSAL RECORD LOCATOR." | Our domain and paths carry no Walmart name; we run no paid search. Page titles name the product, not Walmart. Met. |
| Exhibit A, 20 | "You may not bid on any keyword where such keyword is one of our Trademarks" | No paid search. Keep it that way. |
| Exhibit A, 23 | "You may not use the Trademarks alongside or in conjunction with the following terms: "percent (%) off", "sale", or "coupons"." | A withheld swap shows no percentage. Once Walmart prices show, the "−52%" ticket sits on the same card as "See it at Walmart". It says "cheaper", not "off", but ask Walmart when you ask about item 16. |
| Exhibit B | "You must seek prior written approval from Walmart before choosing to operate as a Network." | We are not a network. Our Skimlinks/Sovrn fallback (`AFFILIATE_FALLBACK`) must not carry Walmart links once we are in Walmart's own programme: it doesn't, a store with a direct programme switched on uses that. |
| §2 | "we may place or recognize cookies on visitors' browsers, and receive information from or about visitors" and "Your participation in the Program constitutes your specific and unconditional consent to and authorization" | Walmart's cookie is set on walmart.com after the click, not on our site. Our privacy page needs to say a store and its network may set cookies after the click: note for W6-B below. |

**Would get us rejected or banned:** the four Walmart items at the top of this document; any Walmart price from our
own checks (the code prevents it); a price watch on a Walmart product (prevented); a newsletter naming a Walmart
product (prevented); a Walmart product photo of ours (prevented).

### Amazon Associates (US, UK, and DE/CA/IE storefronts)

Operating Agreement: https://affiliate-program.amazon.com/help/operating/agreement, "Updated: October 15, 2025",
read 14 Nov 2026 (the UK agreement, https://affiliate-program.amazon.co.uk/gp/associates/agreement, carries the
same date and wording for the statement). Program Policies: https://affiliate-program.amazon.com/help/operating/policies,
"Updated: April 14, 2026", read 14 Nov 2026. UK policies: https://affiliate-program.amazon.co.uk/help/operating/policiesoct1
(no date on the page), read 14 Nov 2026. The German, Canadian and Irish storefronts' pages weren't read; the registry
applies the US/UK rules to them, which are the stricter reading.

| Clause | Words | We |
|---|---|---|
| Agreement §5 | "As an Amazon Associate I earn from qualifying purchases." or "any substantially similar statement previously allowed" | The footer of every page and /disclosure: "As an Amazon Associate we earn from qualifying purchases." whenever an Amazon tag is set. Met. |
| Policies, Participation 2(b) | "your Site may only show prices and availability if: (a) we serve the link in which that price and availability data are displayed, or (b) you obtain Product pricing and availability data via Creators API or PA API" | Every Amazon price is withheld: "See the price at Amazon". Done. |
| Policies, Participation 2 | "if you choose to display prices for any Product on your Site in any "comparison" format [...] you must display both the lowest "new" price and, if we provide it to you, the lowest "used" price" | Moot while Amazon prices are withheld. Once the API is in, the price shown must be the lowest new price the API gives. |
| UK IP License 2(i) | "include a date/time stamp adjacent to your display of pricing or availability information. [...] Product prices and availability are accurate as of the date/time indicated and are subject to change." | The notice is in the registry and shows beside any Amazon price we show; the date we show is the reading's day. Once the API is in, show the time too. |
| UK IP License 2(h) | non-image content may be cached "for up to 24 hours", then you "must immediately thereafter refresh and re-display" it; "You will not store or cache Product Advertising Content consisting of an image." | Our photos are our own, not Amazon's. The 24-hour refresh needs the daily build (risk 3). |
| Policies, Participation 2(y) | "Unless otherwise agreed by Amazon, your Site must not have price tracking and/or price alerting functionality." | No watches, no history on Amazon prices. Done. |
| Policies, Participation 4 (US) | Special Links in emails only when "such communications are solicited (i.e., opted into by the receiving customer)" | Our emails carry no store links. Met. |
| UK Participation 4 | "You will not engage in any promotional, marketing, or other advertising activities in any offline manner, including by using any of our or our affiliates' trademarks or logos (including any Amazon Mark), any Program Content, or any Special Link in connection with email" | No store links or names in our emails. Withheld swaps (all Amazon ones today) are left out of emails anyway. Met. |
| Policies 2(v), 2(w) | "You will not cloak, hide, spoof, or otherwise obscure the URL of your Site containing Special Links." A link shortener may not be used "in a manner that makes it unclear that you are linking to an Amazon Site." | `/go` buttons say "See it at Amazon" (or the storefront's name), so it is clear where the link goes. Met. The cart link (`src/lib/cart.ts`) opens Amazon's own cart page directly. Met. |
| Policies, Participation 1(g) and Trademark Guidelines 8 | no Amazon trademark "in any domain name, subdomain name" | None. Met. |
| Policies, Participation 6(f) | "You will not bid on or purchase keywords, search terms, or other identifiers" | No paid search. |
| Policies, Participation 5 | no "client-side software application" (browser plug-in, toolbar, extension) | We have none. The installable web app is our own site, not a plug-in on Amazon. |
| Policies, Participation 3(e) | disclose "the use of cookies, pixels, and other technologies by you and third parties" and give "information on the visitor's choices with respect to opting-out from online advertising where required by applicable law." | Privacy page: note for W6-B below. |
| Products Statement 3 | excluded: "prescription drugs, or any other product sold by Amazon Pharmacy." | We list no prescription medicine. Met. |
| IP License 2(k) | With the API: "CERTAIN CONTENT THAT APPEARS [...] ON THIS SITE COMES FROM AMAZON." in plain view | Only once we use the API. Add it then. |

**Would get us rejected or banned:** an Amazon price not from Amazon (prevented), a price watch (prevented), a
shortened or hidden Amazon link, Amazon links in a UK email (we have none), an Amazon trademark in our domain.

### Awin (the network) and its programmes

Publisher Code of Conduct: https://awin.foleon.com/code-of-conduct-publisher/en-gb/ (version 4, no date; read 14 Nov
2026). Publisher terms 2026, linked from https://www.awin.com/gb/publisher-terms: UK (Awin Ltd)
https://www.awin.com/docs.awin.com/Legal/Publisher+Terms/2026/EN+(UK)_Awin+Ltd+Publisher+terms_2026.pdf and DE
(Awin AG) https://www.awin.com/docs.awin.com/Legal/Publisher+Terms/2026/DE_Awin+AG+Publisher+terms_2026.pdf, both
read 14 Nov 2026 (no exact date in either).

| Clause | Words | We |
|---|---|---|
| Code, rule 1 | "Publishers proactively disclose all promotional activities and obtain advertiser approval for their activities." | Describe the site honestly in the Awin profile (checklist). |
| Code, rule 8 | "Any information Publishers provide to consumers is accurate and current." | Prices carry their date; old ones say so and never lead. Met as far as our own checks go. |
| Code, rule 7 | "Publishers do not use terms infringing on third party brands in their paid search activities." | No paid search. |
| Code, rule 10 | "Publishers only initiate tracking via a tracking link" | Tracking starts only from a click on a /go button. Met. |
| UK terms 9.2.11 / DE 9.2.11 | "all Advertiser Materials will be accurately and faithfully reproduced;" / "alle Advertiser-Materialien korrekt und wahrheitsgetreu wiedergegeben werden" | We use no advertiser banners. Feed prices are shown as the feed gives them. |
| UK terms 10.1 / DE 10.1 | a sublicence "to publish Advertiser Materials, without modification" / "die Veröffentlichung der unveränderten Advertiser-Materialien" | Our photos are ours. If we ever use feed images, use them unchanged. |
| UK 3.8.5 | "Subnetworks can only join the Network and participate in Advertiser Programmes" directly | We are not a subnetwork. |
| UK 12.1 | "Awin and the Publisher will comply with their respective obligations under Data Regulation." ("Data Regulation" includes ePrivacy, cl. 2.1) | No consent clause of its own. ePrivacy itself applies to any cookie we set: note for W6-B. |

No Awin clause sets a price-freshness window, bars price alerts or bars email, so the registry has no `networks.awin`
block. The advertisers' own pages:

- **APONEO** (https://ui.awin.com/merchant-profile/15521, read 14 Nov 2026; its terms page
  https://ui.awin.com/merchant-profile-terms/15521 answered with an error): "Keyword Advertising ist für "APONEO"
  ausgeschlossen"; "Keine Verwendung von Marken oder Namen der Wettbewerber im Adtext oder als Keywords";
  "Affiliates dürfen nur Rabatt- & Gutscheinaktionen bewerben, die durch Awin zur Verfügung gestellt wurden.";
  publishers with no traffic in 12 months are removed. Nothing on prices, feeds, email or disclosure. **We:** no paid
  search, no vouchers. Met. Risk: no clicks for a year after joining.
- **myTime** (https://ui.awin.com/merchant-profile/14902): "Wir bitten alle Publisher, unsere Programmbedingungen zu
  beachten." The terms themselves weren't on the page (the terms page answered with an error). Read them in Awin
  after joining.
- **zooplus** (https://ui.awin.com/merchant-profile/11330): daily CSV product data, "Verwendung des Produkt-Feeds auf
  Anfrage". Nothing on promotion types. Ask for the feed when you join.
- **Netto Marken-Discount** (https://ui.awin.com/merchant-profile/13812): "Gutscheine aus den Filialen sind nicht für
  das Affiliate Programm vorgesehen." Nothing else restrictive.
- **ALTERNATE** (https://ui.awin.com/merchant-profile/11731): "Bei Bewerbungen für unser deutsches Partnerprogramm
  werden nur Sales aus Deutschland vergütet."
- **Lidl** (https://www.lidl.de/c/das-lidl-partnerprogramm/s10005552): runs on Awin; terms not on the page.
- **Pollin** (https://ui.awin.com/merchant-profile/15965 and .../merchant-profile-terms/15965): both answered with an
  error. Unknown.
- **Crocus** (https://ui.awin.com/merchant-profile/7833): "Commission will not be paid on Crocus eVouchers or real
  Christmas trees." Nothing else.

**Would get us rejected or banned:** brand bidding (APONEO), unapproved vouchers (APONEO), forcing a tracking cookie
without a click (Code rule 10). None of these happen.

### Impact (the network)

The Impact Master Campaign Agreement isn't public on impact.com; its partner help page
(https://help.impact.com/en/support/solutions/articles/48001234655, read 14 Nov 2026) says "All contracts within
impact.com require you to agree to the Impact Master Campaign Agreement". A copy published by an advertiser
(https://www.acehardware.com/affiliate-master-campaign-agreement, read 14 Nov 2026, no date) bars, in Schedule 1
§2.2(b), the use of fake redirects, iframes and hidden frames. **We:** /go is a plain redirect from a click; no frames.
Met. No `networks.impact` block: nothing there sets a rule the code can apply. Read the agreement in full when you
sign up, and update the registry if it adds one.

### FlexOffers (the network; Tesco, Safeway, Costco listings)

Terms: https://www.flexoffers.com/terms-and-conditions, "Updated on June 15, 2026", read 14 Nov 2026. In the
registry under `networks.flexoffers` (`email: "no-links"`), so it reaches every FlexOffers store.

| Clause | Words | We |
|---|---|---|
| 4.13 | "Publishers may not promote any Advertiser program through email, newsletters, SMS, push notifications" without written approval | No store links in email. See risk 5. |
| 4.14 | once approved, "verifiable lawful consent for each recipient as required by applicable law" | Our list is double opt-in (`src/lib/newsletter.ts`). |
| 4.2 | "the referring URL must be an accurate, complete, and unmasked URL" | /go sends the shopper's browser on from our real page; we don't strip the referrer for the store. Check that the /go response keeps a referrer policy that sends our origin. |
| 4.3 | no "system or method that manipulates routing or tracking of traffic sent to advertiser programs." | Met. |
| 4.9 | "bidding on the trademarked terms belonging to any Advertiser is not permitted." | No paid search. |
| 4.17, 4.19 | no outsourcing promotion; a sub-affiliate's activity "shall be deemed Publisher's activity" | We have none. |

### Target Partners (Impact, US)

https://partners.target.com/ and https://partners.target.com/faqs need JavaScript and couldn't be read (14 Nov 2026).
Terms unknown. Status unclear (risk 6). No rules applied.

### Chewy (Impact, US)

https://www.chewy.com/app/content/affiliate-program refused the fetch (14 Nov 2026). Terms unknown. No rules applied.

### Anker (Impact and Rakuten, US)

https://www.anker.com/become-an-affiliate, read 14 Nov 2026. It bars "Hiding links under other content", "Tricking
people into clicking links" and "Putting links directly into search engines"; anker.com copy and images only "on a
case-by-case basis". Its programme agreement isn't linked, so no rule is applied. **We:** buttons name the store, no
paid search, our own photos. Met.

## Consent: notes for W6-B

No programme read here asks the publisher to run its own consent banner before a link is clicked. What they do ask:

- **Walmart §2**: Walmart "may place or recognize cookies on visitors' browsers"; the store sets them after the click,
  on its own site.
- **Amazon, Participation 3(e)**: disclose "the use of cookies, pixels, and other technologies by you and third
  parties" and give "information on the visitor's choices with respect to opting-out from online advertising where
  required by applicable law".
- **Awin UK/DE 12.1**: comply with "Data Regulation", which includes ePrivacy (2002/58) and the GDPR.

So: the privacy page (English and German) should say that after a shopper clicks a buy link, the store and its
affiliate network (Amazon, Awin, Impact, FlexOffers) may set their own cookies on the store's site to credit us, and
link to where the shopper can opt out. Any cookie **we** set to remember where a click came from (`sbc_src`) is
covered by W6-B's consent mechanism, not by these terms.

## Notes for W6-C (readiness)

- Walmart §13 and Amazon's IP License 2(h) want prices refreshed within 24 hours. The code shows a programme's price
  only on a build made the day its feed was read. When a programme with a price rule is joined, the price watch and
  the deploy need to run daily (today both run on Mondays). A readiness check could fail when any `AFF_*` for a
  programme with `terms.prices` is set while the deploy runs less than daily.
- `PROGRAMME_TERMS_OFF` must be empty in production. A readiness check could warn when it is set.

## How this was read

Each page was opened once on 14 Nov 2026 through a fetch tool that returns extracts, so quotes are short pieces of
the original, not whole sections; ellipses mark joins. No store's product or price pages were opened. Pages that
needed JavaScript or refused the fetch are named as unread above. Nothing in this document is legal advice; the
programmes' own affiliate managers are the people to confirm a reading with.

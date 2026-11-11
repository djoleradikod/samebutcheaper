# Affiliate playbook

How SameButCheaper earns money from its outbound links, which programs to join first, and the rules that
can get us banned. Researched 2026-11-04. Full sourced research (54 stores, 6 sub-networks, 16 ranked
categories) is in the project files under `research/affiliate/`. Rates change and many programs hide
them until you're approved, so check each network dashboard before relying on a number.

## How it works in the code

Every buy button goes through `/go/<swap>/<side>` and every store search through `/out`. Both call
`redirectOut` (`src/lib/outbound.ts`), which:

1. Picks the best link for the store (`src/lib/affiliate-links.ts`):
   - a **direct program** for that store's host from `src/lib/affiliate-programs.ts`, if its IDs are set;
   - otherwise a **sub-network** (Skimlinks or Sovrn Commerce) that pays on thousands of stores we haven't joined;
   - otherwise the plain URL, so links never break.
   Amazon is never sent to a sub-network: Skimlinks hasn't paid on Amazon since 2020, and Amazon wants its own tag.
2. Creates a random **click ID** and puts it in the network's sub-ID field (Impact `subId1`, Awin `clickref`,
   Rakuten `u1`, CJ `sid`, Partnerize `pubref`, Skimlinks `xcust`, Sovrn `cuid`). Amazon has no per-click sub-ID.
3. Logs the click (swap, side, store, program, shopper country, click ID) after the redirect is sent. Bots aren't logged.
4. Sends a 302 to the tagged link.

When a network reports a sale to `/api/postback`, the click ID ties it back to the swap. `/admin` then shows:
the share of clicks that carried a tag, commission, **EPC (earnings per click) by swap**, the stores we sent
shoppers to without earning anything (with the program to join), and which programs are live.

Useful commands:

- `npm run affiliate:coverage` shows which catalog links each program covers. On 10 Nov 2026, 785 of 1,052 links (75%)
  go to a store with a direct program. The biggest gaps are Safeway, Uline, Pollin, Aldi, REWE and Apple,
  which only a sub-network can cover.
- `npm run test:links` runs the link-format tests (also in CI).

## Switching programs on

All IDs are env vars, so joining a program is a config change. They are read when the site is **built**
(`next.config.ts` bakes them into `AFFILIATE_CONFIG`), because most pages are prerendered and their "we may earn"
wording has to match what the links do. After changing them, rebuild: `docker compose up -d --build web`. Compose
passes `.env` to the build as the secret `affiliate`, so no Dockerfile change is needed for a new program.

| Network | Account vars (once) | Per store | Example |
|---|---|---|---|
| Amazon Associates | `AMAZON_ASSOCIATE_TAG` (US), `AMAZON_TAGS` (others) | none | `AMAZON_TAGS=amazon.co.uk:sbc-21,amazon.de:sbc0b-21,amazon.ca:sbc0c-20` |
| Impact | none | `AFF_<ID>` = the program's tracking link | `AFF_WALMART_US=https://goto.walmart.com/c/1234567/565706/9383` |
| Awin | `AWIN_PUBLISHER_ID` | `AFF_<ID>=1` (known merchant ID) or the merchant ID | `AFF_SHOPAPOTHEKE=1` |
| Rakuten | `RAKUTEN_SITE_ID` | `AFF_<ID>=1` or the MID | `AFF_WALMART_CA=<mid>` |
| CJ | `CJ_PID` | `AFF_<ID>=1` once approved | `AFF_TESCO=1` |
| Partnerize | none | `AFF_<ID>` = the camref | `AFF_HOLLANDBARRETT=1100l545` |
| FlexOffers and others | none | `AFF_<ID>` = full template | `AFF_WELLCA=<FlexOffers deep link with {url} for the product and {click} in fobs>` |
| Skimlinks / Sovrn | `SKIMLINKS_ID` or `SOVRN_KEY`, `AFFILIATE_FALLBACK` | none | `SKIMLINKS_ID=123456X789012` |

`<ID>` is the program id upper-cased: `walmart-us` becomes `AFF_WALMART_US`. Any program accepts a full template
with `{url}` (encoded), `{raw_url}` and `{click}`. When a sub-network is on, every store
link is disclosed as an affiliate link automatically. German swaps show "Anzeige" under each button that earns.

### Sale postbacks

Set `POSTBACK_SECRET` to a long random string, then register this URL in each network that supports it:

```
https://<site>/api/postback?key=<POSTBACK_SECRET>&network=<impact|awin|rakuten>
```

The endpoint accepts GET or POST (form or JSON) and understands each network's own field names (`SubId1`,
`clickRef`, `u1`, `ActionId`, `transactionId`, `Payout`, `commissionAmount`...), or you can map them
explicitly with `&click=&order=&commission=&sale=&currency=&status=` using the network's macros, for Impact:
`&click={SubId1}&order={ActionId}&commission={Payout}&sale={SaleAmount}&currency={Currency}&status={ActionStatus}`.
Check the exact macro names in the dashboard. A later report for the same order updates its status
(pending, approved, reversed).

**Awin:** under Toolbox, Transaction Notifications, set the call-back method to POST and the URL to
`https://<site>/api/postback?key=<POSTBACK_SECRET>&network=awin`. Awin posts its report as JSON inside one
form field (`AwinTransactionPush`), which the endpoint unpacks. Awin doesn't send a status, so its sales show
as pending; approvals and declines are in the Awin dashboard.

The shopper's IP address, the page URL and the basket contents that some networks send along are dropped
before anything is stored, and the rest of the raw report is deleted after 180 days. Ten wrong keys from one
address lock that address out for 15 minutes.

- **Impact, Awin, Rakuten:** send postbacks.
- **CJ, Skimlinks, Sovrn, Amazon:** report only through their dashboards or APIs. Their sales won't show
  in `/admin` until a report import is built (next step below).

## Where the money is

### The problem today

Half the catalog is OTC medicine, and most cheaper links go to Walmart and Target, which pay the least on it:

- **Target:** health and beauty 1%; household, pet and pharmacy 0%.
- **Walmart:** 1-4% with a 3-day cookie.
- **Amazon US:** health and grocery 1%, beauty, pet and baby 3%.

That is roughly $0.05-0.15 per sale. The biggest gain is routing the traffic we already have to stores that
pay more, not adding categories.

### Best-paying stores for what we already list

| Store | Network | Pays | Cookie |
|---|---|---|---|
| Shop Apotheke (DE) | Awin 13808 | OTC 12% new customers, 3.5% returning | 30 days |
| DocMorris (DE) | Awin | OTC 12% new, 3.5% returning (Awin status unclear since Aug 2026) | - |
| Douglas (DE) | Awin 10076 | 10% | 30 days |
| Pharmacy2U (UK) | Awin 2102 | 5% | 30 days |
| LOOKFANTASTIC (UK) | Awin 2082 | content sites 10% new / 5% returning | 30 days |
| UGREEN (US) | Awin 90851 | up to 15% | 60 days |
| Belkin (US) | Impact | up to 15% | 30 days |
| Momentous (US) | CJ | up to 15% | 45 days |
| Logitech (US) | Impact | 4-10% | 30 days |
| Anker (US) | Impact | about 7.5-8% | 14-30 days |
| Amazon.ca | Associates | pet 9%, beauty 6%, baby 5%, health 3% | 24 h |
| iHerb (all 4 markets) | Awin 76736/76738/76734 | 5%, up to 25% on promos | 7 days |
| Chewy (US) | Impact | 4% | ~15 days |
| Boots (UK) | Awin 2041 | 2% | 14 days |
| APONEO (DE) | Awin 15521 | 1% only | 30 days |

**Stores with no usable program:** Apple hardware (only Apple services pay), Costco (memberships only,
about $3-6), Harbor Freight, H-E-B, Maybelline, medikamente-per-klick, Rossmann, Müller and dm (dm only
through Sovrn).

### Categories worth adding, ranked

Each category is scored 1-5 on three things, multiplied together (maximum 125): payout per click, chance
of converting, and how defensible the "same thing" claim is. The conversion scores are estimates.

1. **OTC medicine through DE and UK online pharmacies (80).** This is the existing catalog, routed to Shop
   Apotheke or Pharmacy2U, and the PL number or Zulassung is our evidence.
2. **Supplements (64).** iHerb, Nutricost (8-10%, 30 days), and Levanta for brands sold on Amazon (about 20%).
   Cite USP, NSF or Informed Choice tests for each product.
3. **Mobile plans on the same network (60).**
   - Visible pays about $58 per activation, Mint $20; giffgaff, SMARTY and congstar are on Awin.
   - Pages must say that the big carrier can put its own customers first at busy times.
4. **Tech accessories bought from the brand (48).** Anker and UGREEN pay 8-15%, against 2.5-3% on Amazon.
5. **Contact lenses (45).** The same lens from a cheaper seller (Vision Direct UK pays 10%). Never suggest a
   "dupe" lens: the prescription names an exact brand.
6. **Telehealth generics (40).**
   - Hims pays $20-40 and Ro $24-40 per new subscriber.
   - Only FDA-approved generics (finasteride, sildenafil, tretinoin). Never compounded GLP-1s: the FDA
     warned Hims' compounding pharmacy in June 2025.
7. **Online glasses (36).** EyeBuyDirect pays up to 15%. Single-vision lenses only; about 1 in 10 online
   orders missed optical standards in a 2021 study.
8. **Refurbished electronics (36).** Back Market pays 5% with a 30-day cookie, about $20 on a $400 phone.
   Call it "the same model, refurbished, with warranty".
9. **OTC hearing aids (24).** About $10 per lead. A 2024 JAMA trial found self-fit aids work as well as
   audiologist-fitted ones.
10. **Pet (24).** Amazon.ca pays 9% on pet, Chewy 4%.

Ranked low: razors (session-only cookie at Dollar Shave Club), ink (1%), mattresses (not the same
product), and baby formula (excellent equivalence, but 1-5%).

## Sign-up order

**First:** the site has to be live on its real domain with a disclosure page, About page, privacy policy
and 10+ indexed pages. Most networks reject a site they can't browse.

1. **Awin** (one account covers UK, DE and US merchants). Apply to Shop Apotheke, Pharmacy2U,
   LOOKFANTASTIC, Boots, UGREEN, iHerb, Douglas, Flaconi and Back Market.
2. **Impact.** Apply to Walmart, Target, Chewy, Belkin, Logitech, Anker, Ulta, CVS, Thorne and PetSmart.
3. **Skimlinks** (or Sovrn, which approves faster) as the safety net for everything else: Tesco, Loblaws,
   Costco, Apple, dm.
4. **CJ** (Tesco, Sainsbury's, PC Express, Walgreens, Momentous) and **Rakuten** (Walmart.ca, Sam's Club,
   Superdrug).
5. **Amazon Associates US, then UK, DE and CA** once traffic is steady. The account closes unless it makes
   3 sales within 180 days. OneLink then sends US links to the shopper's local store, but needs each
   country's account.

## Rules that can get us banned

1. **Walmart's terms ban "price tracking or price alert features".** They only allow prices that Walmart
   supplies, updated within 24 h of a change, with a note that Walmart's price applies. Our catalog
   prices are monthly snapshots. Before applying, either show "checked <date>" with no Walmart price, or
   pull prices from Walmart's affiliate product API. Don't build price alerts for Walmart products.
2. **Amazon** only allows prices from its own API. PA-API 5 shut down in May 2026, and the Creators API
   that replaces it needs 10 qualifying sales in the trailing 30 days. Until then, don't show Amazon prices
   in `data/pairs`; link to Amazon without one.
   - Amazon links in email only go to subscribers who opted in.
   - Never link Amazon from offline material.
3. **Disclosure.** The line under each swap's prices says which links are affiliate links, and on German swaps
   each earning button carries "Anzeige", on UK and Irish swaps "Ad" (`adLabel` in the swap page). The UK ASA wants "Ad", and German law needs "Anzeige" or "Werbung" at
   the link; "Affiliate-Link" alone is not enough. Every outbound link carries `rel="sponsored"`.
4. **Never touch someone else's affiliate cookie.** That means no auto-applying coupon extension (the Honey
   case survived the motion to dismiss in June 2026) and no cookie stuffing. Only tag a link the shopper
   clicked on our site.
5. **Pharmacy2U's terms forbid "automatic redirects".** That most likely means forced redirects, not a
   button the shopper clicks that goes through `/go`, but ask their affiliate manager before relying on it.
6. **Flea and tick wording.** In *Merial v. Fidopharm* (2014), a court held that calling PetArmor the
   "generic" of Frontline Plus, or saying it had the "same active ingredient", was literally false once
   Frontline added a second active ingredient. Say only "contains fipronil and (S)-methoprene, like
   Frontline Plus" when that is what both labels say. Review the pet pairs.
7. **UGREEN bans bidding on its brand in search ads.** Read each program's paid-search rules before running ads.

## Next steps that raise earnings

- **Route by country and EPC.** Send DE and UK shoppers to the local pharmacy that pays 12% or 5%. When two
  stores sell the identical product, show the one with the higher EPC first. Equivalence and price always
  decide which product we recommend; EPC only picks between identical offers.
- **Bundles from one store**, so one cookie covers the whole cart.
- **Report import** for CJ, Skimlinks, Sovrn and Amazon (their APIs or CSVs into `conversions`), so
  `/admin` EPC covers every network.
- **Amazon storefront by country.** Use the shopper's own Amazon store and tag for Amazon links (OneLink
  does this on Amazon's side once the accounts are linked).
- **Placement tests:** log a placement (hero button, product card, where-to-buy) with each click and
  compare EPC.

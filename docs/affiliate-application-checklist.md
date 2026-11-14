# Affiliate applications: checklist for the top five

14 Nov 2026. For the owner. The five programmes that would make the most of our buy links
(docs/research/R9-programmes.md): Walmart, APONEO, Target, Tesco and myTime. Amazon Associates comes after them in
reach but has its own section, because its terms shape the site most. What each programme's terms make us do, with
the clauses quoted, is in docs/research/R11-programme-terms.md; this is the practical side: what to have ready,
what to write, in what order, and what to set afterwards.

## Before any application

Reviewers browse the site. Have these live on the real domain first (docs/affiliate-playbook.md, "Sign-up order"):

- [ ] The site live on its own domain over HTTPS, with at least 10 pages indexed by Google.
- [ ] /about, /disclosure, /privacy and /how-we-verify reachable from the footer of every page.
- [ ] /privacy says that after a shopper clicks a buy link, the store and its affiliate network may set their own
      cookies on the store's site, and how to opt out (Amazon Participation 3(e); W6-B is doing the consent work).
- [ ] An email address on our domain for affiliate managers (not a personal one).
- [ ] Legal name, postal address and tax details for payouts: a W-9 (US person) or W-8BEN / W-8BEN-E (not a US
      person) for Impact and Amazon; VAT number if registered, for Awin.
- [ ] A bank account or PayPal in the payout currency (USD for Impact and Amazon US; GBP/EUR for Awin and CJ).
- [ ] Traffic figures from analytics (monthly visitors, top countries). Don't estimate: give the real numbers or say
      the site is new.
- [ ] `PROGRAMME_TERMS_OFF` empty on the server. A programme's rules then apply from the build in which its `AFF_*` setting or feed line is first set (R11, "Switching it"). Preview that build first with `PROGRAMME_TERMS_ON=<store>`.
- [ ] Decide on the `/dupe/` addresses before Walmart (R11, risk 1).

## Order to apply

1. **Awin: APONEO and myTime** (DE). One Awin publisher account, then one application per advertiser. Awin's code
   of conduct and these two programmes ask for nothing the site doesn't already do, and German swaps are the
   largest market (184 swaps). Add zooplus, Netto and ALTERNATE in the same session: same account, same answers.
2. **Walmart** (US, through Impact). The most swaps of any programme, and the strictest terms. Apply once the
   `/dupe/` decision is made, and send the question about Exhibit A item 16 (R11, risk 2) to
   affiliates-help-ext@wal-mart.com with the application or straight after. Walmart prices stay withheld until its
   feed is read daily, which is what its terms want.
3. **Tesco** (GB). affiliate-programs.ts files it as a CJ programme ("CJ exclusive since Jan 2025"); R9 found a
   FlexOffers listing. Apply on CJ first. If it ends up on FlexOffers, read R11's FlexOffers section on email first.
4. **Amazon Associates** (US, then UK) once traffic is steady: the account closes without 3 qualifying sales in its
   first 180 days, and the Creators API (needed before any Amazon price can be shown) needs sales first.
5. **Target Partners** (US, Impact) last, after checking it still takes applications (R11, risk 6).

## Answers to the usual questions

Fill the bracketed parts; everything else can be pasted. The same answers suit Awin, Impact, CJ and Amazon forms.

**Website URL.** `https://<our domain>`

**What is your website about? (description)**
SameButCheaper compares a branded product with a cheaper product that has the same active ingredients or the same
specification, side by side: both ingredient lists, what matches, what differs, and where each is sold. Every swap
names its sources (official ingredient listings, government databases, independent tests) and the date we checked
it. We cover health, beauty, household, baby, pet, grocery and electronics in the US, the UK, Ireland, Canada and
Germany, in English and German.

**How will you promote our products? (promotional methods)**
Content and comparison pages. Each swap page has a button to the store that sells each product; the button names
the store. We don't buy ads, don't bid on any brand or store name in search, don't run coupon or cashback offers,
don't pay or reward visitors for clicks or purchases, and have no browser extension. Links go through our own
redirect (`/go/...`) so we can count clicks; it sends the visitor straight to the store's product page, and the
button always says which store it opens.

**Do you use email marketing?**
We send a weekly email to subscribers who confirmed their subscription twice (double opt-in), with an unsubscribe
link and headers in every message. The emails link only to pages on our own site, never to a store or an affiliate
link. [For Walmart:] Walmart products are left out of our emails entirely, as your terms require without written
permission.

**Do you show prices? Where do they come from?**
We show prices only where the store's terms allow it. Where a programme supplies a product feed, we show the feed's
price with the date it was read; where its terms allow only its own prices (Walmart, Amazon), our pages show no
price and say "See the price at <store>" until we read the programme's feed or API. We have no price alerts or price
tracking for stores whose terms bar them.

**How do you disclose affiliate links?**
Every page's footer and our /disclosure page say that some links earn us a commission and that this never changes
which swaps we list or how we rank them. Each earning button carries a label: "Paid link" for Walmart, "Ad" on UK
and Irish pages, "Anzeige" on German pages. Every outbound link has `rel="sponsored"`.

**Do you use paid search / PPC? Brand bidding?** No.

**Do you use sub-affiliates or a sub-network?** We are not a network and have no sub-affiliates. For stores without
a programme of ours we may use Skimlinks or Sovrn; a store whose own programme we have joined always gets its own
link.

**Coupons, vouchers, cashback, incentives?** None.

**Monthly visitors / page views / top countries.** [From analytics. If new: "The site launched on <date>; current
monthly visitors are <n>."]

**Social media.** [Accounts, or "None yet."]

**Anything we should know about your content?** We don't list prescription medicine. Health swaps carry a notice to
read the label and ask a pharmacist. We don't call products "dupes" and don't list look-alikes or knock-offs.

## After joining: settings and how to check each

All `AFF_*`, `AMAZON_*` and `AWIN_*` settings are read when the site is **built**: set them in `.env` on the server
and rebuild (`docker compose up -d --build web`, docs/affiliate-playbook.md). Feed lines go in the GitHub repository
secret `PRICE_FEED_URLS`, one per line (docs/feeds.md).

For each programme the same three checks apply:

- **/admin** lists the programme as live.
- **A buy button** goes through the programme: `curl -sI https://<domain>/go/<swap slug>/alternative | grep -i location`
  shows the network's tracking address. (This records one click in our own log.)
- **The page's wording** changes: the footer and the line under a swap's prices say links may earn us money.

### APONEO and myTime (Awin)

```
AWIN_PUBLISHER_ID=<your Awin publisher id>
AFF_APONEO=1
AFF_MYTIME_DE=14902
```

For APONEO, `1` uses the merchant id already in `src/lib/affiliate-programs.ts` (15521). myTime has none there, so
give its merchant id from the Awin profile (14902 on 14 Nov 2026). Neither has a price
rule in the registry, so no feed is needed for their prices to show. If APONEO offers a feed in Awin's Create-a-Feed,
add it to keep prices current:

```
awin:aponeo@DE=https://productdata.awin.com/datafeed/download/apikey/...
```

Check: GitHub > Actions > Price watch > Run workflow, tick Report only, choose feed. The run's Sources list shows
`feed: awin:aponeo@DE: <rows> rows, <n> of <m> record sides matched`. myTime isn't a named retailer in
`src/lib/markets.ts` (its links are "other" stores), so a feed line for it is refused as an unknown retailer; that
needs a code change before its feed can be read.

### Walmart (Impact)

```
AFF_WALMART_US=<the tracking link from Walmart's page in Impact>
```

```
impact:walmart@US=https://ACCOUNT_SID:AUTH_TOKEN@api.impact.com/Mediapartners/ACCOUNT_SID/Catalogs/CATALOG_ID/Items
```

Then **change the price watch and the deploy to run daily** (`.github/workflows/price-watch.yml` and `deploy.yml`
run on Mondays today). Walmart's terms want prices updated within 24 hours, and the code shows a Walmart price only
on a build made the day its feed was read; on any other day the pages keep saying "See the price at Walmart".

Check, after a feed run is merged and the site rebuilt the same day:

- The build log's line `Programme terms: prices withheld on <n> swaps` shows a smaller number than before
  (120 on 14 Nov 2026, of which 103 US).
- A US swap with Walmart on the cheaper side shows its price, with "If the price at Walmart differs, Walmart's price
  applies." under the price table, and "Paid link" beside the Walmart button.
- No price watch box on that swap (Walmart bars price alerts).

### Tesco (CJ, or FlexOffers)

On CJ:

```
CJ_PID=<your CJ property id>
AFF_TESCO=1
cj:tesco@GB=<the feed download address from CJ>
```

On FlexOffers instead: `AFF_TESCO=<FlexOffers deep link template with {url} and {click}>`, `FLEXOFFERS_API_KEY` as a
second repository secret, and `flexoffers:tesco@GB=<feed address>` (docs/feeds.md, "FlexOffers or Sale Gains").
Check with a Report only run as above; then the three checks.

### Target Partners (Impact)

```
AFF_TARGET=<the tracking link from Target's page in Impact>
impact:target@US=https://ACCOUNT_SID:AUTH_TOKEN@api.impact.com/Mediapartners/ACCOUNT_SID/Catalogs/CATALOG_ID/Items
```

Target's terms couldn't be read (R11), so the registry has no rules for it. Read them when you sign up, and add any
rule they state to `data/sellers/programmes.json` with the clause quoted, before switching it on.

### Amazon Associates

```
AMAZON_ASSOCIATE_TAG=<your amazon.com tag, ending -20>
AMAZON_TAGS=amazon.co.uk:<tag>-21
```

There is no price feed for Amazon: its terms allow prices only from the Creators API or PA API, which we don't read
yet, so every Amazon price stays withheld ("See the price at Amazon") whatever is set here. Check: the footer on
every page now says "As an Amazon Associate we earn from qualifying purchases.", and an Amazon button's `/go` link
redirects to an address carrying `tag=<your tag>`.

## If a programme says no

Ask the affiliate manager for the reason in writing, fix it, and reapply after the period they give. Don't apply to
the same programme through a second network or a sub-network to get round a refusal: most terms (Walmart Exhibit B,
FlexOffers 4.17) treat that as a breach.

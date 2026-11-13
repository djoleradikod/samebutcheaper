# R9: which affiliate programmes to join first

13 Nov 2026. For the owner: the programmes that would make the most of our buy links earn, in the order to apply.
Nothing here is switched on; joining is a sign-up, then one setting (`docs/affiliate-playbook.md`, `docs/feeds.md`).

## How this was ranked

- **Reach**: for each programme, the swaps with a buy link at its store (either side) and the kit links (a kit's own
  link or one of its pieces), counted from the catalogue on 13 Nov 2026 (491 swaps, 44 kits). Only the markets the
  programme pays for count: Walmart's US programme doesn't count the two Canadian swaps that link walmart.ca, and
  Lidl's German one doesn't count lidl.co.uk. "Cheaper-side links" is how many of those swaps send the shopper there
  for the product we recommend, which is the click most likely to buy.
- **Click share**: the share of outbound clicks each programme's stores got. No clicks are recorded yet (the site
  isn't launched), so the column says n/a. Re-run once there is traffic:
  `DATABASE_URL=... npx tsx scripts/revenue/rank-programmes.ts`. After launch, `npm run report:revenue` ranks
  untagged clicks by store, which is the better guide once real shoppers pick.
- **Which network**: from `data/sellers/programmes.json`, where every claim has the network's or the store's own
  public page as its source. A programme whose page couldn't be read is in the second table, as unknown.
- Commission and cookie terms are as those pages showed them on 13 Nov 2026. They change; check before applying.

## Ranked

| # | Programme | Network | Markets | Swaps | Cheaper-side links | Kit links | Click share | Terms seen | Sign up |
|---:|---|---|---|---:|---:|---:|---:|---|---|
| 1 | Walmart (walmart-us) | Impact | US | 95 | 71 | 52 | n/a | Rates in Walmart's tables, not public. Terms ban price alerts for Walmart products. | https://affiliates.walmart.com/ |
| 2 | APONEO (aponeo) | Awin 15521 | DE | 44 | 44 | 15 | n/a | 1% of net merchandise value, 30 days | https://ui.awin.com/merchant-profile/15521 |
| 3 | Target Partners (target) | Impact (not reconfirmed: page needs JavaScript) | US | 21 | 14 | 37 | n/a | not read | https://partners.target.com/ |
| 4 | Tesco (tesco) | FlexOffers listing | GB | 55 | 24 | 0 | n/a | 1.6% marketplace and F&F, 3.2% new customers, 30 days; status not shown | https://www.flexoffers.com/affiliate-programs/tesco-stores-affiliate-program |
| 5 | myTime (mytime-de) | Awin 14902 | DE | 33 | 33 | 0 | n/a | 7% new, 2% existing, 60 days | https://ui.awin.com/merchant-profile/14902 |
| 6 | zooplus (zooplus-de, zooplus-ie) | Awin 11330 (DE), 33309 (IE) | DE, IE | 31 | 30 | 0 | n/a | DE 3% first three orders then 1%; IE 6% first order then 2%; 30 days; daily CSV product data | https://ui.awin.com/merchant-profile/11330 and https://ui.awin.com/merchant-profile/33309 |
| 7 | Amazon Associates (amazon) | Amazon | GB, US | 25 | 20 | 0 | n/a | per storefront; account closes without 3 sales in 180 days | https://affiliate-program.amazon.com/ (UK: https://affiliate-program.amazon.co.uk) |
| 8 | Netto Marken-Discount (netto-de) | Awin 13812 | DE | 24 | 17 | 0 | n/a | 4% standard, 60 days | https://ui.awin.com/merchant-profile/13812 |
| 9 | Safeway | FlexOffers listing | US | 20 | 19 | 0 | n/a | not shown | https://www.flexoffers.com/affiliate-programs/safeway-com-affiliate-program/ |
| 10 | ALTERNATE (alternate-de) | Awin 11731 | DE | 15 | 15 | 0 | n/a | pay per sale, rate not public, 30 days | https://ui.awin.com/merchant-profile/11731 |
| 11 | Anker (anker) | Impact (also Rakuten) | US | 5 | 5 | 10 | n/a | 8%, 30 days | https://www.anker.com/become-an-affiliate |
| 12 | Costco | FlexOffers listing | US | 9 | 9 | 2 | n/a | memberships only: product links won't earn | https://www.flexoffers.com/affiliate-programs/costco-membership-affiliate-program/ |
| 13 | Lidl (lidl-de) | Awin, by Lidl's own page | DE | 10 | 7 | 0 | n/a | up to 5% per online order | https://www.lidl.de/c/das-lidl-partnerprogramm/s10005552 |
| 14 | Pollin Electronic (pollin-de) | Awin 15965 | DE | 9 | 9 | 0 | n/a | not read (profile answered with an error) | https://ui.awin.com/merchant-profile-terms/15965 |
| 15 | Chewy (chewy) | Impact | US | 6 | 5 | 0 | n/a | not read this round | https://www.chewy.com/app/content/affiliate-program |
| 16 | Crocus (crocus) | Awin 7833 | GB | 6 | 6 | 0 | n/a | 10% plants, 7% products, 30 days | https://ui.awin.com/merchant-profile/7833 |
| 17 | Sam's Club (samsclub) | Rakuten | US | 6 | 6 | 0 | n/a | not shown | https://samsclub.com/content/affiliates |
| 18 | Shop Apotheke (shopapotheke) | Awin 13808 | DE | 3 | 2 | 2 | n/a | 12% new, 3.5% existing; none on prescription medicines or infant formula; 30 days | https://ui.awin.com/merchant-profile/13808 |
| 19 | The Ordinary (theordinary) | Awin 29849 | GB, DE | 0 | 0 | 4 | n/a | rate not public, 30 days | https://ui.awin.com/merchant-profile/29849 |
| 20 | UGREEN (ugreen) | Awin 90851 | US | 1 | 1 | 2 | n/a | up to 15%, 60 days | https://ui.awin.com/merchant-profile/90851 |
| 21 | Boots (boots) | Awin 2041 | GB | 2 | 0 | 0 | n/a | 2% most categories, 0% baby milk, 14 days | https://ui.awin.com/merchant-profile/2041 |
| 22 | LOOKFANTASTIC (lookfantastic) | Awin 2082 | GB | 0 | 0 | 2 | n/a | content sites 10% new, 5% existing, 30 days | https://ui.awin.com/merchant-profile/2082 |
| 23 | Superdrug (superdrug) | Awin 127687 | GB | 1 | 1 | 0 | n/a | rate not public, 30 days | https://ui.awin.com/merchant-profile/127687 |

Apple is left out on purpose: its Performance Partners programme pays on Apple Services, not on the hardware we
link (https://performance-partners.apple.com/faq).

## What to do, in order

1. **Awin, one account, then seven programmes**: APONEO, myTime, zooplus DE and IE, Netto, ALTERNATE, Lidl DE,
   Pollin. Together up to 166 swaps (a swap linked at two of these stores counts once for each) and 15 kit links, all German or Irish, and zooplus sends a daily product feed the price
   watch already reads (`docs/feeds.md`). One sign-up (`AWIN_PUBLISHER_ID`) covers them all; Crocus, Boots,
   Superdrug, LOOKFANTASTIC, The Ordinary, UGREEN and Shop Apotheke come with it.
2. **Impact, then Walmart and Target**: up to 116 swaps and 89 kit links, the largest single reach. Walmart's terms ban
   price alerts for Walmart products and want its own prices refreshed within 24 hours, so read
   `docs/affiliate-playbook.md`, "Rules that can get us banned", before applying. Anker and Chewy are on Impact too.
3. **FlexOffers, for Tesco**: 55 UK swaps. The listing shows no status or country, so ask FlexOffers whether it is
   Tesco's UK grocery programme before relying on it. Safeway (20 US swaps) is listed there too.
4. **Amazon Associates**, once traffic is steady (25 swaps), for the reason in the playbook: three sales in 180 days
   or the account closes.

Per click, the German pharmacies and myTime pay best for what we list: Shop Apotheke 12% on a new customer against
APONEO's 1%, though APONEO carries 44 swaps to Shop Apotheke's 3. Where both sell the same pack, routing to the
better payer is in the playbook's "Next steps".

## Stores with no programme found yet

Ordered by reach. "Not looked up" means no search was made this round; it doesn't mean there is no programme.

| Store | Markets | Swaps | Kit links | What we know |
|---|---|---:|---:|---|
| aldi | DE, GB, US | 25 | 0 | No programme page found for Aldi UK, Aldi Nord, Aldi Süd or Aldi US. |
| rewe | DE | 23 | 0 | REWE has a partner programme page (https://www.rewe.de/partnerprogramm/) that couldn't be opened from here; network not confirmed. Worth checking by hand first: 23 swaps. |
| viking | GB | 17 | 0 | affiliate-programs.ts lists Viking GB on Partnerize; no programme page was opened to confirm it. |
| uline | US | 13 | 0 | No programme page found. |
| rossmann | DE | 12 | 0 | No open programme page found; directories list its Webgains and Affilinet programmes as closed. |
| sainsburys | GB | 12 | 0 | No open grocery programme page found; directories list it as retired. |
| kaufland | DE | 11 | 0 | No public programme page found. |
| toolstation | GB | 10 | 0 | affiliate-programs.ts lists it on Awin; no Awin profile was found to confirm it. |
| dm | DE | 9 | 0 | No dm programme page found. |
| loblaws | CA | 9 | 0 | affiliate-programs.ts lists PC Express on CJ; not confirmed. |
| edeka | DE | 7 | 0 | Not looked up. |
| ulta | US | 0 | 7 | affiliate-programs.ts lists it on Impact; not confirmed. |
| morrisons | GB | 6 | 0 | Not looked up. |
| logitech | US | 2 | 3 | affiliate-programs.ts lists it on Impact; not confirmed. |

The rest (fewer than five links each: Asda, brand shops such as Autoglym and Persil, Co-op, Waitrose, Ocado and
others) are listed with notes in `data/sellers/programmes.json`. A sub-network (Skimlinks or Sovrn) would tag many
of these without separate sign-ups.

## Sources

Each row's source is in `data/sellers/programmes.json`. Pages were read on 13 Nov 2026 through a summarising fetch
tool, without signing in. Pages that couldn't be opened from here: Pollin's Awin profile, REWE's partner page,
Target Partners (needs JavaScript), Chewy's affiliate page (read for R7 the same day, refused this round).
Third-party directories (affi.io, affilitizer, linkclicky) were used to find pages, never as the source of a claim.

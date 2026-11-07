# SameButCheaper gauntlet handover, 7 Nov 2026

Owner push of 6 Nov. Brief: `~/ops/owner-push-20261106/samebutcheaper.md` and `shared-brief.md`. Older working notes and tools: `~/ops/sbc-push-20261106/HANDOVER.md`.

The critic has not picked ours on every piece, so the gauntlet is not finished. This branch is landing because the week's budget is running out, on the coordinator's instruction. See "Where it stands".

## Country round, 7 Nov (read this first)

samebutcheaper-95, brief `~/ops/owner-push-20261107/samebutcheaper.md`, "country fix only". Stopped at the week's 85% line, so **this round isn't finished and has no PR.** Branch `worktree-country`, worktree `.claude/worktrees/country`, pushed. Round 2's review fixes are `7a50d04`, the country work is `45858a2`. `:8851` serves `45858a2` for the owner's Ireland test, not main, until this merges.

**Done.** The selected country sets the currency, the prices that lead and the stores we link, on every page that shows a price. Rules are in `src/lib/localize.ts` and at the end of `data/README.md`. Pages now render per request under one Suspense in the root layout, so the first paint is right. Rates are the ECB's of 6 Nov 2026. Ireland gets Amazon.ie, SuperValu, Lidl Ireland and, in tools and garden, Woodie's, each opened and returning results.

**Checks on `45858a2`, through the lane.** Catalog, typegen, typecheck, lint, rules and build all exit 0. `country_http.py` 58 of 58. `interact_check.py` failed 0. LCP on the throttled profile, with no country cookie: 0.85 s on `/`, 0.84 s on `/bulk`, against a 0.74 s worst median on the round 10 build, which isn't the same page set.

**`country_check.py` failed 4, exit 1. Clear these before any PR.**
- `DE`, `GB` and `HR` on `/category/household`: "shows the symbol" failed, and that's the check's fault. The served page has 96 small-unit prices such as "37 ct" and "37p" and no symbol. Let `country_check.py` accept those.
- **Picker, the one that matters: after choosing Ireland from the US in a real browser, the page still named a US store.** The band and euro had changed. Not diagnosed. It may be `router.refresh()` not replacing the list, or the check reading too early. This is the flow the owner will use. Reproduce it first.

**Asked for by the coordinator and not started: the seller filter.** Ireland still lists swaps it can't buy, such as "Tony's Chocolonely to Sainsbury's", because the chain is in the product name. The ask: by default a fallback country lists a swap only if the cheaper product's seller operates in or ships to that country, everything else sits behind one plain control ("Show swaps from other countries"), `country_http.py` fails on a named UK-only or German-only chain on IE pages, and the new numbers get reported. Fewer honest swaps beat more wrong ones.

What I found for it:
- The seller isn't always `retailer`. 15 UK `other` rows are on amazon.co.uk, 32 German `other` rows are myTime's Jeden Tag on mytime.de, and the one Ocado row is Marks & Spencer's.
- Sells in Ireland, seen on an Irish site that opened: Lidl (lidl.ie), Viking (vikingdirect.ie), zooplus (zooplus.ie), IKEA (ikea.com/ie), Marks & Spencer (marksandspencer.com/ie), Amazon (amazon.ie).
- Weaker: tesco.ie and aldi.ie exist but answer automated requests with 403. A tesco.ie help page turned up in search and an Irish Times piece names Tesco among Ireland's biggest chains; Aldi Ireland rests on the host alone. Someone should open both.
- No evidence it sells in Ireland, so hide it by default: Sainsbury's, Asda, Morrisons, Waitrose, Ocado, Co-op, Crocus, Seven Day Shop, Toolstation and the German chains. Superdrug's delivery page says "UK & Ireland only" for one offer, which is unclear. alternate.ie just redirects to alternate.de. The only source on Sainsbury's and Asda is from 2009, so this is absence of evidence, not proof they don't.
- A whitelist on that evidence would leave Ireland about 108 of 270 swaps: UK 83 (Tesco 24, Viking 17, Aldi 16, Amazon 15, Lidl 9, IKEA 1, M&S 1), Germany 25 (zooplus 12, Lidl 7, Aldi 6). Counted from the catalogue by seller, not built. Baskets aren't counted: one with any hidden line would have to go.
- Other fallback countries have no verified table. Footprint searches didn't give usable lists for Lidl, Aldi, dm, Rossmann or Müller. Opening each chain's national site and matching its title is the cheap way. Without a table the same rule leaves them only their Amazon rows, so say so rather than guess.
- A shape that fits: `sellers` on Pair, Bundle and Preset, worked out when `catalog.ts` loads and carried on the summaries in `/search/index.json`; `forCountry` takes the country plus a show-others flag from a cookie; the control lives in `FallbackBand`.

**Still open after that.** Items 2 to 4 of the brief (rating floor, research, clothing) and real Irish prices haven't started. Tesco Ireland, Dunnes, Aldi Ireland and Boots Ireland search links aren't added, because they refused automated checks. `/why` and swap evidence text can still cite US sources, and a US swap opened by direct link still works, in euro with no US store offered in its price table.

**Independent review of `45858a2`: fix 1 to 6 before any PR.** "Seen" means I confirmed it on the served preview or in the source; the rest are the reviewer's reading, unchecked. `country_http.py` missed these because it only looks for store names and `$`, so widen it too.

1. **Seen: Ireland's home page still shows US products.** `bulkRows` (`src/app/page.tsx:135`) uses all pairs, and the aisle tiles (`page.tsx:320`) use `bestPhoto` on an unfiltered aisle. The IE response contains Charmin, Jif, Kirkland, Equate and Parent's Choice, with a link to a Charmin swap. Wrap both in `forCountry`.
2. **Seen in source: My List adds currencies 1:1 for a visitor with no country.** `MyList.tsx:45`: a £10 and a €5 swap read "Save $15". Total per currency when `!local.known`.
3. Prices in written catalogue text stay in the record's currency, unmarked: summaries, heroes, differences and researched rows (`WhyBlock.tsx:141`, `dupe/[slug]/page.tsx:131,133,180`, `compare/[slug]/page.tsx:68-72,518`, `bundle/[slug]/page.tsx:94,276`). About 50 of 120 UK summaries. Suggested: drop a sentence holding a price when `local.converts(currency)`, through one helper.
4. `/check`. **Seen in source:** `check/page.tsx:130` reads only the cookie, so a first visit misses the detected country; use `getCountry()`. Not checked: `ProductReport.tsx:229` shows FDA panel lines naming Walgreens or Costco; limit it to the US and Canada.
5. `/ingredient`, `/brand`, `/dupe`. **Seen:** `/ingredient/loratadine` in IE still names Equate, and `/brand/frontline` shows its counts and then "haven't priced". Not checked: about 105 of 278 brands have nothing visible in IE, and `/dupe` falls back to US cards when nothing's near (about 19 pages). Compute counts from filtered records, and guard the `reduce` at `ingredient/[slug]/page.tsx:29`, which throws on an empty list once filtered.
6. **Seen, and caused by this round: `/brand/nope`, `/ingredient/nope` and `/category/nope` return 200, not 404.** `notFound()` now runs after the status is sent. Add those three to `known-slugs.json` (`scripts/build-catalog.ts:551`) and to `KNOWN` in `src/proxy.ts`.

Not checked, smaller:
- Search says 440 swaps and lists brands with nothing in IE (`search/page.tsx:16-21,48`).
- Short lists can lead with German records in IE (`ShelfParts.tsx:220`, `lookup/index.ts:97`).
- `bundle/[slug]/page.tsx:302` links to `#where-to-buy`, which has no target.
- Another tab doesn't refresh when it picks up a new country on focus (`client/country.ts:22`).
- `isKnownCountry` accepts `constructor` through `in` (`markets.ts:126`), which breaks the page for that sender only. Use `Object.hasOwn`.
- `LocalSearch.tsx:41` offers Woodie's for paracetamol, because it passes no aisle.

**Three choices for the owner.**
- The root Suspense has a cost. **Seen:** every page's body, `/about` and `/privacy` included, now arrives in a hidden wrapper plus a script, so it stays blank without JavaScript, and crawlers that don't run scripts get hidden content. Fixing that means moving the Suspense down to the parts that need the country. Recommendation: keep it for this fix, since nothing's public, and move it down before go-live.
- Own-label names: 35 UK and German cheaper products carry a store in the name, next to "A UK store". The seller filter above covers this.
- My List and shared links keep US records. Filtering them makes saved items vanish, so if they're filtered the page should say how many were hidden.

**Needs the owner:** `EnterWorktree` on this worktree was auto-denied at the start. Working in it by path did the job, so nothing is blocked.

## Round 2, 7 Nov

The owner's "keep going and merge", brief `~/ops/owner-push-20261106/round2.md`, lead samebutcheaper-94. No critic round this time, so the verdicts below are from before these changes.

- **Disclosure.** No affiliate tag is set, so the site now says no link earns anything. Footer, home, `/about`, `/how-we-verify`, `/disclosure`, swap and bundle pages all follow `linksEarn`, `amazonEarns` and `mayEarn` in `src/lib/affiliate.ts`. The old wording comes back by itself once a tag is set. `next.config.ts` fixes the tags at build time, so links can't start earning under pages built saying they don't: a tag set only at run time now does nothing, and setting one means a rebuild. The Dockerfile and compose pass them as build args. That part hasn't been run, because docker is refused here.
- **`/bulk`.** One list with one row format, sorted as the shopper picks. Before, shelf-life sections broke the sort, so "Most saved" could open on -11% with -39% further down. Shelf life is now a filter with counts and a line on each row. New on each row: what that pack costs less than the same amount in normal packs, and how much less per unit it costs than the brand. "Most saved against the brand" now sorts on that bigger-pack figure. Desktop gets a filter rail, phone gets selects.
- **Photos.** None added. All 7 Open Facts records that could match in tools, car, tech, garden and office failed by eye (reasons in `docs/research/R2-reuse.md`). Those aisles stay at 0/18, 0/11, 1/32, 1/9 and 2/9.
- **Card `sbc-same-job-proof`.** The lists are in `docs/status/2026-11-07-same-job-proof-list.md` and on the page https://claude.ai/artifact/NYr41rifBRCJH5Tdyp4XdG, regenerated with `scripts/qa/same_job_list.ts`. Today's catalogue gives 30 and 26, against the card's 38 and 26, and 58 on a strict reading. The rule is unchanged.

Left as they are, for the coordinator or the owner: the privacy page still says retailer cookies are "how affiliate purchases are credited". It's a general statement and legal text, so it wasn't touched. Store links still carry `rel="sponsored"` with no tag set, which readers don't see. The tags-set `/disclosure` keeps Amazon's program wording naming Amazon.com, even if only another storefront has a tag. Links on `/bulk` go to the store with no tag even once tags are set, which is honest but earns nothing. PR 2 touches the same disclosure, affiliate, swap, basket, Docker and compose files, so it will need a merge by hand when it lands.

## Where it stands

Each page's last blind verdict, with labels stripped. Overall is the critic's pick; looks is a second pick on appearance alone.

Round 10, all 13 pairs, on the build merged as PR 3:

| Page | Against | Overall | Looks |
|---|---|---|---|
| Home, desktop | geizhals, live | ours | ours |
| Home, desktop | idealo, archive Nov 2026 | ours | idealo |
| Home, phone | geizhals, live | ours | ours |
| Home, phone | camelcamelcamel, live | ours | ours |
| Category, desktop | idealo, archive Oct 2026 | ours | ours |
| Category, phone | idealo, archive Oct 2026 | ours | idealo |
| Category, phone | camelcamelcamel, live | ours | ours |
| Household aisle, desktop | geizhals, archive Oct 2026 | ours | geizhals |
| Bulk, desktop | geizhals, archive Oct 2026 | geizhals | geizhals |
| Basket, desktop | idealo product, archive Sep 2026 | ours | ours |
| Swap with strong evidence, desktop | idealo product, archive Sep 2026 | ours | ours |
| Swap with strong evidence, phone | camelcamelcamel product, live | ours | ours |
| Swap with thin evidence, desktop | idealo product, archive Sep 2026 | idealo | ours |

So 11 of 13 win overall and 8 of 13 win both. Verdicts move between rounds: category desktop against idealo won on looks only in round 10, after losing in rounds 6 to 9, and the thin swap won overall in round 7 and lost it in rounds 6, 9 and 10. Treat one pick as one reader's view, not a measurement.

Round 10 predates the second review's fixes, which change labels and copy, not layout or photos. `/why` was never judged on its own. Camelcamelcamel desktop and geizhals product weren't usable as bars: both refused our browser (403). One critic noted that redaction missed camelcamelcamel's name on one screen of the home phone pair.

Numbers: 440 swaps, 39 brand kits, 29 baskets. Real photo on at least one side 239 (54%), both sides 117 (27%), and 32.5% on both sides outside medicine; DailyMed is neither shown nor counted. Medicine 83 (19%) counting remedies in other aisles, 73 (17%) in its own aisle, from 50%. All 440 cite two different sites, in one unit on both sides; 8 more are held back. Labels: 277 does the same job, 103 same active, 14 same formula, 2 same maker, 44 same kind. LCP worst median 0.74 s on the round 10 build, on the throttled LAN profile, target under 2.5 s.

Two independent reviews read the code. The first found 9 blocking and 2 minor faults on the branch. The second read the fix commit and found 4 blocking and 4 minor faults, mostly records and pages the first fixes hadn't reached. All are fixed except the rule below, and the lead read those fixes; the second round of fixes had no third review. 

Checks on this final code, through the lane: catalog, typegen, typecheck, lint, 49 rule tests and build all exit 0. `scripts/qa/interact_check.py` passes 8 of 8 in a real browser on the preview: the store split follows the stepper and still adds up to the total, and the `/bulk` aisle filter, sort and store link work. It covers one basket and the UK bulk list. The new brand page and `/check` wording was read in the code and spot-checked in the served HTML, and not judged by a critic.

**A rule for the owner:** how much must be on file to say "Does the same job"? Now it needs one row with data on both sides, and that row may show a difference. 38 swaps have no row that reads same or better for the cheaper side, for example Plenty's three swaps with only a differing sheet size. Separately, 26 rest on rows that only name the same thing on both sides, such as "Alkaline AA (LR06), 1.5 V". Tightening either moves those to "Same kind". The lead's recommendation: require at least one row that reads same or better, and keep name-only rows as proof where the name carries the spec. That's a one-line change in `hasProof` plus its test.

## Where things are

- Round 2 worktree `~/src/samebutcheaper/.claude/worktrees/round2`. The older `owner-push` worktree is merged and locked.
- Preview: http://192.168.0.62:8851, served without docker by `~/ops/sbc-push-20261106/serve-preview.sh` from `/mnt/fast-storage/samebutcheaper-qa/preview/current`. That loop exits by itself 72 hours after it started, so about 9 Nov. It runs on until then without any session, and it isn't a system service, so it won't survive a reboot. Restart it with `nohup bash ~/ops/sbc-push-20261106/serve-preview.sh > /mnt/fast-storage/samebutcheaper-qa/preview/serve.log 2>&1 &`. Rebuild with `capped --mem 4G --name sbc-build -- bash scripts/qa/build-preview.sh` from a checkout at origin/main; the loop reloads by itself. The older script in `~/ops` builds the owner-push worktree, so don't use it.
- Progress page: https://claude.ai/artifact/TMAnEFmEmY54BensNE7XmU. Its data are JSON assets. Upload a file with Artifact `asset: true`, then ArtifactData `update` on `datasets/<id>` with the new `source.url`.
- Blind rounds: `~/ops/sbc-push-20261106/capture-round.sh`, `make-round.sh`, `reveal.py`. Keys in `blind-keys/`, captures in `/mnt/fast-storage/samebutcheaper-qa/`.
- Gate: `kucni-heavy venture bash scripts/qa/gate.sh <log dir>`.
- Photos: `reapply.py` plus `apply-cutouts.ts apply` re-finishes every cut photo. It doesn't know the `cutouts6` folder (Fairy Eucalyptus, Finish Ultimate Plus), so add that first.

## Port 3000

The owner's command hasn't changed in round 2. It serves an old image. Containers are owner-only. The order matters. `owner-unblock.sh` stops unless the shared checkout is exactly at `1f0acc2`, and it also adds the tailnet routes, so it has to run before the pull:

```
bash ~/ops/test-access-20261105/owner-unblock.sh
cd ~/src/samebutcheaper && git pull --ff-only && docker compose up -d --build
```

The database volume is kept. `up -d` alone isn't enough, because main has moved past the built image. This Docker build has not been run from this branch, because the kucni cage refuses docker here. If the checkout has already been pulled, the script stops at its first step and adds no routes, so the routes would need `bash ~/ops/test-access-20261105/install-routes.sh` run on its own.

## Owner-only

- Affiliate feed for product photos and live prices, card `sbc-affiliate-network`. It's the likely way to close the looks gap against idealo, and to fill tools, car, tech, office and garden.
- `sbc-pack-photos` and `sbc-dailymed-images` cards. DailyMed labels stay hidden and uncounted until answered.
- Open Icecat needs an account and a written answer.
- Public deploy stays with the owner's word: `~/ops/sbc-on-leasebook-20261104/deploy.sh --send-finished`. PR 2 (affiliate tagging) stays waiting.
- Device check: LCP and the first screen on a real phone. All LCP figures here are a throttled profile over the LAN.

## Still open

- Photos: home and category lose on looks to idealo's studio renders. Community snapshots are the limit. 51 of the 308 cut photos are marked weak and sort after sharper ones; they still show.
- `/bulk` lost to geizhals in round 10, before the round 2 rebuild, and hasn't been judged since. Most rows still have no photo, and the catalogue has 63 bigger packs against its 1,639 listings.
- Baskets: the big total isn't one receipt. It's split by store now, and there's no one-store option.
- Thin swaps: where the product you're told to buy has no photo, the page says so, and critics mark that down.
- `sharp` is used by the image scripts and comes in only through Next. Add it as a direct dev dependency in a lane install.
- 8 swaps are held for a second source: `~/ops/sbc-push-20261106/needs-second-source.json`.
- Two Duracell rows are still imperfect: the AA pair shows "capacity not listed" against 2550 mAh as different, and the AAA name still splits into two rows.
- The Frucht Stern photo comes from a different barcode's record than the pair's own. It's the same 1 L pack by eye, and its nutrition now comes from the pair's barcode.
- Prilosec has two current DailyMed labels (NDA021229 and ANDA206582), and we can't tell which one a given pack carries. Both records name both.
- `duracell-coppertop-aaa-vs-kirkland-signature-aaa` has retailer Costco and an Amazon search link: the disclosure says Amazon, the button still says Costco. Its data needs a Costco link or a retailer change.
- `differentSalts` only fires when both sides name a salt. A plain "Omeprazole" against "Omeprazole (as magnesium)" would still pass the build check.

## Things a later reader should know

- Most retailers bar agents. `docs/research/R3-price-sources.md` lists what's usable, and its end section covers Aldi UK, Home Bargains, Morrisons and simplehuman.
- A pair counts as a win only if it takes both the overall and the looks pick. That rule is the lead's, on top of the critic's pick, because the owner asked for "look better".
- Which? locks most scores to members. We take only what a page prints, and don't match names to scores by elimination.
- Writes outside the worktree are refused once the harness treats the worktree as a git repo, so the handover moved here from `~/ops`.

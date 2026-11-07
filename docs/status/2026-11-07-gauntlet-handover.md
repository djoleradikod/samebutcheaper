# SameButCheaper gauntlet handover, 7 Nov 2026

Owner push of 6 Nov. Brief: `~/ops/owner-push-20261106/samebutcheaper.md` and `shared-brief.md`. Older working notes and tools: `~/ops/sbc-push-20261106/HANDOVER.md`.

The critic has not picked ours on every piece, so the gauntlet is not finished. This branch is landing because the week's budget is running out, on the coordinator's instruction. See "Where it stands".

## Where it stands

Each page's last blind verdict, with labels stripped. Overall is the critic's pick; looks is a second pick on appearance alone.

| Page | Against | Round | Overall | Looks |
|---|---|---|---|---|
| Home, desktop | geizhals, live | 9 | ours | ours |
| Home, desktop | idealo, archive Nov 2026 | 9 | ours | idealo |
| Home, phone | geizhals, live | 8 | ours | ours |
| Home, phone | camelcamelcamel, live | 8 | ours | ours |
| Category, desktop | idealo, archive Oct 2026 | 9 | ours | idealo |
| Category, phone | idealo, archive Oct 2026 | 9 | ours | idealo |
| Category, phone | camelcamelcamel, live | 8 | ours | ours |
| Household aisle, desktop | geizhals, archive Oct 2026 | 9 | ours | geizhals |
| Bulk, desktop | geizhals, archive Oct 2026 | 9 | geizhals | geizhals |
| Basket, desktop | idealo product, archive Sep 2026 | 9 | ours | ours |
| Swap with strong evidence, desktop | idealo product, archive Sep 2026 | 9 | ours | ours |
| Swap with strong evidence, phone | camelcamelcamel product, live | 7 | ours | ours |
| Swap with thin evidence, desktop | idealo product, archive Sep 2026 | 9 | idealo | ours |

Those verdicts predate the last commit of fixes (`d635c28`), which changed labels, totals and copy. `/why` was never judged on its own. Camelcamelcamel desktop and geizhals product weren't usable as bars: both refused our browser (403).

Numbers on `d635c28`: 440 swaps, 39 brand kits, 29 baskets. Real photo on at least one side 239 (54%), both sides 117 (27%); DailyMed is neither shown nor counted. Medicine 83 (19%) counting remedies in other aisles, 73 (17%) in its own aisle, from 50%. All 440 cite two different sites, in one unit on both sides; 8 more are held back. Labels: 278 does the same job, 104 same active, 14 same formula, 2 same maker, 42 same kind. LCP worst median 0.75 s on the round 8 build, on the throttled LAN profile, target under 2.5 s.

Gate on `d635c28` through the lane: catalog, typegen, typecheck, lint, 37 rule tests and build all exit 0. There are no other automated tests in this repo's gate. An independent review of the branch found 9 blocking and 2 minor faults; all were fixed and read by the lead, but the fixes had no second independent review. In a browser, nobody has yet exercised the stepper-driven store split or the `/bulk` sort.

## Where things are

- Branch `worktree-owner-push`, worktree `~/src/samebutcheaper/.claude/worktrees/owner-push`.
- Preview: http://192.168.0.62:8851, served without docker by `~/ops/sbc-push-20261106/serve-preview.sh` from `/mnt/fast-storage/samebutcheaper-qa/preview/current`. That loop exits by itself 72 hours after it started, so about 9 Nov. It runs on until then without any session, and it isn't a system service, so it won't survive a reboot. Restart it with `nohup bash ~/ops/sbc-push-20261106/serve-preview.sh > /mnt/fast-storage/samebutcheaper-qa/preview/serve.log 2>&1 &`. Rebuild with `capped --mem 4G --name sbc-build -- ~/ops/sbc-push-20261106/build-preview.sh`; the loop reloads by itself.
- Progress page: https://claude.ai/artifact/TMAnEFmEmY54BensNE7XmU. Its data are JSON assets. Upload a file with Artifact `asset: true`, then ArtifactData `update` on `datasets/<id>` with the new `source.url`.
- Blind rounds: `~/ops/sbc-push-20261106/capture-round.sh`, `make-round.sh`, `reveal.py`. Keys in `blind-keys/`, captures in `/mnt/fast-storage/samebutcheaper-qa/`.
- Gate: `kucni-heavy venture bash scripts/qa/gate.sh <log dir>`.
- Photos: `reapply.py` plus `apply-cutouts.ts apply` re-finishes every cut photo. It doesn't know the `cutouts6` folder (Fairy Eucalyptus, Finish Ultimate Plus), so add that first.

## Port 3000

It serves an old image. Containers are owner-only. After the merge, from the shared checkout, which is on main:

```
cd ~/src/samebutcheaper && git pull --ff-only && docker compose up -d --build
```

The database volume is kept. `up -d` alone isn't enough, because main has moved past the built image. This Docker build has not been run from this branch, because the kucni cage refuses docker here.

## Owner-only

- Affiliate feed for product photos and live prices, card `sbc-affiliate-network`. It's the likely way to close the looks gap against idealo, and to fill tools, car, tech, office and garden.
- `sbc-pack-photos` and `sbc-dailymed-images` cards. DailyMed labels stay hidden and uncounted until answered.
- Open Icecat needs an account and a written answer.
- Public deploy stays with the owner's word: `~/ops/sbc-on-leasebook-20261104/deploy.sh --send-finished`. PR 2 (affiliate tagging) stays waiting.
- Device check: LCP and the first screen on a real phone. All LCP figures here are a throttled profile over the LAN.

## Still open

- Photos: home and category lose on looks to idealo's studio renders. Community snapshots are the limit. 51 of the 306 cut photos are marked weak and sort after sharper ones; they still show.
- `/bulk` loses to geizhals. Most rows have no photo and the catalogue has 63 bigger packs against its 1,639 listings.
- Baskets: the big total isn't one receipt. It's split by store now, and there's no one-store option.
- Thin swaps: where the product you're told to buy has no photo, the page says so, and critics mark that down.
- `sharp` is used by the image scripts and comes in only through Next. Add it as a direct dev dependency in a lane install.
- 8 swaps are held for a second source: `~/ops/sbc-push-20261106/needs-second-source.json`.
- Two Duracell rows are still imperfect: the AA pair shows "capacity not listed" against 2550 mAh as different, and the AAA name still splits into two rows.
- Albi's photo record points at a different barcode from the pair's own, and its nutrition now comes from the pair's barcode.

## Things a later reader should know

- Most retailers bar agents. `docs/research/R3-price-sources.md` lists what's usable, and its end section covers Aldi UK, Home Bargains, Morrisons and simplehuman.
- A pair counts as a win only if it takes both the overall and the looks pick. That rule is the lead's, on top of the critic's pick, because the owner asked for "look better".
- Which? locks most scores to members. We take only what a page prints, and don't match names to scores by elimination.
- Writes outside the worktree are refused once the harness treats the worktree as a git repo, so the handover moved here from `~/ops`.

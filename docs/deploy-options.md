# Where to run SameButCheaper: the shared server, Vercel or Cloudflare

Written 14 November 2026 from the Next.js 16.4 documentation shipped in `node_modules/next/dist/docs/` and from the
code as it is today. Nothing here was deployed: the server path was rehearsed end to end on one machine
(`scripts/ci/rehearse-deploy.sh`, see `docs/deploy.md`); Vercel and Cloudflare were not tried.

## Recommendation

**Use the server path (`docs/deploy.md`).** It is built, rehearsed, and runs every feature as written: Next's own
docs say a single `next start` process (here the standalone `server.js` in Docker) "handles every Next.js feature
correctly" (`02-guides/deploying-to-platforms.md`). It costs nothing extra on a server that already runs, and the
rehearsal shows the site keeps serving every read-only page when its database is down.

Choose **Vercel** instead only if keeping the other production system's server untouched matters more than about two
days of work and a monthly bill: the site is commercial (affiliate income), so it needs a paid Vercel plan, and the
changes below must be made first (rate limits and upkeep above all). **Cloudflare** is not a good fit today: the
`proxy.ts` file needs the Node.js runtime, which OpenNext for Cloudflare does not support yet, and the database client
would have to change shape. Revisit when OpenNext supports Node proxies.

## What would not work as built, and what each needs

Each row: what the code does now, what breaks on Vercel (V) and on Cloudflare Workers through OpenNext (C), and the
precise change. "Not on the server path" means the change is only needed for that host.

### 1. `output: "standalone"` (`next.config.ts`)

- Now: the build writes `.next/standalone/server.js`; the Dockerfile copies it with `.next/static` and `public`.
- V: ignored; Vercel builds its own output from the same `next build`. No change needed.
- C: OpenNext runs `next build` itself and works from its output. No change needed.
- The Dockerfile, `docker-compose*.yml`, `deploy/`, `scripts/ci/deploy-remote.sh` and the Deploy workflow's image
  and SSH jobs simply stop being used. Keep them; they are the way back.

### 2. The in-server upkeep timer (`src/instrumentation.ts`, `src/lib/server/startup.ts`)

- Now: `register()` starts a timer: a run a minute after start, then every six hours; `runMaintenance` does its work
  at most once in 20 hours and takes a Postgres advisory lock. It deletes data the privacy page promises to delete,
  sends confirmation and price-watch emails, answers wishes and sends the weekly letter.
- V and C: there is no long-lived process. `register()` runs on each cold start, the timer is frozen with the
  function, and the upkeep would run rarely or never. **Retention would silently stop**, which breaks a promise on
  `/privacy` and `/datenschutz`.
- Change:
  1. `src/app/api/cron/upkeep/route.ts`: `GET` that returns 401 unless `Authorization` is `Bearer ${CRON_SECRET}`
     (compare with `sameSecret` from `src/lib/admin-auth.ts`), then `await runMaintenance(getDb(), { siteUrl: SITE.url,
     minHoursSinceLast: 20 })` and returns the report as JSON. `export const maxDuration = 300`.
  2. In `startServerTasks`, skip the two timers when `process.env.VERCEL` (or a new `UPKEEP_TIMER=off`) is set; keep
     `reportReadiness`.
  3. V: `vercel.json` with `{ "crons": [{ "path": "/api/cron/upkeep", "schedule": "15 4 * * *" }] }`. Vercel sends
     `CRON_SECRET` as the bearer token when the variable is set. On Hobby, crons run once a day at most, within the
     hour; that is enough (the job is daily).
  4. C: a Cron Trigger (`[triggers] crons = ["15 4 * * *"]` in `wrangler.jsonc`) and a `scheduled` handler in a
     custom worker entry that fetches the route with the secret; or, simpler on either host, a scheduled GitHub
     Actions workflow that calls the route with `curl -H "Authorization: Bearer $CRON_SECRET"`.
  5. `src/lib/readiness.ts`: a blocker check "Daily upkeep" that `CRON_SECRET` is at least 16 characters when the
     timer is off, and `.env.example` gets `CRON_SECRET=`.
  6. Letters go out up to `NEWSLETTER_MAX_PER_RUN` (200) per run in batches; at a few hundred readers one run stays
     well inside five minutes. Past that, lower the cap or split the route by task.

### 3. Postgres from serverless functions (`src/db/index.ts`)

- Now: one `postgres` client per process, `max: DB_POOL_MAX` (default 10) connections, kept in `globalThis`.
- V: every concurrent function instance opens its own pool. Twenty warm instances with 10 each is 200 connections;
  a small Postgres allows 100. Change: use the provider's pooled connection string (Neon's `-pooler` host, Supabase's
  transaction pooler on 6543), set `DB_POOL_MAX=2`, and pass `prepare: false` to `postgres()` when the pooler runs
  in transaction mode (PgBouncer cannot keep prepared statements across transactions). Migrations need the direct,
  unpooled URL: run `npm run db:migrate` with it from a GitHub Action before each production deploy (Vercel's
  build step has no access to run it safely before traffic switches).
- C: worse: a socket opened while handling one request cannot be used by another, and the OpenNext guide says to
  create a new client for each request instead of a global one. Change: `getDb()` becomes per request (create the
  client in the request, `max: 1`, end it in `after()`), through Hyperdrive (`env.HYPERDRIVE.connectionString`) so
  each new connection is cheap. Every caller of `getDb()` (22 files) keeps working, but the module-level cache in
  `src/db/index.ts` and in `startup.ts` must go.
- Both: the nightly backup container is gone; use the managed Postgres provider's point-in-time recovery, and keep
  a weekly `pg_dump` from a GitHub Action if you want a copy you hold.

### 4. Rate limits (`src/lib/rate-limit.ts`)

- Now: a `Map` in memory. Right for one process; with blue and green both briefly up during a deploy, each counts
  separately for a minute, which is harmless.
- V and C: every instance has its own `Map` and instances come and go, so the limits on sign-ups, reports,
  wishes, photo reading (which costs money per call), admin password attempts and postback secrets would barely
  apply. **This is a launch blocker on serverless.** Change: keep the `rateLimit(name, key, rules)` signature and back
  it with a shared store: Upstash Redis (`INCR` + `PEXPIRE` per window) on either host, or a small `rate_limits` table
  in Postgres (`insert ... on conflict do update set count = count + 1 ... returning count`) with a migration.
  `isLimited` and `rateLimit` become async; their 24 call sites add `await`.

### 5. The service worker (`public/sw.js`, `public/sw-register.js`)

- Now: served from `public/` with `Cache-Control: no-cache` from `headers()` in `next.config.ts`.
- V: works; Vercel applies `headers()` to files in `public/`.
- C: static files are served by the Workers assets binding before Next runs, and `headers()` does not apply to them.
  Change: add `public/_headers` with `/sw.js` and `/sw-register.js` set to `Cache-Control: no-cache`, and the
  security headers for `/*` (the same list as `next.config.ts`), or a browser keeps an old worker for up to a day.

### 6. The proxy file (`src/proxy.ts`)

- Now: Next 16's `proxy.ts`, which always runs on the Node.js runtime (`03-file-conventions/proxy.md`: "Proxy
  defaults to using the Node.js runtime. The runtime config option is not available in Proxy files"). It does admin
  Basic auth with `node:crypto`, country detection, the `/de` rewrites, and keeps per-process state.
- V: supported. One thing to check on the first preview deploy: the country rewrite marks its own request with
  `INTERNAL_TOKEN = crypto.randomUUID()`, made once per process. If Vercel ever runs the rewritten request through a
  different proxy instance, every `/de`, `/uk`, `/ca`, `/ie` and `/us` page would 404. Change if it does: derive the
  token from a deploy-wide secret (`process.env.NEXT_DEPLOYMENT_ID` or a new `INTERNAL_REWRITE_SECRET`) instead of
  a random one. The preview check is: `curl -sI https://<preview>/de/compare/<a German swap>` answers 200.
- C: OpenNext for Cloudflare does not support Node.js middleware yet, and Next 16 offers no Edge runtime for
  `proxy.ts`. The only route would be back to the deprecated `src/middleware.ts` on the Edge runtime, with
  `node:crypto` replaced by Web Crypto in `src/lib/admin-auth.ts`. Not recommended.
- Both: the proxy's in-memory admin lockout (`authFailures`) has the problem in section 4.

### 7. Images

- Now: no `next/image` anywhere, so no image optimisation and no `sharp`. Product photos are plain `<img>` from
  `public/products`. Share images (`opengraph-image.tsx`, `src/lib/og.tsx`) are made with `next/og` and read the
  `.ttf` fonts in `assets/fonts` from disk (`outputFileTracingIncludes` in `next.config.ts`).
- V: works as is; the tracing include puts the fonts in the function.
- C: there is no file system to read the fonts from. Change: import the fonts as `ArrayBuffer`
  (`await fetch(new URL("../../assets/fonts/x.ttf", import.meta.url)).then((r) => r.arrayBuffer())`) instead of
  `readFile`, and check the worker stays under the size limit (next item).

### 8. Size

- Now: `src/generated/catalog.json` is 3.7 MB and is bundled into server code; the build prerenders about 3,400
  pages (`.next` is about 720 MB in the image).
- V: fine. C: a Worker may be at most 3 MiB compressed on the free plan and 10 MiB on the paid one. The catalogue
  alone compresses to about 0.9 MB (gzip -9), but the whole server bundle must be measured (`npx opennextjs-cloudflare build`
  prints it) before committing to Cloudflare.

### 9. Cron jobs outside the site

- Now: GitHub Actions run the weekly price watch (opens a pull request), the Monday rebuild (freshness tiers are
  worked out at build time: a site not rebuilt for weeks calls old prices fresh) and the daily site check.
- V: price watch and site check stay as they are. The Monday rebuild becomes a Vercel Deploy Hook URL (stored as a
  GitHub secret) that a scheduled workflow calls with `curl -X POST`. Pushes to `main` deploy through Vercel's Git
  integration instead of the Deploy workflow; turn the workflow off by leaving `DEPLOY_*` unset.
- C: the same with `wrangler deploy` from a scheduled workflow.

### 10. Caching (`cacheComponents`, `'use cache'`, `updateTag`)

- Now: one process with the default in-memory and file cache. `/admin` clears the reported-records cache with
  `updateTag`, and every request sees it at once.
- V: supported by the platform's shared cache; nothing to change.
- C: OpenNext needs an incremental cache (R2 or KV) and a tag cache (D1 or Durable Objects) configured in
  `open-next.config.ts`; without them `updateTag` only reaches the instance that ran it, and a resolved report could
  keep showing on other instances for up to the entry's life (four minutes here). Acceptable, but configure it.

### 11. Settings fixed at build time

- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL` and the affiliate settings (`AFF_*`, `AMAZON_*`, `AWIN_*` and the
  rest, via `next.config.ts`) are fixed into the build. On Vercel and Cloudflare they must be set as build-time
  variables of the project, and changing one means a new deploy. Secrets read at run time (`ADMIN_PASSWORD`,
  `CLICK_HASH_SALT`, `POSTBACK_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `LEGAL_*`, `MAIL_*`) are ordinary
  environment variables there, never exposed to the browser (the built client scripts were checked: no secret or
  variable name appears in them).

### 12. Visitor address

- V: set `CLIENT_IP_HEADER=x-real-ip` (Vercel sets it to the visitor's address); otherwise the first
  `x-forwarded-for` entry is used, which Vercel also sets correctly.
- C: set `CLIENT_IP_HEADER=cf-connecting-ip`. Country detection already reads `x-vercel-ip-country` and `cf-ipcountry`.

## Effort

| | Server (`docs/deploy.md`) | Vercel | Cloudflare |
|---|---|---|---|
| Code changes | none | sections 2, 3, 4, 9 (about two days, with tests) | sections 2 to 10, and a proxy rewrite |
| Runs every feature as written | yes, rehearsed | yes, after the changes | not today (Node proxy) |
| Database | Postgres in the same compose project, nightly backups | managed Postgres with a pooler | managed Postgres through Hyperdrive |
| Cost | the existing server | a paid plan (commercial use) and a managed database | Workers paid plan and a managed database |
| Risk to the other production system | small, bounded by the limits in `docs/deploy.md` | none | none |

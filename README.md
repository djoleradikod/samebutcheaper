# SameButCheaper

**Same ingredients. Same results. Less money.**

SameButCheaper lists cheaper products that are *verifiably the same* as famous brand-name ones: the same active ingredient at the same strength, an identical formula, the same manufacturer, or equivalent certified specs. Every swap shows the evidence, the honest differences, the sources, and the price per unit, and it links out through affiliate links.

## Stack

| Part | What |
| --- | --- |
| Web | Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS 4 |
| Catalog | JSON files in `data/pairs/`, validated with Zod and compiled at build time, so every swap page is static HTML |
| Database | PostgreSQL 16 via Drizzle ORM. It stores affiliate clicks, swap suggestions and newsletter sign-ups |
| Deploy | Docker (standalone Next.js output) plus Postgres, with optional Caddy for automatic HTTPS |

The site works without a database. Clicks are then not logged, and the forms say sign-ups aren't open yet.

## Pages

- `/`: hero search, the biggest savings, categories, how verification works, newsletter and FAQ
- `/compare/[slug]`: a swap with price per unit, a savings calculator, a side-by-side ingredient table, evidence, differences, sources and buy buttons
- `/category/[slug]`, `/biggest-savings`: lists you can filter and sort
- `/search`: fuzzy search by brand, product or ingredient
- `/suggest`: visitors suggest a swap (saved to the database)
- `/how-we-verify`, `/about`, `/disclosure`, `/privacy`
- `/go/[slug]/[alternative|brand]`: logs the click, then redirects to the affiliate URL
- `/admin`: clicks, suggestions and subscribers, behind HTTP Basic auth (`admin` / `ADMIN_PASSWORD`)
- `/sitemap.xml`, `/robots.txt`, `/api/health`

## Run locally (dev)

```bash
npm install
cp .env.example .env      # optional: set DATABASE_URL to log clicks and save forms
npm run dev               # http://localhost:3000
```

To use a local Postgres: `docker run -d --name sbc-db -e POSTGRES_USER=sbc -e POSTGRES_PASSWORD=sbc -e POSTGRES_DB=samebutcheaper -p 5432:5432 postgres:16-alpine`, then set `DATABASE_URL=postgres://sbc:sbc@localhost:5432/samebutcheaper` and run `npm run db:migrate`.

## Run on a server (kucni or Hetzner)

You need Docker with the compose plugin (Ubuntu: `curl -fsSL https://get.docker.com | sh`).

```bash
git clone https://github.com/djoleradikod/samebutcheaper.git && cd samebutcheaper
cp .env.example .env && nano .env        # set POSTGRES_PASSWORD, AMAZON_ASSOCIATE_TAG, ADMIN_PASSWORD…
docker compose up -d --build             # site on http://<server-ip>:3000
```

Database migrations run automatically on every start through the `migrate` service.

**Production with HTTPS (Hetzner):** point your domain's DNS A record at the VPS, set `SITE_DOMAIN` and `NEXT_PUBLIC_SITE_URL=https://yourdomain` in `.env`, and open ports 80 and 443 in the Hetzner firewall. Then run:

```bash
docker compose --profile proxy up -d --build
```

Caddy gets and renews the Let's Encrypt certificate automatically. You can then remove the `ports` mapping from `web` so it isn't reachable directly on port 3000.

**Update after new commits:** `git pull && docker compose --profile proxy up -d --build`

**Backups:** `docker compose exec db pg_dump -U sbc samebutcheaper > backup-$(date +%F).sql`

## Adding swaps

Add pairs to any JSON file in `data/pairs/`. The format and rules are in [`data/README.md`](data/README.md). `npm run catalog` validates them. CI runs the same check and fails the build on a bad pair.

## Affiliate setup

1. Join [Amazon Associates](https://affiliate-program.amazon.com/) and put your tracking ID in `AMAZON_ASSOCIATE_TAG`.
2. Optional: Walmart and Target run through Impact. Put their deep-link templates (with `{url}`) in `WALMART_AFFILIATE_TEMPLATE` and `TARGET_AFFILIATE_TEMPLATE`.
3. Rebuild or restart. No code changes are needed.

Amazon requires the disclosure that's already on `/disclosure` and in the footer.

## Scripts

| Command | Does |
| --- | --- |
| `npm run catalog` | Validate `data/pairs` and build `src/generated/catalog.json` |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | Checks |
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |

# Deploying SameButCheaper

Pushing to `main` builds the site into a Docker image, puts it on GitHub's registry (GHCR) and, once you have
done the steps below, starts it on your server beside the old version, checks it, and switches over. Nothing
happens until you set it up: today every run of the Deploy workflow says "not configured" and stops.

It is built to share a server with another site (Leasebook) without touching it:

- everything lives in one directory of its own (`/srv/samebutcheaper` below) and one Docker Compose project of its
  own (`samebutcheaper`); the deploy refuses to run anywhere without the marker file from step 2;
- it never restarts Docker, the reverse proxy or any other container, never runs `docker compose down` or
  `docker system prune`, and only removes old images of its own;
- the site listens on two ports on 127.0.0.1 only. Your existing reverse proxy forwards the domain to them (step 8).
  You add that once, by hand; the workflow never edits or reloads the proxy.

**Do not run `deploy/hetzner.sh` on the shared server.** That script is for a server of its own: it installs Docker,
builds there, and starts Caddy on ports 80 and 443, which the other site's proxy already uses.

Everything below can be done from a phone: an SSH app (Termius, Blink, JuiceSSH) for the server, and the GitHub app
or github.com for the settings. Each box is one copy and paste.

## What you need

- the server's address, and an account on it that can use `sudo`;
- the domain (samebutcheaper.com) and access to its DNS;
- about 30 minutes.

## One-time steps

### 1. DNS

At your DNS provider, add:

| Type | Name | Value |
|---|---|---|
| A | `@` (samebutcheaper.com) | the server's IPv4 address |
| A | `www` | the same address |
| AAAA | `@` and `www` | the server's IPv6 address, only if it has one and the other site uses it too |

### 2. A user and a directory for the site

On the server:

```sh
sudo adduser --disabled-password --gecos "" sbcdeploy
sudo usermod -aG docker sbcdeploy
sudo install -d -o sbcdeploy -g sbcdeploy -m 750 /srv/samebutcheaper
sudo -u sbcdeploy touch /srv/samebutcheaper/.samebutcheaper-deploy
```

The empty `.samebutcheaper-deploy` file is what the deploy looks for before it does anything. Being in the `docker`
group lets this user run containers, which on Linux is as powerful as root: keep its key only in GitHub.

Check the two ports the site will use are free (no output means free):

```sh
sudo ss -ltn | grep -E ':(3101|3102) '
```

If something is listed, pick two other ports and use them below and in step 8.

### 3. The site's settings

This writes `/srv/samebutcheaper/.env` with new random passwords:

```sh
sudo -u sbcdeploy sh -c 'umask 077; cat > /srv/samebutcheaper/.env' <<EOF
NEXT_PUBLIC_SITE_URL=https://samebutcheaper.com
POSTGRES_PASSWORD=$(openssl rand -hex 24)
CLICK_HASH_SALT=$(openssl rand -hex 24)
POSTBACK_SECRET=$(openssl rand -hex 24)
ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=')
SBC_BLUE_PORT=3101
SBC_GREEN_PORT=3102
EOF
sudo grep ADMIN_PASSWORD /srv/samebutcheaper/.env
```

The last line shows the `/admin` password (user `admin`); keep it in your password manager. Email, photo reading
and the other settings go in the same file later (`sudo -u sbcdeploy nano /srv/samebutcheaper/.env`; the list with
explanations is in `.env.example`). After changing it, run the Deploy workflow again (step 7) to restart with it.

### 4. A key for GitHub to log in with

On the server:

```sh
sudo -u sbcdeploy sh -c 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && ssh-keygen -q -t ed25519 -N "" -C github-deploy -f ~/.ssh/github && cat ~/.ssh/github.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
sudo -u sbcdeploy cat /home/sbcdeploy/.ssh/github
```

Copy everything the last command prints, from `-----BEGIN` to `-----END OPENSSH PRIVATE KEY-----` inclusive. That is
the `DEPLOY_SSH_KEY` secret in step 6. Once it is saved in GitHub, delete the server's copy of the private half:

```sh
sudo -u sbcdeploy rm /home/sbcdeploy/.ssh/github
```

### 5. The server's fingerprint

So GitHub only ever talks to your server, not something pretending to be it. Replace `203.0.113.10` with exactly
what you will put in `DEPLOY_HOST` (the IP address, or a host name):

```sh
echo "203.0.113.10 $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
```

The printed line is the `DEPLOY_KNOWN_HOSTS` secret. If SSH listens on a port other than 22, write the start as
`[203.0.113.10]:2222` instead.

### 6. GitHub settings

In the repository: **Settings > Secrets and variables > Actions**.

On the **Variables** tab, add:

| Name | Value |
|---|---|
| `SITE_URL` | `https://samebutcheaper.com` |
| `DEPLOY_SSH_PORT` | only if SSH is not on port 22 |

On the **Secrets** tab, add:

| Name | Value |
|---|---|
| `DEPLOY_HOST` | the server's IP address or host name |
| `DEPLOY_USER` | `sbcdeploy` |
| `DEPLOY_PATH` | `/srv/samebutcheaper` |
| `DEPLOY_SSH_KEY` | the private key from step 4 |
| `DEPLOY_KNOWN_HOSTS` | the line from step 5 |
| `AFFILIATE_ENV` | optional: the `AFF_...` lines from your `.env`, one per line, once a network approves you |

All four `DEPLOY_` settings or none: with only some of them the workflow stops and says which are missing. With
`SITE_URL` and no `DEPLOY_` settings it builds and publishes the image only.

Affiliate IDs are fixed into the image when it is built (see `next.config.ts`), which is why they go in GitHub and
not in the server's `.env`.

Two more settings, both optional:

- **Settings > Environments > production > Required reviewers**: tick yourself, and every deploy waits for your tap
  in the GitHub app before it touches the server.
- **Settings > Actions > General > Workflow permissions**: tick "Allow GitHub Actions to create and approve pull
  requests". The weekly price watch needs it to open its pull request; without it the run fails with a link to the
  branch so you can open the pull request yourself.

### 7. First deploy

**Actions > Deploy > Run workflow**, leave "deploy", **Run workflow**. It takes about ten minutes the first time.
The run's summary ends with what is live:

```
live: web-blue on 127.0.0.1:3101 (ghcr.io/...:sha-...)
```

The site now answers on the server itself, not yet on the domain. Check from the server:

```sh
curl -s http://127.0.0.1:3101/api/health
```

### 8. Reverse proxy

Find out which proxy the other site uses:

```sh
docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' | grep -Ei 'caddy|nginx|traefik'; systemctl is-active caddy nginx 2>/dev/null
```

A line with `0.0.0.0:443` means the proxy runs in a container; `active` means it runs on the server itself.

#### Caddy

Add this block to the existing Caddyfile, below the other site's block. Do not change the other block.

```caddy
samebutcheaper.com {
	encode zstd gzip
	request_body {
		max_size 6MB
	}
	header -Server
	@static path /_next/static/*
	header @static Cache-Control "public, max-age=31536000, immutable"

	# Two ports: the deploy runs one and keeps the other stopped, then swaps. Caddy uses whichever answers.
	reverse_proxy 127.0.0.1:3101 127.0.0.1:3102 {
		lb_policy first
		health_uri /api/health
		health_interval 5s
		health_timeout 3s
		fail_duration 10s
		lb_try_duration 15s
		lb_try_interval 250ms
	}
}

www.samebutcheaper.com {
	redir https://samebutcheaper.com{uri} permanent
}
```

Check, then reload. A reload keeps the other site's connections; a restart would not.

```sh
caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

If Caddy runs in a container, use `docker exec <caddy container> caddy validate --config /etc/caddy/Caddyfile` and
`docker exec <caddy container> caddy reload --config /etc/caddy/Caddyfile`, and see "Proxy in a container" below.

Caddy fetches the HTTPS certificate on the first visit.

#### nginx

Create `/etc/nginx/sites-available/samebutcheaper` with:

```nginx
upstream samebutcheaper {
    # The deploy runs one of these and keeps the other stopped; a refused connection moves on to the other at once.
    server 127.0.0.1:3101 max_fails=1 fail_timeout=5s;
    server 127.0.0.1:3102 max_fails=1 fail_timeout=5s;
    keepalive 16;
}

server {
    listen 80;
    listen [::]:80;
    server_name samebutcheaper.com www.samebutcheaper.com;
    client_max_body_size 6m;

    location /_next/static/ {
        proxy_pass http://samebutcheaper;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://samebutcheaper;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        # Replace, never append: the site counts visitors and rate limits by the first address in this header.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Pages stream in parts; pass each part on as it comes.
        proxy_buffering off;
        proxy_next_upstream error timeout http_502 http_503;
        proxy_next_upstream_tries 2;
    }
}
```

Then switch it on, check, reload, and get the certificate (certbot adds the HTTPS part and the redirect):

```sh
sudo ln -s /etc/nginx/sites-available/samebutcheaper /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d samebutcheaper.com -d www.samebutcheaper.com
```

`nginx -t` must say "syntax is ok" before the reload; if it doesn't, remove the link again
(`sudo rm /etc/nginx/sites-enabled/samebutcheaper`) and nothing has changed for the other site.

#### Proxy in a container

Inside a container, `127.0.0.1` is the container itself. Make the site listen on the Docker bridge instead:

1. add `SBC_BIND=172.17.0.1` to `/srv/samebutcheaper/.env` (check the address with `ip -4 addr show docker0`);
2. in the proxy snippet, write `172.17.0.1:3101` and `172.17.0.1:3102` instead of `127.0.0.1:...`;
3. run the Deploy workflow again, then test from the proxy container:
   `docker exec <proxy container> wget -qO- http://172.17.0.1:3101/api/health`.

If that test times out, the server's firewall blocks containers from reaching the host; ask before changing it,
since the other site depends on it. Never set `SBC_BIND=0.0.0.0`: Docker publishes ports around the firewall, so the
site would be reachable without HTTPS. The deploy refuses it.

### 9. Check from outside

Open `https://samebutcheaper.com/api/health` on your phone. `"database":"ok"` and `"migrations":"11/11"` (or
whatever the two numbers are, as long as they match) mean the site is up. `"ready":false` lists what the launch
checklist still wants; `/admin` explains each. The **Site check** workflow looks at the same address every morning
and emails you (GitHub's failed-run email) if it is down.

## Every day after that

| When | What | Where |
|---|---|---|
| Each push to `main` | build, deploy, health check, switch | Actions > Deploy |
| Mondays 05:17 UTC | price watch opens a pull request with new prices | Actions > Price watch |
| Mondays 06:30 UTC | rebuild and deploy, even with no changes | Actions > Deploy |
| Daily 07:11 UTC | check the live site from outside | Actions > Site check |
| Daily, inside the site | upkeep: retention, confirmation and price-watch emails, the weekly letter | `src/lib/maintenance.ts` |
| Nightly 03:15 UTC, and before each deploy | database backup | `/srv/samebutcheaper/backups` |

Why weekly: how fresh each price looks ("checked this week", "checked a month ago") is worked out when the site is
built (`docs/prices.md`). A site not rebuilt for weeks would keep calling old prices fresh.

The upkeep needs no outside trigger: it runs inside the web server every six hours and does its work once a day
(`src/lib/server/startup.ts`). With two colours briefly running together during a deploy, a database lock stops it
running twice.

## Rolling back

From the phone: **Actions > Deploy > Run workflow**, choose **rollback**. Or on the server:

```sh
cd /srv/samebutcheaper && DEPLOY_PATH=$PWD bash deploy-remote.sh rollback
```

It starts the previous version (its container was only stopped, so this takes seconds), checks it, and stops the
current one. Run it again to go forward again. `status` instead of `rollback` shows what runs:

```sh
cd /srv/samebutcheaper && DEPLOY_PATH=$PWD bash deploy-remote.sh status
```

Database changes are not undone by a rollback. They only ever add tables and columns, so the older version runs on
the newer database. If a change ever needs undoing, restore a backup (below) taken before that deploy.

A deploy that fails its health check never goes live: the new version is stopped, the old one keeps serving, and the
run fails with the new version's last log lines.

## Backups

The `backup` container writes `backups/samebutcheaper-YYYY-MM-DD.sql.gz` every night at about 03:15 UTC, and once
more before every deploy; it keeps 14 days (`BACKUP_KEEP_DAYS` in `.env`).

They are on the same disk as the database, so also copy them somewhere else. Two simple ways:

- **Hetzner Storage Box** (or any SSH storage): as `sbcdeploy`, add a nightly copy with `crontab -e`:
  `30 4 * * * rsync -a /srv/samebutcheaper/backups/ u12345@u12345.your-storagebox.de:samebutcheaper/`
- **To your own computer** now and then: `scp sbcdeploy@203.0.113.10:/srv/samebutcheaper/backups/*.gz .`

Restore (replaces what is in the database with the backup; take a fresh one first):

```sh
cd /srv/samebutcheaper
docker compose -p samebutcheaper -f docker-compose.deploy.yml exec -T backup /bin/sh /backup.sh once
gunzip -c backups/samebutcheaper-2026-11-10.sql.gz | docker compose -p samebutcheaper -f docker-compose.deploy.yml exec -T db psql -U sbc -d samebutcheaper
```

Try a restore once into a scratch database before you need it for real.

## Other hosts: Vercel or Cloudflare

Not built; this is what would change if you preferred one.

**Vercel** (closest fit; Next.js runs as-is):

- the database moves to a hosted Postgres (Neon or Supabase) and `DATABASE_URL` is set in Vercel; migrations run
  from a GitHub Action (`npm run db:migrate`) before each production deploy;
- daily upkeep has no long-running server to live in: add a route such as `/api/cron/upkeep` that checks a
  `CRON_SECRET` header and calls `runMaintenance`, a Vercel Cron entry for it in `vercel.json`, and a readiness
  check for `CRON_SECRET`;
- rate limits are kept in memory (`src/lib/rate-limit.ts`), so each serverless instance would count separately:
  they need a shared store (Postgres or Upstash Redis) first;
- country detection already reads `x-vercel-ip-country` (`src/proxy.ts`), and `AFFILIATE_ENV` becomes ordinary
  Vercel environment variables (they are read at build time);
- the weekly rebuild becomes a Deploy Hook URL called from a scheduled GitHub Action;
- the image build, SSH deploy, Caddy/nginx and backup sections here would not apply.

**Cloudflare** (Workers via the OpenNext adapter): everything in the Vercel list, plus the Node-only parts would need
checking one by one: `postgres` over TCP (Hyperdrive), `sharp` and the share-image fonts read from disk
(`outputFileTracingIncludes` in `next.config.ts`), and the photo upload size. More work than Vercel, and not tried.

## Quality checks in CI

Each push and pull request runs, after the existing tests, `scripts/ci/quality.mjs` against the built site:

- **accessibility**: axe on home, a swap, a kit, a basket, search, `/check` and My list, at 390 px and 1280 px;
  a serious or critical finding fails the run;
- **phone width**: none of those pages may scroll sideways at 390 px, in the US and in Germany;
- **performance budget**: at phone width with the CPU slowed four times and nothing cached, the script sent for the
  swap page, and largest contentful paint and layout shift for every page, as the browser's own
  PerformanceObserver reports them (median of five loads; a page over its timing budget is measured once more and
  fails only if both medians are over). No Lighthouse.

The pages and budgets are in `scripts/ci/quality.config.json`. Budgets are the numbers measured when they were set,
plus a margin. To see today's numbers and suggested budgets: `npm run build`, then

```sh
npx playwright install chromium   # once; playwright and @axe-core/playwright are pinned devDependencies
node scripts/ci/quality.mjs --measure
```

The numbers are from GitHub's runner or a laptop over the loopback, not a real phone on a mobile network: read
them as "did this change make it worse", not as what visitors see.

## The app on a home screen

`/manifest.webmanifest` (`src/app/manifest.ts`) and the icons in `public/icons` (made from the favicon by
`node scripts/ci/make-icons.mjs`) let phones add the site to the home screen. `public/sw.js` keeps the offline page,
My list and the static files, so My list opens without a connection; it never keeps other pages, prices or anything
that depends on the country, and it never handles `/go/`, `/out`, `/admin` or `/api/`. Its routing is tested in
`scripts/tests/service-worker.test.ts`. To change what it does, edit it and raise `VERSION` at the top; browsers
pick up the new one on their next visit. The file's header has a kill switch that removes it from every browser.

## When something goes wrong

| What you see | What to do |
|---|---|
| Deploy says "not configured" | Expected until `SITE_URL` is set (step 6). |
| "Deploy half configured" | Add the missing `DEPLOY_` setting it names, or remove the others. |
| "Not set up" / marker missing | Step 2 on the server, or `DEPLOY_PATH` doesn't match the directory. |
| "Host key verification failed" | `DEPLOY_KNOWN_HOSTS` doesn't match `DEPLOY_HOST`; redo step 5 with exactly the same host. |
| "Port ... is already in use" | Pick other ports in `.env` (`SBC_BLUE_PORT`, `SBC_GREEN_PORT`) and in the proxy snippet. |
| "did not become healthy" | Read the log lines in the run. The old version is still live. Fix and push again. |
| Health fine on the server, domain doesn't load | DNS (step 1), the proxy block (step 8), or ports 80/443 closed in the Hetzner firewall. |
| "pre-deploy backup failed" | Disk full? `df -h /srv`. Nothing was changed. |
| Price watch: "not permitted to create pull requests" | Step 6, the Workflow permissions box; or open the pull request from the link in the run. |

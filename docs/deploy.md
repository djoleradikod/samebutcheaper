# Going live: the runbook

This is the whole procedure for putting SameButCheaper on its own domain, on a server that already runs another
production site (Leasebook), without disturbing that site. Follow it top to bottom on the day. Every box is one copy
and paste; everything can be done from a phone (an SSH app such as Termius or Blink for the server, the GitHub app or
github.com for the settings).

If you would rather not use the server at all, read `docs/deploy-options.md` first: it says what Vercel or
Cloudflare would need, and why the server is the recommended path.

**Never run `deploy/hetzner.sh` on the shared server.** It is for a server of its own: it installs Docker, builds on
the server and starts Caddy on ports 80 and 443, which the other site's proxy already owns. It refuses to start
where other containers run or something else holds 80 or 443.

Contents: [How it works](#how-it-works) · [Before the day](#before-the-day) · [Settings](#every-setting-in-one-place) ·
[Steps 1 to 9](#on-the-day) · [Verify](#verify) · [Sharing the server](#sharing-the-server-safely) ·
[First 48 hours](#the-first-48-hours) · [Rollback](#rolling-back) · [Backups](#backups-and-restoring-one) ·
[Rotate a secret](#rotating-a-secret) · [Every day after](#every-day-after-that) · [Rehearsal](#the-rehearsal) ·
[When something is wrong](#when-something-is-wrong)

## How it works

Pushing to `main` (and every Monday, and by hand) runs **Actions > Deploy**: it builds the site into a Docker image,
starts it in a throwaway copy of the whole server setup on GitHub's machine (the launch rehearsal), pushes it to
GitHub's registry (GHCR), then logs in to your server over SSH and runs `deploy-remote.sh` there, which:

1. pulls the image and makes sure the site's own database container is up;
2. backs up the database;
3. applies database migrations with the new image (they only ever add tables and columns);
4. starts the new version on the idle port (3101 "blue" or 3102 "green", on 127.0.0.1 only), waits until it says the
   database answers with every migration applied and the home page renders;
5. stops the old version, keeping its container for a rollback in seconds.

Your existing reverse proxy forwards the domain to both ports and uses whichever answers, so a switch needs no proxy
change. If the new version never gets healthy it is stopped and the old one keeps serving.

What it never does: restart Docker or the proxy, touch any container outside its own Compose project
(`samebutcheaper`), run `docker compose down` or `docker system prune`, listen on 80 or 443 or on a public address, or
run anywhere without the marker file from step 2.

## Before the day

You need:

- [ ] the server's address and an account on it that can use `sudo`;
- [ ] the domain, and access to its DNS;
- [ ] admin access to the GitHub repository;
- [ ] a password manager, for the admin password and the backup of `.env`;
- [ ] to know which reverse proxy the other site uses (step 8 finds out);
- [ ] optional, can come later: a Resend account with the domain verified (email), affiliate IDs, the owner's legal
      details for `/impressum`;
- [ ] about an hour, at a quiet time for the other site.

On your own computer, with this repository and Node 22: `npm ci && npm run catalog` once, so you can run the checks
in [Verify](#verify).

## Every setting in one place

**GitHub: Settings > Secrets and variables > Actions.** Values marked *build* are fixed into the image when it is
built; changing one needs a new deploy.

| Where | Name | Value | Needed |
|---|---|---|---|
| Variables | `SITE_URL` | `https://yourdomain.com` (no trailing slash) *build* | yes: nothing is built without it |
| Variables | `CONTACT_EMAIL` | the contact address shown on every page, on your domain *build* | yes if the domain is not samebutcheaper.com |
| Variables | `DEPLOY_SSH_PORT` | only if SSH is not on 22 | no |
| Secrets | `DEPLOY_HOST` | the server's IP address or host name | yes |
| Secrets | `DEPLOY_USER` | `sbcdeploy` | yes |
| Secrets | `DEPLOY_PATH` | `/srv/samebutcheaper` | yes |
| Secrets | `DEPLOY_SSH_KEY` | the private key from step 4 | yes |
| Secrets | `DEPLOY_KNOWN_HOSTS` | the line from step 5 | strongly advised |
| Secrets | `AFFILIATE_ENV` | the `AMAZON_*`, `AWIN_*`, `AFF_*`... lines, one per line, as approvals arrive *build* | later |

All four `DEPLOY_` settings or none: with some missing the workflow stops and names them.

**The server: `/srv/samebutcheaper/.env`** (step 3 writes the first version). The full list with explanations is
`.env.example`.

| Name | Value | Needed |
|---|---|---|
| `POSTGRES_PASSWORD` | random, made in step 3. Only read when the database is first created | yes (the deploy refuses the example value) |
| `ADMIN_PASSWORD` | random, made in step 3; `/admin` user is `admin` | yes (launch checklist blocker) |
| `CLICK_HASH_SALT` | random, made in step 3 | yes (blocker) |
| `POSTBACK_SECRET` | random, made in step 3; goes into each network's postback URL | when networks report sales |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL` | the same values as `SITE_URL` and `CONTACT_EMAIL` above. The site ignores them here (they are *build*); `npm run preflight` reads them | advised |
| `RESEND_API_KEY`, `MAIL_FROM` | from Resend; `MAIL_FROM` on the verified domain | for any email |
| `LEGAL_NAME`, `LEGAL_ADDRESS`, `LEGAL_EMAIL` | the owner's real details | before any email to Germany (blocker once email is on) |
| `MAIL_POSTAL_ADDRESS`, `NEWSLETTER_WEEKLY=on` | for the weekly letter | later |
| `ANTHROPIC_API_KEY`, `OPENFDA_API_KEY`, `ADMIN_EMAIL` | optional features | no |
| `SBC_BLUE_PORT`, `SBC_GREEN_PORT` | default 3101 and 3102 | only if those are taken |
| `SBC_BIND` | default 127.0.0.1; the Docker bridge address if the proxy runs in a container | see step 8 |
| `SBC_WEB_MEMORY`, `SBC_WEB_CPUS`, `SBC_DB_MEMORY` | defaults 768m, 1, 512m | no |
| `CLIENT_IP_HEADER` | `cf-connecting-ip` only once Cloudflare sits in front | no |

Nothing secret is ever sent to the browser: the built scripts were searched for every variable name and for the
fake values used in the rehearsal, and none appear. Logs never print them either.

## On the day

### 1. DNS

At your DNS provider, add (the other site's records stay as they are):

| Type | Name | Value |
|---|---|---|
| A | `@` | the server's IPv4 address |
| A | `www` | the same address |
| AAAA | `@` and `www` | the server's IPv6 address, only if it has one and the other site uses it too |

Do this first: certificates can only be issued once the names point at the server.

### 2. A user and a directory for the site

On the server:

```sh
sudo adduser --disabled-password --gecos "" sbcdeploy
sudo usermod -aG docker sbcdeploy
sudo install -d -o sbcdeploy -g sbcdeploy -m 750 /srv/samebutcheaper
sudo -u sbcdeploy touch /srv/samebutcheaper/.samebutcheaper-deploy
```

The empty `.samebutcheaper-deploy` file is what the deploy looks for before it does anything. Being in the `docker`
group is as powerful as root: keep this user's key only in GitHub.

Check the two ports are free and there is room on the disk:

```sh
sudo ss -ltn | grep -E ':(3101|3102) ' ; df -h /srv /var/lib/docker ; free -m
```

No line from `ss` means the ports are free (otherwise pick two others and use them in step 3 and step 8). You want
at least 10 GB free on both disks and about 1.5 GB of memory the other site isn't using (see
[Sharing the server](#sharing-the-server-safely)).

### 3. The site's settings

This writes `/srv/samebutcheaper/.env` with new random passwords. Replace `yourdomain.com` first.

```sh
sudo -u sbcdeploy sh -c 'umask 077; cat > /srv/samebutcheaper/.env' <<EOF
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_CONTACT_EMAIL=hello@yourdomain.com
POSTGRES_PASSWORD=$(openssl rand -hex 24)
CLICK_HASH_SALT=$(openssl rand -hex 24)
POSTBACK_SECRET=$(openssl rand -hex 24)
ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=')
SBC_BLUE_PORT=3101
SBC_GREEN_PORT=3102
EOF
sudo cat /srv/samebutcheaper/.env
```

Copy the whole printed file into your password manager: it is the only copy of the database password, and
`ADMIN_PASSWORD` is how you get into `/admin` (user `admin`). Other settings go in the same file later
(`sudo -u sbcdeploy nano /srv/samebutcheaper/.env`), then run the Deploy workflow again to restart with them.

### 4. A key for GitHub to log in with

On the server:

```sh
sudo -u sbcdeploy sh -c 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && ssh-keygen -q -t ed25519 -N "" -C github-deploy -f ~/.ssh/github && cat ~/.ssh/github.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
sudo -u sbcdeploy cat /home/sbcdeploy/.ssh/github
```

Copy everything the last command prints, from `-----BEGIN` to `-----END OPENSSH PRIVATE KEY-----` inclusive: that
is `DEPLOY_SSH_KEY`. Once it is saved in GitHub (step 6), delete the server's copy of the private half:

```sh
sudo -u sbcdeploy rm /home/sbcdeploy/.ssh/github
```

### 5. The server's fingerprint

So GitHub only ever talks to your server. Replace `203.0.113.10` with exactly what you will put in `DEPLOY_HOST`:

```sh
echo "203.0.113.10 $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
```

The printed line is `DEPLOY_KNOWN_HOSTS`. If SSH listens on another port than 22, write the start as
`[203.0.113.10]:2222`.

### 6. GitHub settings

Add the variables and secrets from [the table above](#every-setting-in-one-place). Two optional settings:

- **Settings > Environments > production > Required reviewers**: tick yourself, and every deploy waits for your tap.
- **Settings > Actions > General > Workflow permissions**: "Allow GitHub Actions to create and approve pull
  requests", for the weekly price watch.

### 7. First deploy

**Actions > Deploy > Run workflow**, leave "deploy", **Run workflow**. About fifteen minutes the first time (build,
rehearsal, push, deploy). The run's summary ends with:

```
live: web-blue on 127.0.0.1:3101 (ghcr.io/...:sha-...)
```

The site now answers on the server itself, not yet on the domain:

```sh
curl -s http://127.0.0.1:3101/api/health
```

expect `"database":"ok"` and `"migrations":"8/8"` (the two numbers equal). `"ready":false` is normal until every
blocker on the launch checklist is fixed; `"blockers"` names them.

### 8. Reverse proxy

Find out which proxy the other site uses:

```sh
docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' | grep -Ei 'caddy|nginx|traefik'; systemctl is-active caddy nginx 2>/dev/null
```

A line with `0.0.0.0:443` means the proxy runs in a container; `active` means it runs on the server itself. Before
changing anything, copy its configuration: `sudo cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-sbc` (or
`/etc/nginx` for nginx).

#### Caddy

Add this block to the existing Caddyfile, below the other site's block, with your domain. Do not change the other block.

```caddy
yourdomain.com {
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

www.yourdomain.com {
	redir https://yourdomain.com{uri} permanent
}
```

Check, then reload. A reload keeps the other site's connections; a restart would drop them.

```sh
caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

Caddy fetches the certificate on the first visit and renews it itself. It sets `X-Forwarded-For` to the real visitor
address and ignores one sent by the visitor, which the site's rate limits rely on.

#### nginx

Create `/etc/nginx/sites-available/samebutcheaper` with your domain:

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
    server_name yourdomain.com www.yourdomain.com;
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
        # Replace, never append ($proxy_add_x_forwarded_for): the site rate limits sign-ups and admin password
        # attempts by the first address in this header, which a visitor could otherwise choose.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Pages stream in parts; pass each part on as it comes.
        proxy_buffering off;
        proxy_next_upstream error timeout http_502 http_503;
        proxy_next_upstream_tries 2;
    }
}
```

Switch it on, check, reload, and get the certificate (certbot adds the HTTPS part and the redirect from http):

```sh
sudo ln -s /etc/nginx/sites-available/samebutcheaper /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
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
since the other site depends on it. Never `SBC_BIND=0.0.0.0`: Docker publishes ports around the firewall. The deploy
refuses it.

### 9. Verify

Go through [Verify](#verify) below. When everything passes, the site is live.

## Verify

Run these after the first deploy, and after any change to the proxy, the domain or `.env`.

**On the server** (the server's own state; reads only):

```sh
cd /srv/samebutcheaper && DEPLOY_PATH=$PWD bash deploy-remote.sh check
```

Every line should say `PASS`: `.env` private, database password set, a backup from the last 26 hours, at least 5 GB
free under the site and under Docker, ports 3101/3102 only on 127.0.0.1, the live version healthy, and a memory
ceiling on it. The Deploy workflow runs the same check after each deploy and warns in its summary if a line fails.

**From your computer** (what visitors, crawlers and attackers see). Copy the server's `.env` to your computer as
`.env.server` (it holds secrets: delete it afterwards), then:

```sh
npm run preflight -- .env.server --url https://yourdomain.com
```

It prints `PASS`, `WARN` (should fix), `FAIL` (must fix) or `SKIP` for every item of the launch checklist, then
checks the live site: health and migrations, the redirect from http to https, HSTS, the security headers
(Content-Security-Policy, frame, nosniff, referrer and permissions policies), the canonical link, robots.txt and the
sitemap naming your domain, cookie flags, `/admin` asking for a password, `/go` reaching a store and refusing to
redirect anywhere else, and the service worker never being cached. It exits with 1 while anything must be fixed.

**By hand**, on your phone over mobile data:

| Open | Expect |
|---|---|
| `https://yourdomain.com/api/health` | `"database":"ok"`, `"migrations":"8/8"` (equal numbers), `"ready":true`, `"blockers":[]` |
| `http://yourdomain.com` | ends up on `https://yourdomain.com`, padlock shown |
| `https://www.yourdomain.com` | ends up on `https://yourdomain.com` |
| `https://yourdomain.com` | the home page; the footer's contact address is yours |
| `https://yourdomain.com/de` | the German home page |
| any swap page, then its store button | the store's page opens (with your tag once affiliate IDs are in) |
| `https://yourdomain.com/admin` | asks for a password; with `admin` and `ADMIN_PASSWORD`, the dashboard, whose launch checklist says "Safe to open to the public" |
| `https://yourdomain.com/robots.txt` | ends with `Sitemap: https://yourdomain.com/sitemap.xml` |
| `https://yourdomain.com/impressum` | the owner's details, once `LEGAL_*` are set |
| sign up on the home page with your own address | the confirmation email arrives (once Resend is set), not in spam |
| **the other site** | loads as before; `docker ps` shows its containers with the same "Up" time as before you started |

## Sharing the server safely

What SameButCheaper takes on the server, measured in the rehearsal (`scripts/ci/rehearse-deploy.sh`) and a load test
of the production image under its own ceiling:

| Resource | Use | Ceiling (in `docker-compose.deploy.yml`) |
|---|---|---|
| Ports | 3101 and 3102 on 127.0.0.1 only; nothing on 80/443; Postgres publishes no port at all | `SBC_BIND`, `SBC_*_PORT` |
| Memory, web | about 180 MB idle, under 250 MB at 20 concurrent visitors; two copies for a minute during a deploy | 768 MB each (`SBC_WEB_MEMORY`) |
| Memory, database | 50 to 150 MB | 512 MB (`SBC_DB_MEMORY`) |
| Memory, backup | a few MB, more during the nightly dump | 256 MB |
| CPU | one core while rendering; an unprefixed page takes 15 to 35 ms, a prefixed swap about 25 ms, a prefixed home (a static file) about 5 ms (see "Load test") | 1 core (`SBC_WEB_CPUS`) |
| Disk, images | about 1.3 GB per version, two kept (live and previous), older ones removed by each deploy | |
| Disk, logs | at most 50 MB per container (10 MB x 5), four containers | in the compose file |
| Disk, backups | one file a day, 14 kept (`BACKUP_KEEP_DAYS`); a few MB each at first | |
| Disk, database | grows with clicks and sign-ups; tens of MB in the first months | |

So plan for about 1.5 GB of memory and 5 GB of disk. The ceilings mean a fault in this site ends in its own container
being restarted, not in the other site running out of memory or CPU.

If the server ever runs short:

- `docker stats --no-stream` shows each container's use; the other site's should not change when this one deploys;
- the database can do with less: `SBC_DB_MEMORY=384m` in `.env`, then deploy (the database container restarts once,
  for a few seconds; the site keeps serving pages while it does, as rehearsed);
- disk: `docker system df` shows what Docker holds; remove only `ghcr.io/<you>/samebutcheaper` images that are not
  in use (`docker image ls ghcr.io/*/samebutcheaper`), never `docker system prune` on a shared server.

**Version skew.** During a switch, someone with a page open from the old version may click on into the new one. The
image is built with the commit as Next's deployment ID, so their browser reloads the page instead of asking the new
server for scripts it doesn't have. The service worker also keeps static files a visitor already loaded.

## The first 48 hours

| When | Look at | Healthy |
|---|---|---|
| First hour | `deploy-remote.sh check` and `npm run preflight -- ... --url` | all PASS |
| First hour | errors in the log: `cd /srv/samebutcheaper && docker compose -p samebutcheaper -f docker-compose.deploy.yml logs --since 1h web-blue web-green \| grep '"level":"error"'` | nothing, or a handful you understand |
| First hour | the other site | as before; its memory in `docker stats --no-stream` unchanged |
| A few hours in | `/admin`: clicks, product checks, sign-ups | real visits appear |
| A few hours in | each affiliate network's dashboard | clicks counted there too |
| Next morning | Actions > Site check | green |
| Next morning | `ls -l /srv/samebutcheaper/backups` | a new file from about 03:15 UTC |
| Next morning | `/admin`, "Daily upkeep" line | ran in the last 24 hours |
| Next morning | `docker stats --no-stream`, `df -h` | web under 400 MB; disk use not climbing fast |
| Day 1 and 2 | Resend dashboard | confirmation emails delivered, few bounces |
| Day 1 and 2 | Google Search Console: add the domain, submit `https://yourdomain.com/sitemap.xml` | sitemap read, no "blocked by robots" for pages you want found |
| Day 2 | the proxy's access log, 5xx answers | close to none; a burst means look at the web log at that time |
| Day 2 | certificate | valid; the proxy renews it itself (`sudo certbot renew --dry-run` for nginx) |
| First Monday | Actions > Deploy (weekly rebuild) and Price watch | both green |

## Rolling back

From the phone: **Actions > Deploy > Run workflow**, choose **rollback**. Or on the server:

```sh
cd /srv/samebutcheaper && DEPLOY_PATH=$PWD bash deploy-remote.sh rollback
```

It starts the previous version (its container was only stopped, so this takes seconds), checks it, then stops the
current one. Run it again to go forward again. `status` shows what runs:

```sh
cd /srv/samebutcheaper && DEPLOY_PATH=$PWD bash deploy-remote.sh status
```

Database changes are not undone. They only ever add tables and columns (a test fails the build if a migration
drops or renames anything), so the older version runs on the newer database. If data itself must go back, restore a
backup (below).

## Backups, and restoring one

The `backup` container writes `backups/samebutcheaper-YYYY-MM-DD.sql.gz` every night at about 03:15 UTC, and once
more before every deploy, and keeps 14 days (`BACKUP_KEEP_DAYS`). They sit on the same disk as the database, so copy
them elsewhere too:

- **Hetzner Storage Box** (or any SSH storage): as `sbcdeploy`, `crontab -e`, add
  `30 4 * * * rsync -a /srv/samebutcheaper/backups/ u12345@u12345.your-storagebox.de:samebutcheaper/`
- **to your own computer** now and then: `scp sbcdeploy@203.0.113.10:/srv/samebutcheaper/backups/*.gz .`

Short form for the commands below (paste once per SSH session):

```sh
cd /srv/samebutcheaper && dc() { docker compose -p samebutcheaper --project-directory "$PWD" -f docker-compose.deploy.yml "$@"; }
```

**Try a restore without touching the live data** (do it once in the first week, so you know it works):

```sh
dc exec -T db psql -q -U sbc -d samebutcheaper -c "create database restore_test"
gunzip -c "$(ls -t backups/*.sql.gz | head -1)" | dc exec -T db psql -q -U sbc -d restore_test
dc exec -T db psql -U sbc -d restore_test -c "select count(*) as clicks from clicks"
dc exec -T db psql -q -U sbc -d samebutcheaper -c "drop database restore_test"
```

The count should match `/admin`'s total. (The rehearsal goes further: it starts the site on the restored copy and
checks it serves with every migration in place.)

**Restore for real** (replaces the live data with the backup; anything recorded since the backup is lost):

```sh
dc exec -T backup /bin/sh /backup.sh once        # a fresh backup of what is there now, just in case
ls -lt backups | head                             # choose the file to restore
gunzip -c backups/samebutcheaper-2026-11-10.sql.gz | dc exec -T db psql -q -U sbc -d samebutcheaper
curl -s http://127.0.0.1:3101/api/health; curl -s http://127.0.0.1:3102/api/health
```

The site keeps serving pages during the restore; a click or sign-up in that minute may not be saved. One of the two
health answers should say `"database":"ok"` with equal migration numbers (the other port is the stopped colour).

## Rotating a secret

Change the value, then make the site pick it up. For values in the server's `.env`: edit the file
(`sudo -u sbcdeploy nano /srv/samebutcheaper/.env`), then **Actions > Deploy > Run workflow** ("deploy"): the new
colour starts with the new `.env`, the old one stops. Settings marked *build* need the same, after changing them in
GitHub.

| Secret | How | Side effects |
|---|---|---|
| `ADMIN_PASSWORD` | `openssl rand -base64 18 \| tr -d '/+='`, into `.env`, deploy | log in again |
| `CLICK_HASH_SALT` | `openssl rand -hex 24`, into `.env`, deploy | unique-visitor counts start afresh; nothing else |
| `POSTBACK_SECRET` | `openssl rand -hex 24`, into `.env`, deploy, then update the postback URL in every network the same hour | sales reported with the old key in between are refused (the network retries) |
| `RESEND_API_KEY` | new key in Resend, into `.env`, deploy, then delete the old key in Resend | none |
| `ANTHROPIC_API_KEY`, `OPENFDA_API_KEY` | new key, into `.env`, deploy, revoke the old one | none |
| `POSTGRES_PASSWORD` | see below | a few seconds of database restart |
| `DEPLOY_SSH_KEY` | repeat step 4 (it appends a new key), save it in GitHub, then remove the old line from `/home/sbcdeploy/.ssh/authorized_keys` | none |
| Affiliate IDs (`AFFILIATE_ENV`) | edit the secret in GitHub, deploy | links use the new IDs from the new version on |

`POSTGRES_PASSWORD` is only read when the database is first created, so change it in the database first:

```sh
NEW=$(openssl rand -hex 24)
dc exec -T db psql -U sbc -d samebutcheaper -c "alter user sbc with password '$NEW'"
sudo -u sbcdeploy sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW/" .env
dc up -d backup
```

then deploy. Between the `alter user` and the deploy, the running site can't open new database connections (pages
still serve; clicks wait or are lost), so do the three lines and start the deploy straight away. Save the new `.env`
in your password manager.

A secret you think has leaked: rotate it first, then look at `/admin` and the logs for what it could have been used for.

## Every day after that

| When | What | Where |
|---|---|---|
| Each push to `main` | build, rehearse, push, deploy, check | Actions > Deploy |
| Mondays 05:17 UTC | price watch opens a pull request with new prices | Actions > Price watch |
| Mondays 06:30 UTC | rebuild and deploy, even with no changes | Actions > Deploy |
| Daily 07:11 UTC | check the live site from outside | Actions > Site check |
| Daily, inside the site | upkeep: retention, confirmation and price-watch emails, the weekly letter | `src/lib/maintenance.ts` |
| Nightly 03:15 UTC, and before each deploy | database backup | `/srv/samebutcheaper/backups` |

Why weekly: how fresh each price looks ("checked this week", "checked a month ago") is worked out when the site is
built (`docs/prices.md`). A site not rebuilt for weeks would keep calling old prices fresh.

The upkeep needs no outside trigger: it runs inside the web server a minute after it starts and every six hours, and
does its work once a day (`src/lib/server/startup.ts`). A database lock stops it running twice while both colours
are briefly up.

## The rehearsal

`scripts/ci/rehearse-deploy.sh` runs this whole path on one machine, with nothing outside it, and is what made the
fixes in this release (see the commit history of this file). It runs `deploy-remote.sh` unchanged, as the server
does, and checks: the refusals (no marker, a shared directory, `SBC_BIND=0.0.0.0`, a malformed image, the example
database password); a first deploy (backup, every migration, blue live, pages, sitemap, `/admin`, `/go` and a click
saved); a second deploy (green live, blue stopped, previous image kept); rollback; a deploy that never gets healthy
(stopped, blue keeps serving, state untouched); `deploy-remote.sh check`; a backup restored into a second database
with the site running on it; the database going away (every page and `/go` still answer, health says "down", and it
recovers by itself without a restart); a database that hangs instead of failing (pages still answer at once, health
in two seconds); and that the upkeep ran.

```sh
# with Docker, against an image built from the Dockerfile (the Deploy workflow does this before every push)
bash scripts/ci/rehearse-deploy.sh docker ghcr.io/you/samebutcheaper:sha-abc
# without Docker (CI does this on every push): the standalone build, started as the image starts it
npm run build && REHEARSAL_PG=postgres://postgres@127.0.0.1:5432/postgres bash scripts/ci/rehearse-deploy.sh standalone
```

`REHEARSAL_PORTS="3101 3102 3103 3104"` changes the four ports it uses.

What it cannot rehearse: your DNS, the certificate, the other site's proxy and firewall, GitHub's SSH step into your
server, pulling from GHCR with the real token, and the server's own disk and memory. Those are what
[Verify](#verify) checks on the day.

## When something is wrong

| What you see | What to do |
|---|---|
| Deploy says "not configured" | Expected until `SITE_URL` is set. |
| "Deploy half configured" | Add the missing `DEPLOY_` setting it names, or remove the others. |
| "Not set up" / marker missing | Step 2 on the server, or `DEPLOY_PATH` doesn't match the directory. |
| "Host key verification failed" | `DEPLOY_KNOWN_HOSTS` doesn't match `DEPLOY_HOST`; redo step 5 with exactly the same host. |
| "POSTGRES_PASSWORD ... still the placeholder" | Step 3: the file still has the example value. |
| "Port ... is already in use" | Pick other ports in `.env` (`SBC_BLUE_PORT`, `SBC_GREEN_PORT`) and in the proxy snippet. |
| "did not become healthy" | Read the log lines in the run. The old version is still live. Fix and push again. |
| "Launch rehearsal" failed in the run | The image was not pushed and the server was not touched. The run's log says which check failed. |
| Health fine on the server, domain doesn't load | DNS (step 1), the proxy block (step 8), or ports 80/443 closed in the Hetzner firewall. |
| `"database":"down"` | Pages and store links keep working; sign-ups, clicks and `/admin` figures don't. `dc ps db` and `dc logs --tail 50 db`; `dc up -d db` starts it. The site reconnects by itself. |
| "pre-deploy backup failed" | Disk full? `df -h /srv`. Nothing was changed. |
| "Could not pull ... not on this server" (a deploy started on the server) | Use the Deploy workflow: it logs in to GHCR for the run. |
| The other site is slow during a deploy | Two copies run for about a minute; lower `SBC_WEB_CPUS` (for example `0.5`) and deploy at quiet hours. |
| Price watch: "not permitted to create pull requests" | Step 6, the Workflow permissions box; or open the pull request from the link in the run. |

## Quality checks in CI

Each push and pull request runs, after the tests, `scripts/ci/quality.mjs` against the built site (accessibility with
axe at 390 and 1280 px, no sideways scroll at 390 px, and the performance budget in `scripts/ci/quality.config.json`,
which includes each page's HTML weight, raw and gzipped), then the launch rehearsal. To see today's numbers:
`npm run build`, then `node scripts/ci/quality.mjs --measure`.

## Load test

Optional, and never a CI gate: the numbers depend on the machine and on whatever else runs on it, so compare runs on
the same machine, back to back. `scripts/ci/loadtest.mjs` (no dependencies) keeps 20 connections busy on one page at a
time (home, `/de`, a US swap with and without its `/us` prefix, a German swap, a kit, a hub, search, the search
index, a `/go` redirect and the health check) and reports requests a second, p50/p95/p99 latency, the HTML's size raw,
gzipped and brotli, and, given the server's process ID on the same Linux machine, its CPU time per request:

```bash
npm run build && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
(cd .next/standalone && PORT=3000 node --max-old-space-size=512 server.js &)
node scripts/ci/loadtest.mjs --url http://127.0.0.1:3000 --pid <the server's pid> --runs 3
```

`--runs 3` repeats each page and shows the best run and the spread; `--only home,swap-de` picks pages; `--json out.json`
keeps the raw numbers; `--encoding gzip` asks for compressed pages, as a browser does. The shopper has a US cookie, so
unprefixed pages render their per-country parts as a returning visitor's would. To try the production image under its
ceilings instead, start it with `docker run --cpus 1 --memory 768m` and point `--url` at it (no `--pid` then; use
`docker stats`).

**14 Nov 2026, before and after the serving work** (one shared 4-core machine, 20 connections, 8 s a page, best of
three; the server alone on one core is what counts, so read the CPU column):

| Page | req/s (spread) | p50 / p95 / p99 ms | CPU ms/req | HTML KB raw / gzip |
|---|---|---|---|---|
| home `/` | 31.7 (±0.2) → 41.7 (±2.3) | 636 / 703 / 1749 → 478 / 527 / 1327 | 41.5 → 33.7 | 327 / 48 → 269 / 39 |
| home-de `/de` | 28.1 (±0.2) → 225 (±3.4) | 712 / 778 / 1585 → 85.0 / 123 / 128 | 43.3 → 4.8 | 378 / 57 → 253 / 37 |
| swap-us `/compare/tylenol-extra-strength-vs-eq...` | 12.5 (±0.2) → 38.6 (±1.7) | 1530 / 3260 / 4779 → 497 / 626 / 1360 | 91.3 → 34.8 | 390 / 59 → 275 / 42 |
| swap-us-pfx `/us/compare/tylenol-extra-strength-vs...` | 16.3 (±0.4) → 50.1 (±3.5) | 1197 / 1814 / 3026 → 398 / 455 / 837 | 70.6 → 24.9 | 295 / 46 → 184 / 30 |
| swap-de `/de/compare/aspirin-vs-ass-500-1a-pha...` | 16.2 (±0.5) → 45.8 (±0.6) | 1168 / 1993 / 2964 → 430 / 488 / 1032 | 71.1 → 26.8 | 314 / 49 → 196 / 33 |
| kit `/bundle/advil-20ct-300ct-value-bundle...` | 29.4 (±0.7) → 44.7 (±1.6) | 672 / 725 / 1925 → 434 / 518 / 1245 | 44.2 → 29.1 | 387 / 55 → 278 / 40 |
| hub `/dupe/zyrtec-cetirizine-dihydrochloride` | 49.4 (±0.6) → 78.5 (±6.6) | 388 / 511 / 967 → 245 / 323 / 513 | 25.8 → 16.1 | 163 / 25 → 107 / 17 |
| search `/search` | 53.8 (±0.4) → 90.8 (±2.3) | 358 / 471 / 922 → 217 / 279 / 414 | 24.0 → 14.1 | 156 / 23 → 100 / 15 |
| search-index `/search/index.json` | 666 (±53.2) → 658 (±28.7) | 27.8 / 44.4 / 59.9 → 28.5 / 45.0 / 65.1 | 1.6 → 1.6 | 466 / 97 → 466 / 97 |
| go `/go/tylenol-extra-strength-vs-equate-...` | 817 (±40.9) → 854 (±18.9) | 23.1 / 38.9 / 51.2 → 22.2 / 36.2 / 48.6 | 1.4 → 1.3 | - / 0 → - / 0 |
| health `/api/health` | 201 (±8.7) → 416 (±22.1) | 94.0 / 134 / 172 → 45.6 / 64.8 / 83.2 | 5.3 → 2.5 | 0 / 0 → 0 / 0 |

What changed, and what each page now costs:

- **Prefixed pages are static files.** `/de/...`, `/us/...` and the other prefixes no longer read the request: the country
  band moved from the root layout into each section's layout (`src/components/CountryBand.tsx`), so the root layout
  is static and a prefixed home, aisle, basket or info page is served from the build as a file. A prefixed swap or kit
  page has one hole left, the shoppers' price reports (`src/lib/reported.ts`, read per request, cached for a minute).
- **Unprefixed pages render only what depends on the shopper.** The band and the per-country parts stream into a
  static shell, as before; the shell itself is no longer rendered twice per request (`partialPrefetching: false` in
  `next.config.ts`: with it on, every dynamic request also rendered a second, prefetch copy of the page and put it in
  the HTML, about 100 KB).
- **Work done once, not per request.** Which affiliate programmes are live and which store terms are off
  (`src/lib/affiliate-links.ts`, `src/lib/programme-terms.ts`) was recomputed for every store on every render, about a
  quarter of a swap page's CPU; it is now remembered until the settings change.
- **Caching.** A static page carries `s-maxage` and an ETag (a repeat visit gets 304). A response that sets the country
  cookie is `private, no-cache` (`src/proxy.ts`), so no cache in between ever hands one shopper's detected country to
  the next; `scripts/tests/serving.test.ts` checks both. `revalidatePath` after a price expiry
  (docs/prices-daily.md) still reaches every page: the static ones are rebuilt files like any other.
- **Compression** stays in Next (gzip, about 1 ms a page); Caddy's `encode zstd gzip` passes an already compressed
  response through, and compresses whatever Next doesn't.
- **What remains.** An unprefixed swap or kit still renders per request (its prices are the shopper's country's), and so
  does a hub (`/dupe/...`), whose whole list is per country; prefixed hubs would make them static too. The HTML still
  carries both languages' header and footer (about 15 KB raw).

The search index and `/go` were already cheap and stay so. The health check got faster as a side effect: it reads the
same programme settings, now remembered. On the server (one core) the CPU column is the ceiling: 1000 divided by it is
about how many of that page one core serves a second, so a prefixed page is now about 40 a second per core for a swap
and 200 for a prefixed home, and an unprefixed swap about 30.

**Memory.** Five minutes of mixed load (every page above in turn, 20 connections, 30 s each) with
`node --max-old-space-size=512`: the server started at 180 MB, was at 300 MB within 10 s, rose slowly to 360 MB while
each page type warmed its caches, and stayed at 358 to 359 MB for the last 90 s, with no errors logged. The same
pages before this work peaked at about 500 MB. Both are well inside the 768 MB ceiling.

**Database.** The pool is `DB_POOL_MAX` connections (default 10) per web container, so 20 while two copies run during
a deploy, against Postgres' default of 100: plenty for one core, where a request rarely holds a connection for more
than a few milliseconds. `/go` answers before it writes the click (`after()` in `src/lib/outbound.ts`), so a slow
database never holds up a redirect.

## The app on a home screen

`/manifest.webmanifest` and the icons in `public/icons` let phones add the site to the home screen. `public/sw.js`
keeps the offline page, My list and the static files; it never keeps other pages, prices or anything that depends on
the country, and never handles `/go/`, `/out`, `/admin` or `/api/`. To change it, edit it and raise `VERSION` at the
top; the file's header has a kill switch that removes it from every browser.

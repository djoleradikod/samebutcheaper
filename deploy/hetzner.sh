#!/usr/bin/env bash
# Deploy or update SameButCheaper on an Ubuntu VPS (Hetzner) with HTTPS.
#
#   ssh root@<server-ip> 'bash -s' < deploy/hetzner.sh              # free address: <ip>.sslip.io
#   ssh root@<server-ip> 'bash -s' < deploy/hetzner.sh example.com  # your own domain (A record -> server)
#
# Safe to run again: it pulls the latest main and rebuilds. Secrets are created
# on the server the first time and stay in /opt/samebutcheaper/.env; nothing
# secret is printed or committed.
set -euo pipefail

DOMAIN="${1:-}"
DIR=/opt/samebutcheaper
REPO=https://github.com/djoleradikod/samebutcheaper.git

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (or with sudo)." >&2
  exit 1
fi

# For a server of its own only: this starts Caddy on ports 80 and 443. Refuse where another site already runs (other
# containers, or something else on 80/443): there, use the Deploy workflow and docs/deploy.md, which never touch them.
if [ "${SBC_OWN_SERVER:-}" != yes ]; then
  foreign=""; ours_caddy=""
  if command -v docker >/dev/null 2>&1; then
    foreign="$(docker ps --format '{{.Names}} {{.Label "com.docker.compose.project"}}' 2>/dev/null | awk '$2 != "samebutcheaper" {print $1}' | tr '\n' ' ')"
    ours_caddy="$(docker ps -q --filter label=com.docker.compose.project=samebutcheaper --filter label=com.docker.compose.service=caddy 2>/dev/null || true)"
  fi
  web_ports="$(ss -ltnH 2>/dev/null | awk '{print $4}' | grep -E ':(80|443)$' | tr '\n' ' ' || true)"
  if [ -n "$foreign" ] || { [ -n "$web_ports" ] && [ -z "$ours_caddy" ]; }; then
    echo "Refusing: this server already runs something else (${foreign:+containers: $foreign}${web_ports:+ports: $web_ports})." >&2
    echo "This script would take ports 80 and 443. On a shared server, follow docs/deploy.md instead." >&2
    echo "Only if this server is yours alone and nothing on it matters: SBC_OWN_SERVER=yes." >&2
    exit 1
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi
command -v git >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq git)

if [ -z "$DOMAIN" ]; then
  IP="$(curl -fsS4 --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"
  DOMAIN="${IP//./-}.sslip.io"
fi
echo "Site address: https://$DOMAIN"

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi
cd "$DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  rand() { openssl rand -hex 24; }
  sed -i \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rand)|" \
    -e "s|^CLICK_HASH_SALT=.*|CLICK_HASH_SALT=$(rand)|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=')|" \
    -e "s|^POSTBACK_SECRET=.*|POSTBACK_SECRET=$(rand)|" \
    .env
  chmod 600 .env
  echo "Created .env with new random passwords (admin password: ADMIN_PASSWORD in $DIR/.env)."
fi

# Public address, and keep port 3000 private so traffic goes through Caddy (HTTPS).
sed -i \
  -e "s|^SITE_DOMAIN=.*|SITE_DOMAIN=$DOMAIN|" \
  -e "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://$DOMAIN|" \
  -e "s|^WEB_PORT=.*|WEB_PORT=127.0.0.1:3000|" \
  .env

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

docker compose --profile proxy up -d --build

echo "Waiting for the site..."
for _ in $(seq 1 60); do
  if curl -fsS --max-time 5 "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
    curl -fsS --max-time 5 "http://127.0.0.1:3000/api/health"
    echo
    # The launch checklist: "ready":false lists what blocks a public launch; /admin says how to fix each.
    curl -sS --max-time 10 "http://127.0.0.1:3000/api/health?ready=1" || true
    echo
    echo "Up. HTTPS can take a minute while Caddy gets the certificate: https://$DOMAIN"
    echo "If it never loads from outside, open ports 80 and 443 in the Hetzner Cloud firewall."
    exit 0
  fi
  sleep 5
done
echo "The site didn't answer on port 3000. Logs: docker compose -f $DIR/docker-compose.yml logs --tail=80 web migrate" >&2
exit 1

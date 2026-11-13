#!/usr/bin/env bash
# Runs on the server, in DEPLOY_PATH, to deploy or roll back SameButCheaper. The deploy workflow copies it there
# with docker-compose.deploy.yml and deploy/backup.sh and calls it; by hand it is
#
#   cd /srv/samebutcheaper && DEPLOY_PATH=$PWD bash deploy-remote.sh status
#   cd /srv/samebutcheaper && DEPLOY_PATH=$PWD bash deploy-remote.sh rollback      back to the previous image
#   cd /srv/samebutcheaper && DEPLOY_PATH=$PWD bash deploy-remote.sh deploy ghcr.io/owner/samebutcheaper:sha-abc1234
#
# What it touches, and nothing else: the compose project SBC_PROJECT (default "samebutcheaper") defined by
# DEPLOY_PATH/docker-compose.deploy.yml, files under DEPLOY_PATH, and images of the repository it deploys. It never
# restarts Docker or the reverse proxy, never runs `docker compose down`, `docker system prune` or anything
# server-wide, and refuses to run unless DEPLOY_PATH is set, is a directory of its own and holds the marker file
# .samebutcheaper-deploy that the one-time setup creates (docs/deploy.md).
#
# How a deploy goes: pull the image; make sure the database is up; back it up; apply migrations with the new image;
# start the idle colour (web-blue on SBC_BLUE_PORT, web-green on SBC_GREEN_PORT, on 127.0.0.1 or SBC_BIND) with the new
# image; wait for /api/health to say the database answers with every migration applied, and for the home page;
# then stop the old colour. The proxy lists both ports and uses whichever answers. The old colour's container is
# stopped, not removed, so `rollback` starts it again in seconds. If the new one never gets healthy it is stopped
# and the old one keeps serving.
set -euo pipefail

MARKER=.samebutcheaper-deploy
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

say() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { printf 'deploy-remote: %s\n' "$*" >&2; exit 1; }

# ---------- refuse anything that isn't clearly our own directory ----------
[ -n "${DEPLOY_PATH:-}" ] || die "DEPLOY_PATH is not set. Refusing to run: it must name this site's own directory."
case "$DEPLOY_PATH" in
  /*) ;;
  *) die "DEPLOY_PATH must be an absolute path (got '$DEPLOY_PATH')." ;;
esac
DEPLOY_PATH="${DEPLOY_PATH%/}"
[[ "$DEPLOY_PATH" =~ ^/[A-Za-z0-9._/-]+$ ]] || die "DEPLOY_PATH may only hold letters, digits and . _ - / (got '$DEPLOY_PATH')."
[[ "$DEPLOY_PATH" != *..* ]] || die "DEPLOY_PATH may not contain '..'."
case "$DEPLOY_PATH" in
  /|/root|/home|/opt|/srv|/var|/var/lib|/var/www|/etc|/usr|/usr/local|/tmp|/mnt|/data|/var/lib/docker*)
    die "DEPLOY_PATH '$DEPLOY_PATH' is a shared system directory. Use a directory of its own, such as /srv/samebutcheaper." ;;
esac
# /home/<user> itself is someone's home: a site directory must sit below it.
[[ ! "$DEPLOY_PATH" =~ ^/home/[^/]+$ ]] || die "DEPLOY_PATH '$DEPLOY_PATH' is a home directory. Use a directory below it, or /srv/samebutcheaper."
[ -d "$DEPLOY_PATH" ] || die "DEPLOY_PATH '$DEPLOY_PATH' does not exist. Create it first (docs/deploy.md, step 2)."
[ -f "$DEPLOY_PATH/$MARKER" ] || die "No $DEPLOY_PATH/$MARKER. Refusing: this does not look like the SameButCheaper directory (docs/deploy.md, step 2)."
cd "$DEPLOY_PATH"

COMPOSE_FILE_PATH="$DEPLOY_PATH/docker-compose.deploy.yml"
STATE_DIR="$DEPLOY_PATH/.deploy"
STATE="$STATE_DIR/state"
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

# Settings the owner may put in .env (read without executing it).
envval() { [ -f .env ] && sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" .env | tail -n1 | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true; }
PROJECT="${SBC_PROJECT:-$(envval SBC_PROJECT)}"; PROJECT="${PROJECT:-samebutcheaper}"
BLUE_PORT="$(envval SBC_BLUE_PORT)"; BLUE_PORT="${BLUE_PORT:-3101}"
GREEN_PORT="$(envval SBC_GREEN_PORT)"; GREEN_PORT="${GREEN_PORT:-3102}"
BIND="$(envval SBC_BIND)"; BIND="${BIND:-127.0.0.1}"
REQUIRE_READY="${REQUIRE_READY:-$(envval DEPLOY_REQUIRE_READY)}"
# Docker-published ports skip the host firewall, so the site must never listen on every address: only loopback, or a
# private address a containerised proxy can reach (docs/deploy.md, "Reverse proxy").
if ! [[ "$BIND" =~ ^(127\.[0-9.]+|10\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+|192\.168\.[0-9.]+)$ ]]; then
  die "SBC_BIND must be 127.0.0.1 or a private address (got '$BIND'). Never 0.0.0.0: that would put the site on the internet around the proxy."
fi
[[ "$PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "SBC_PROJECT must be lower-case letters, digits, - and _."
[[ "$BLUE_PORT" =~ ^[0-9]+$ && "$GREEN_PORT" =~ ^[0-9]+$ && "$BLUE_PORT" != "$GREEN_PORT" ]] || die "SBC_BLUE_PORT and SBC_GREEN_PORT must be two different port numbers."

# Registry login lives in this directory, not in the user's ~/.docker, so it can't affect anything else.
export DOCKER_CONFIG="$DEPLOY_PATH/.docker"
mkdir -p "$DOCKER_CONFIG"
chmod 700 "$DOCKER_CONFIG"

# ---------- state ----------
ACTIVE=""; IMAGE_BLUE=""; IMAGE_GREEN=""; DEPLOYED_AT=""
if [ -f "$STATE" ]; then
  while IFS='=' read -r k v; do
    case "$k" in
      ACTIVE) ACTIVE="$v" ;; IMAGE_BLUE) IMAGE_BLUE="$v" ;; IMAGE_GREEN) IMAGE_GREEN="$v" ;; DEPLOYED_AT) DEPLOYED_AT="$v" ;;
    esac
  done < "$STATE"
fi
save_state() {
  printf 'ACTIVE=%s\nIMAGE_BLUE=%s\nIMAGE_GREEN=%s\nDEPLOYED_AT=%s\n' "$ACTIVE" "$IMAGE_BLUE" "$IMAGE_GREEN" "$(date -u +%FT%TZ)" > "$STATE.tmp"
  mv "$STATE.tmp" "$STATE"
}

dc() {
  SBC_IMAGE_BLUE="${IMAGE_BLUE:-samebutcheaper:unset}" SBC_IMAGE_GREEN="${IMAGE_GREEN:-samebutcheaper:unset}" \
  SBC_BLUE_PORT="$BLUE_PORT" SBC_GREEN_PORT="$GREEN_PORT" SBC_BIND="$BIND" \
    docker compose --project-name "$PROJECT" --project-directory "$DEPLOY_PATH" -f "$COMPOSE_FILE_PATH" "$@"
}

port_of() { if [ "$1" = blue ]; then echo "$BLUE_PORT"; else echo "$GREEN_PORT"; fi; }
image_of() { if [ "$1" = blue ]; then echo "$IMAGE_BLUE"; else echo "$IMAGE_GREEN"; fi; }
other() { if [ "$1" = blue ]; then echo green; else echo blue; fi; }

# The project name must not belong to containers started from another directory.
check_project_is_ours() {
  local dirs
  dirs="$(docker ps -a --filter "label=com.docker.compose.project=$PROJECT" --format '{{.Label "com.docker.compose.project.working_dir"}}' | sort -u)"
  if [ -n "$dirs" ] && [ "$dirs" != "$DEPLOY_PATH" ]; then
    die "Compose project '$PROJECT' already has containers from another directory ($dirs). Set SBC_PROJECT in .env to a name of its own."
  fi
}

# A port we are about to bind must be free unless our own container of that colour holds it.
check_port_free() {
  local port="$1" colour="$2" running
  running="$(dc ps --status running -q "web-$colour" 2>/dev/null || true)"
  [ -z "$running" ] || return 0
  if command -v ss >/dev/null 2>&1; then
    if ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)$port\$"; then
      die "Port $port is already in use by something else on this server. Pick free ports with SBC_BLUE_PORT / SBC_GREEN_PORT in .env."
    fi
  else
    say "warning: 'ss' not found, cannot check that port $port is free"
  fi
}

# "migrations":"12/11" counts as done: a rollback runs older code against a database that has the newer migrations,
# which only ever add.
migrations_done() {
  local m applied expected
  m="$(printf '%s' "$1" | sed -n 's/.*"migrations":"\([0-9]*\)\/\([0-9]*\)".*/\1 \2/p')"
  [ -n "$m" ] || return 1
  read -r applied expected <<< "$m"
  [ "$applied" -ge "$expected" ]
}

# Healthy: /api/health answers, the database is reachable with every migration applied, and the home page renders.
wait_healthy() {
  local port="$1" deadline body
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
  say "waiting for $BIND:$port (up to ${HEALTH_TIMEOUT}s)"
  while [ "$(date +%s)" -lt "$deadline" ]; do
    body="$(curl -fsS --max-time 5 "http://$BIND:$port/api/health" 2>/dev/null || true)"
    if [ -n "$body" ] && printf '%s' "$body" | grep -q '"database":"ok"' && migrations_done "$body"; then
      if curl -fsS --max-time 15 -o /dev/null "http://$BIND:$port/"; then
        say "healthy: $body"
        if [ "$REQUIRE_READY" = "1" ] && ! curl -fsS --max-time 10 -o /dev/null "http://$BIND:$port/api/health?ready=1"; then
          say "the launch checklist still has blockers (DEPLOY_REQUIRE_READY=1): see /admin"
          return 1
        fi
        return 0
      fi
    fi
    sleep 3
  done
  say "not healthy in time; last answer: ${body:-none}"
  return 1
}

# Start COLOUR with IMAGE, check it, then stop the other colour. On failure the other keeps serving.
switch_to() {
  local colour="$1" image="$2" old port
  old="$(other "$colour")"
  port="$(port_of "$colour")"
  check_port_free "$port" "$colour"
  if [ "$colour" = blue ]; then IMAGE_BLUE="$image"; else IMAGE_GREEN="$image"; fi
  say "starting web-$colour with $image on $BIND:$port"
  dc up -d --no-deps "web-$colour"
  if ! wait_healthy "$port"; then
    dc logs --tail=80 "web-$colour" >&2 || true
    dc stop -t 30 "web-$colour" || true
    die "web-$colour did not become healthy; it is stopped and web-$old (if it was running) is still serving."
  fi
  ACTIVE="$colour"
  save_state
  if [ -n "$(dc ps --status running -q "web-$old" 2>/dev/null || true)" ]; then
    say "stopping web-$old (kept for rollback)"
    dc stop -t 30 "web-$old"
  fi
  say "live: web-$colour on $BIND:$port ($image)"
}

# Keep the images the two colours use; remove older ones of the same repository only.
prune_images() {
  local repo="$1" keep="" id
  for ref in "$IMAGE_BLUE" "$IMAGE_GREEN"; do
    [ -n "$ref" ] && keep="$keep $(docker image inspect -f '{{.Id}}' "$ref" 2>/dev/null || true)"
  done
  for id in $(docker image ls --no-trunc -q "$repo" | sort -u); do
    case " $keep " in *" $id "*) ;; *) docker image rm "$id" >/dev/null 2>&1 && say "removed old image ${id:7:12}" || true ;; esac
  done
}

cmd="${1:-status}"
case "$cmd" in
  login)
    # docker login for GHCR from stdin: deploy-remote.sh login <user>  (the workflow pipes its short-lived token)
    [ -n "${2:-}" ] || die "usage: login <registry user>"
    docker login ghcr.io -u "$2" --password-stdin >/dev/null
    say "logged in to ghcr.io (credentials in $DOCKER_CONFIG only)"
    ;;

  deploy)
    image="${2:-}"
    [[ "$image" =~ ^[a-z0-9./_-]+(:[A-Za-z0-9._-]+)?(@sha256:[a-f0-9]{64})?$ ]] || die "usage: deploy <image reference> (got '$image')"
    [ -f .env ] || die "No $DEPLOY_PATH/.env. Create it from .env.example first (docs/deploy.md, step 3)."
    [ -n "$(envval POSTGRES_PASSWORD)" ] || die "POSTGRES_PASSWORD is empty in $DEPLOY_PATH/.env."
    exec 9> "$STATE_DIR/lock"
    flock -n 9 || die "Another deploy is running."
    check_project_is_ours

    say "pulling $image"
    docker pull -q "$image"

    say "database and backups"
    dc up -d db backup
    # A dump before migrations. The backup container runs the nightly loop; this asks it for one now.
    for _ in $(seq 1 20); do dc exec -T backup true >/dev/null 2>&1 && break; sleep 2; done
    dc exec -T backup /bin/sh /backup.sh once || die "The pre-deploy backup failed; nothing was changed."

    say "migrations"
    SBC_IMAGE_NEW="$image" dc run --rm migrate || die "Migrations failed; the running site was not touched. Backup: $DEPLOY_PATH/backups"

    if [ "$ACTIVE" = blue ]; then target=green; else target=blue; fi
    switch_to "$target" "$image"
    prune_images "${image%%[:@]*}" || true
    if command -v curl >/dev/null 2>&1 && [ -n "${SITE_URL:-}" ]; then
      curl -fsS --max-time 10 -o /dev/null "$SITE_URL/api/health" && say "public address answers: $SITE_URL" \
        || say "warning: $SITE_URL/api/health did not answer from the server (check DNS and the proxy)"
    fi
    ;;

  rollback)
    exec 9> "$STATE_DIR/lock"
    flock -n 9 || die "Another deploy is running."
    [ -n "$ACTIVE" ] || die "Nothing deployed yet."
    prev="$(other "$ACTIVE")"
    image="$(image_of "$prev")"
    [ -n "$image" ] || die "No previous image to roll back to."
    docker image inspect "$image" >/dev/null 2>&1 || die "The previous image $image is no longer on this server."
    say "rolling back from web-$ACTIVE ($(image_of "$ACTIVE")) to web-$prev ($image)"
    say "note: database migrations are not undone; they only ever add, so the older code still runs"
    switch_to "$prev" "$image"
    ;;

  status)
    echo "directory:  $DEPLOY_PATH"
    echo "project:    $PROJECT"
    echo "live:       ${ACTIVE:-nothing deployed yet} (since ${DEPLOYED_AT:-n/a})"
    echo "web-blue:   $BIND:$BLUE_PORT  ${IMAGE_BLUE:-none}"
    echo "web-green:  $BIND:$GREEN_PORT  ${IMAGE_GREEN:-none}"
    [ -f "$COMPOSE_FILE_PATH" ] && dc ps || true
    ;;

  *)
    die "unknown command '$cmd' (deploy <image> | rollback | status | login <user>)"
    ;;
esac

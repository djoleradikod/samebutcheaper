#!/usr/bin/env bash
# Launch rehearsal: runs the server deploy path (docs/deploy.md) end to end on this machine, with nothing outside it.
#
#   scripts/ci/rehearse-deploy.sh standalone
#       No Docker needed. Needs `npm run build` and REHEARSAL_PG, a Postgres URL whose user may create databases
#       (for example postgres://postgres@127.0.0.1:5432/postgres). Each "image" is the standalone build started the way
#       the Dockerfile's runner stage starts it; scripts/ci/rehearsal-docker.sh stands in for `docker` and runs the
#       real processes, migrations and backups. The database is put behind scripts/ci/tcp-gate.mjs so it can be taken
#       away and given back without touching Postgres itself. This is what CI runs.
#
#   scripts/ci/rehearse-deploy.sh docker <image>
#       Needs a Docker daemon and an image built from the Dockerfile (target runner). Runs the real
#       docker-compose.deploy.yml (its own Postgres, backup service and the two web colours) under a throwaway
#       project name, and removes it at the end. The only stand-in is `docker pull`, which is a no-op for an image
#       that is already here (there is no registry to pull from).
#
# Both modes run scripts/ci/deploy-remote.sh unchanged, as the server would, and check: it refuses to run without the
# marker file or with a shared or public setting; a first deploy (backup, migrations 0000 to the last, blue live);
# a second deploy (green live, blue stopped, old image kept); rollback (blue again); a deploy whose health check never
# passes (stopped, blue keeps serving, state untouched); a backup restored into a second database serving the site;
# the database going away and coming back (what still works, what degrades, and that it recovers by itself); a
# database that hangs instead of failing; and that the in-server upkeep ran.
#
# Ports: REHEARSAL_PORTS="blue green spare gate" (default "3101 3102 3103 3104"). Exit status 1 if any check fails.
set -uo pipefail

MODE="${1:-standalone}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
read -r BLUE GREEN SPARE GATE <<< "${REHEARSAL_PORTS:-3101 3102 3103 3104}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sbc-rehearsal.XXXXXX")"
D="$WORK/srv/samebutcheaper"
PROJECT="sbcrehearsal$$"
REPO="ghcr.io/example/samebutcheaper"
A="$REPO:sha-aaaaaaa"; B="$REPO:sha-bbbbbbb"; BAD="$REPO:sha-badbad0"
ADMIN_PW="FAKE-admin-password-rehearsal"
PASS=0; FAIL=0; FAILED=()
STARTED=$(date +%s)
export REHEARSAL_WORK="$WORK"

say() { printf '\n== %s\n' "$*"; }
ok() { PASS=$((PASS + 1)); printf '  ok    %s\n' "$*"; }
bad() { FAIL=$((FAIL + 1)); FAILED+=("$*"); printf '  FAIL  %s\n' "$*"; }
check() { local name="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$name"; else bad "$name"; fi; }
code() { curl -s -o /dev/null -w '%{http_code}' --max-time "${2:-20}" "$1" || true; }
body() { curl -s --max-time "${2:-20}" "$1" || true; }
state() { sed -n "s/^$1=//p" "$D/.deploy/state" 2>/dev/null; }
up() { [ "$(code "http://127.0.0.1:$1/api/health" 5)" = 200 ]; }
down() { ! up "$1"; }
remote() { (cd "$D" && DEPLOY_PATH="$D" HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}" bash "$D/deploy-remote.sh" "$@"); }


for p in "$BLUE" "$GREEN" "$SPARE" "$GATE"; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then echo "port $p is in use; set REHEARSAL_PORTS" >&2; exit 2; fi
done

# ---------------------------------------------------------------- setup ----------------------------------------
mkdir -p "$D" "$WORK/bin" "$WORK/images" "$WORK/run" "$WORK/home"
cp "$ROOT/scripts/ci/deploy-remote.sh" "$ROOT/docker-compose.deploy.yml" "$ROOT/deploy/backup.sh" "$D/"
# Obviously fake values: nothing here is a real credential.
cat > "$D/.env" <<EOF
POSTGRES_PASSWORD=FAKE-postgres-password-rehearsal
ADMIN_PASSWORD=$ADMIN_PW
CLICK_HASH_SALT=FAKE-click-hash-salt-rehearsal-0123
POSTBACK_SECRET=FAKE-postback-secret-rehearsal-0123
MAIL_FROM=SameButCheaper <hello@rehearsal.example>
SBC_PROJECT=$PROJECT
SBC_BLUE_PORT=$BLUE
SBC_GREEN_PORT=$GREEN
EOF

if [ "$MODE" = standalone ]; then
  : "${REHEARSAL_PG:?set REHEARSAL_PG to a Postgres URL whose user may create databases}"
  [ -f "$ROOT/.next/standalone/server.js" ] || { echo "run npm run build first" >&2; exit 2; }
  PGBASE="${REHEARSAL_PG%/*}"
  PGHOSTPORT="$(node -e 'const u=new URL(process.argv[1]);console.log(u.hostname+":"+(u.port||5432))' "$REHEARSAL_PG")"
  DB="sbc_rehearsal_$$"
  psql -q "$REHEARSAL_PG" -c "create database $DB" -c "create database ${DB}_restore" >/dev/null || exit 2
  # The site reaches the database through the gate, so it can be taken away.
  export REHEARSAL_DATABASE_URL="${PGBASE/$PGHOSTPORT/127.0.0.1:$GATE}/$DB"
  DIRECT_URL="$PGBASE/$DB"
  gate() { [ -f "$WORK/gate.pid" ] && kill "$(cat "$WORK/gate.pid")" 2>/dev/null; sleep 0.3
           [ "$1" = off ] && return 0
           node "$ROOT/scripts/ci/tcp-gate.mjs" "$GATE" "$PGHOSTPORT" "$1" > "$WORK/gate.log" 2>&1 & echo $! > "$WORK/gate.pid"; sleep 0.3; }
  gate open
  # The image, as the runner stage lays it out: server.js, .next/static and public side by side; the migrator apart.
  APP="$ROOT/.next/standalone"
  mkdir -p "$APP/.next"
  rm -rf "$APP/.next/static" "$APP/public"
  cp -r "$ROOT/.next/static" "$APP/.next/static"
  cp -r "$ROOT/public" "$APP/public"
  MIG="$WORK/migrator"
  mkdir -p "$MIG/scripts" "$MIG/node_modules"
  cp -r "$ROOT/drizzle" "$MIG/drizzle"
  cp "$ROOT/scripts/migrate.mjs" "$MIG/scripts/"
  ln -s "$ROOT/node_modules/drizzle-orm" "$ROOT/node_modules/postgres" "$MIG/node_modules/"
  BADAPP="$WORK/bad-app"
  mkdir -p "$BADAPP"
  # An image that starts but never gets healthy: every request is a 500.
  cat > "$BADAPP/server.js" <<'EOF'
require("node:http").createServer((q, r) => { r.statusCode = 500; r.end("broken build"); }).listen(Number(process.env.PORT), process.env.HOSTNAME);
EOF
  image() { printf 'REF=%s\nAPP=%s\nMIGRATOR=%s\n' "$1" "$2" "$MIG" > "$WORK/images/$(printf '%s' "$1" | tr '/:@' '___')"; }
  image "$A" "$APP"
  ln -s "$ROOT/scripts/ci/rehearsal-docker.sh" "$WORK/bin/docker"
  export PATH="$WORK/bin:$PATH"
  db_off() { gate off; }
  db_on() { gate open; }
  db_hang() { gate hang; }
  sql() { psql -qtA "$DIRECT_URL" -c "$1"; }
  sql_restored() { psql -qtA "$PGBASE/${DB}_restore" -c "$1"; }
  restore_into_second() { gunzip -c "$1" | psql -q "$PGBASE/${DB}_restore" >/dev/null 2>"$WORK/restore.err"; }
  serve_restored() {
    (cd "$APP" || exit 1; env -i PATH="$PATH" HOME="$WORK/home" NODE_ENV=production PORT="$SPARE" HOSTNAME=127.0.0.1 \
      ADMIN_PASSWORD="$ADMIN_PW" DATABASE_URL="$PGBASE/${DB}_restore" node server.js > "$WORK/run/restored.log" 2>&1 & echo $! > "$WORK/run/restored.pid")
  }
  stop_restored() { kill "$(cat "$WORK/run/restored.pid")" 2>/dev/null; }
  logs_of() { cat "$WORK/run/web-$1.log"; }
  cleanup() {
    for f in "$WORK"/run/*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; done
    gate off
    sleep 1
    psql -q "$REHEARSAL_PG" -c "drop database if exists $DB" -c "drop database if exists ${DB}_restore" >/dev/null 2>&1
  }
elif [ "$MODE" = docker ]; then
  SRC="${2:?usage: rehearse-deploy.sh docker <image>}"
  REAL_DOCKER="$(command -v docker)"
  "$REAL_DOCKER" image inspect "$SRC" >/dev/null || exit 2
  "$REAL_DOCKER" tag "$SRC" "$A"
  cat > "$WORK/bin/docker" <<EOF
#!/usr/bin/env bash
# Rehearsal: no registry here, so pulling an image that is already local is a no-op. Everything else is Docker.
echo "docker \$*" >> "$WORK/docker.log"
if [ "\$1" = pull ] && "$REAL_DOCKER" image inspect "\${@: -1}" >/dev/null 2>&1; then exit 0; fi
exec "$REAL_DOCKER" "\$@"
EOF
  chmod +x "$WORK/bin/docker"
  export PATH="$WORK/bin:$PATH"
  dc() { docker compose --project-name "$PROJECT" --project-directory "$D" -f "$D/docker-compose.deploy.yml" "$@"; }
  db_off() { dc stop db >/dev/null 2>&1; }
  db_on() { dc start db >/dev/null 2>&1; for _ in $(seq 1 30); do dc exec -T db pg_isready -q -U sbc && break; sleep 1; done; }
  db_hang() { dc pause db >/dev/null 2>&1; }
  db_unhang() { dc unpause db >/dev/null 2>&1; }
  sql() { dc exec -T db psql -qtA -U sbc -d samebutcheaper -c "$1"; }
  sql_restored() { dc exec -T db psql -qtA -U sbc -d sbc_restore -c "$1"; }
  restore_into_second() {
    dc exec -T db psql -q -U sbc -d samebutcheaper -c "create database sbc_restore" >/dev/null
    gunzip -c "$1" | dc exec -T db psql -q -U sbc -d sbc_restore >/dev/null 2>"$WORK/restore.err"
  }
  serve_restored() {
    docker run -d --name "${PROJECT}-restored" --network "${PROJECT}_default" -p "127.0.0.1:$SPARE:3000" --env-file "$D/.env" \
      -e DATABASE_URL="postgres://sbc:FAKE-postgres-password-rehearsal@db:5432/sbc_restore" "$A" >/dev/null
  }
  stop_restored() { docker rm -f "${PROJECT}-restored" >/dev/null 2>&1; }
  logs_of() { dc logs --no-log-prefix "web-$1" 2>&1; }
  cleanup() {
    stop_restored
    dc --profile tools down -v --remove-orphans >/dev/null 2>&1
    "$REAL_DOCKER" image rm "$A" "$B" "$BAD" >/dev/null 2>&1
  }
else
  echo "usage: rehearse-deploy.sh standalone | docker <image>" >&2
  exit 2
fi
trap 'cleanup; rm -rf "$WORK"' EXIT
[ -n "$(type -t db_unhang)" ] || db_unhang() { db_on; }

# ------------------------------------------------------- refusals ----------------------------------------------
say "refusals (nothing may touch Docker)"
: > "$WORK/docker.log"
out="$( (cd "$D" && bash "$D/deploy-remote.sh" status) 2>&1)"; check "no DEPLOY_PATH: refused" grep -q "DEPLOY_PATH is not set" <<< "$out"
out="$(DEPLOY_PATH=/srv bash "$D/deploy-remote.sh" status 2>&1)"; check "DEPLOY_PATH=/srv: refused as shared" grep -q "shared system directory" <<< "$out"
rm "$D/.samebutcheaper-deploy" 2>/dev/null
out="$(remote deploy "$A" 2>&1)"; check "no marker file: refused" grep -q "No $D/.samebutcheaper-deploy" <<< "$out"
touch "$D/.samebutcheaper-deploy"
printf 'SBC_BIND=0.0.0.0\n' >> "$D/.env"
out="$(remote deploy "$A" 2>&1)"; check "SBC_BIND=0.0.0.0: refused" grep -q "Never 0.0.0.0" <<< "$out"
sed -i '/^SBC_BIND=/d' "$D/.env"
out="$(remote deploy 'not a valid ref!' 2>&1)"; check "malformed image reference: refused" grep -q "usage: deploy" <<< "$out"
cp "$D/.env" "$WORK/env.keep"
sed -i 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=change-me-to-a-long-random-string/' "$D/.env"
out="$(remote deploy "$A" 2>&1)"; check "the .env.example database password: refused" grep -q "still the placeholder" <<< "$out"
cp "$WORK/env.keep" "$D/.env"
check "docker was never called by a refused run" test ! -s "$WORK/docker.log"

# ------------------------------------------------------- first deploy ------------------------------------------
say "first deploy: $A"
if remote deploy "$A" > "$WORK/deploy1.log" 2>&1; then ok "deploy exits 0"; else bad "deploy exits 0"; tail -30 "$WORK/deploy1.log"; fi
check "state: blue is live" test "$(state ACTIVE)" = blue
check "blue answers on 127.0.0.1:$BLUE" up "$BLUE"
check "green is not running" down "$GREEN"
h="$(body "http://127.0.0.1:$BLUE/api/health")"; echo "  health: $h"
n="$(ls "$ROOT"/drizzle/*.sql | wc -l)"
check "every migration applied ($n/$n)" grep -q "\"migrations\":\"$n/$n\"" <<< "$h"
check "database ok" grep -q '"database":"ok"' <<< "$h"
check "a backup was taken before migrating" ls "$D"/backups/samebutcheaper-*.sql.gz
# A swap and a kit from the live sitemap, so this works from a bare checkout too (the Deploy workflow's image job).
sitemap="$(body "http://127.0.0.1:$BLUE/sitemap.xml")"
SWAP="$(grep -o '/compare/[a-z0-9-]*<' <<< "$sitemap" | head -1 | sed 's#/compare/##; s#<##')"
KIT="$(grep -o '/bundle/[a-z0-9-]*<' <<< "$sitemap" | head -1 | sed 's#/bundle/##; s#<##')"
check "the sitemap lists swaps and kits" test -n "$SWAP" -a -n "$KIT"
check "home page 200" test "$(code "http://127.0.0.1:$BLUE/")" = 200
check "swap page 200" test "$(code "http://127.0.0.1:$BLUE/compare/$SWAP")" = 200
check "German swap page 200" test "$(code "http://127.0.0.1:$BLUE/de/compare/$SWAP")" = 200
check "kit page 200" test "$(code "http://127.0.0.1:$BLUE/bundle/$KIT")" = 200
check "search 200" test "$(code "http://127.0.0.1:$BLUE/search?q=ibuprofen")" = 200
check "sitemap 200" test "$(code "http://127.0.0.1:$BLUE/sitemap.xml")" = 200
check "robots 200" test "$(code "http://127.0.0.1:$BLUE/robots.txt")" = 200
check "service worker 200" test "$(code "http://127.0.0.1:$BLUE/sw.js")" = 200
check "a static chunk 200" test "$(code "http://127.0.0.1:$BLUE$(body "http://127.0.0.1:$BLUE/" | grep -o '/_next/static/[^"]*\.js' | head -1)")" = 200
check "/admin without a password: 401" test "$(code "http://127.0.0.1:$BLUE/admin")" = 401
check "/admin with the password: 200" test "$(curl -s -o /dev/null -w '%{http_code}' -u "admin:$ADMIN_PW" "http://127.0.0.1:$BLUE/admin")" = 200
# A real visitor's click, so there is a row to back up and restore.
curl -s -o /dev/null -A "Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36" -H "X-Forwarded-For: 203.0.113.7" "http://127.0.0.1:$BLUE/go/$SWAP/alternative"
check "/go redirects (302)" test "$(code "http://127.0.0.1:$BLUE/go/$SWAP/alternative")" = 302
sleep 1
check "the click was recorded" test "$(sql 'select count(*) from clicks' | tr -d '[:space:]')" -ge 1

# ------------------------------------------------------- second deploy -----------------------------------------
say "second deploy: $B (blue/green switch)"
# A second release: the same build under a new tag. Made only now, as a pull would bring it: the first deploy prunes
# every other image of the repository.
if [ "$MODE" = docker ]; then printf 'FROM %s\nLABEL rehearsal=b\n' "$A" | docker build -q -t "$B" - >/dev/null; else image "$B" "$APP"; fi
if remote deploy "$B" > "$WORK/deploy2.log" 2>&1; then ok "deploy exits 0"; else bad "deploy exits 0"; tail -30 "$WORK/deploy2.log"; fi
check "state: green is live" test "$(state ACTIVE)" = green
check "green answers on $GREEN" up "$GREEN"
check "blue was stopped" down "$BLUE"
check "the previous image is kept for rollback" docker image inspect "$A"
check "migrations ran again and found nothing to do" grep -q "migrations" "$WORK/deploy2.log"

# ------------------------------------------------------- rollback ----------------------------------------------
say "rollback"
if remote rollback > "$WORK/rollback.log" 2>&1; then ok "rollback exits 0"; else bad "rollback exits 0"; tail -30 "$WORK/rollback.log"; fi
check "state: blue is live again" test "$(state ACTIVE)" = blue
check "blue answers" up "$BLUE"
check "green was stopped" down "$GREEN"
check "state still remembers both images" test "$(state IMAGE_BLUE)|$(state IMAGE_GREEN)" = "$A|$B"

# ------------------------------------------------------- a deploy that never gets healthy ----------------------
say "a deploy whose health check never passes: $BAD"
if [ "$MODE" = standalone ]; then
  image "$BAD" "$BADAPP"
else
  printf 'FROM %s\nCMD ["node","-e","require(\\"http\\").createServer((q,r)=>{r.statusCode=500;r.end()}).listen(3000)"]\n' "$A" \
    | docker build -q -t "$BAD" - >/dev/null
fi
if HEALTH_TIMEOUT=10 remote deploy "$BAD" > "$WORK/deploy-bad.log" 2>&1; then bad "deploy fails"; else ok "deploy fails"; fi
check "it says why" grep -q "did not become healthy" "$WORK/deploy-bad.log"
check "state: blue is still live" test "$(state ACTIVE)" = blue
check "state still names the good image for green" test "$(state IMAGE_GREEN)" = "$B"
check "blue kept serving throughout" up "$BLUE"
check "the broken colour was stopped" down "$GREEN"
check "rollback target is still the good image" grep -q "$B" <<< "$(remote status 2>&1)"

# ------------------------------------------------------- the server's own check ---------------------------------
say "deploy-remote.sh check"
chmod 600 "$D/.env"
remote check > "$WORK/check.log" 2>&1
sed 's/^/  | /' "$WORK/check.log"
check "it finds the .env private" grep -q "PASS  .env readable by its owner only" "$WORK/check.log"
check "it finds today's backup" grep -q "PASS  newest backup" "$WORK/check.log"
check "it finds blue healthy" grep -q "PASS  web-blue healthy" "$WORK/check.log"
check "it finds the memory ceiling" grep -q "PASS  web-blue memory ceiling" "$WORK/check.log"
chmod 644 "$D/.env"
check "it flags a world-readable .env" grep -q "FAIL  .env has mode 644" <<< "$(remote check 2>&1)"
chmod 600 "$D/.env"

# ------------------------------------------------------- backup and restore ------------------------------------
say "backup and restore into a second database"
docker compose --project-name "$PROJECT" --project-directory "$D" -f "$D/docker-compose.deploy.yml" exec -T backup /bin/sh /backup.sh once > "$WORK/backup.log" 2>&1
latest="$(ls -t "$D"/backups/samebutcheaper-*.sql.gz 2>/dev/null | head -1)"
check "backup.sh once wrote a file" test -s "$latest"
check "it is valid gzip" gzip -t "$latest"
if restore_into_second "$latest"; then ok "restore into a second database"; else bad "restore into a second database"; cat "$WORK/restore.err"; fi
serve_restored
for _ in $(seq 1 60); do up "$SPARE" && break; sleep 1; done
h="$(body "http://127.0.0.1:$SPARE/api/health")"; echo "  restored: $h"
check "the site runs on the restored database" grep -q '"database":"ok"' <<< "$h"
check "with every migration" grep -q "\"migrations\":\"$n/$n\"" <<< "$h"
check "the restored database holds the clicks" test "$(sql_restored 'select count(*) from clicks' | tr -d '[:space:]')" -ge 1
check "and its admin page renders" test "$(curl -s -o /dev/null -w '%{http_code}' -u "admin:$ADMIN_PW" "http://127.0.0.1:$SPARE/admin")" = 200
stop_restored

# ------------------------------------------------------- database outage ---------------------------------------
say "the database goes away"
db_off
sleep 2
report() {
  local label="$1" port="$2" t0 c ms
  printf '  %-34s' "$label"
  for path in / "/compare/$SWAP" "/de/compare/$SWAP" "/bundle/$KIT" "/search?q=ibuprofen" "/go/$SWAP/alternative" /api/health "/api/health?ready=1"; do
    t0=$(date +%s%N); c="$(code "http://127.0.0.1:$port$path" 30)"; ms=$(( ($(date +%s%N) - t0) / 1000000 ))
    printf ' %s:%s(%sms)' "$path" "$c" "$ms" | sed "s#/compare/$SWAP#/compare/x#; s#/bundle/$KIT#/bundle/x#; s#/go/$SWAP/alternative#/go#"
  done
  echo
}
report "database down" "$BLUE"
check "home still 200" test "$(code "http://127.0.0.1:$BLUE/")" = 200
check "swap page still 200" test "$(code "http://127.0.0.1:$BLUE/compare/$SWAP")" = 200
check "German swap page still 200" test "$(code "http://127.0.0.1:$BLUE/de/compare/$SWAP")" = 200
check "kit page still 200" test "$(code "http://127.0.0.1:$BLUE/bundle/$KIT")" = 200
check "search still 200" test "$(code "http://127.0.0.1:$BLUE/search?q=ibuprofen")" = 200
check "/go still redirects" test "$(code "http://127.0.0.1:$BLUE/go/$SWAP/alternative")" = 302
check "/api/health 200 and says the database is down" grep -q '"database":"down"' <<< "$(body "http://127.0.0.1:$BLUE/api/health")"
check "/api/health?ready=1 says 503" test "$(code "http://127.0.0.1:$BLUE/api/health?ready=1")" = 503
check "/admin still answers (200)" test "$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -u "admin:$ADMIN_PW" "http://127.0.0.1:$BLUE/admin")" = 200
if [ "$MODE" = standalone ]; then
  # With Docker, a deploy starts the database container again first (`up -d db backup`), so this is standalone only.
  check "a deploy stops before changing anything without a database" bash -c "! (cd '$D' && HEALTH_TIMEOUT=5 DEPLOY_PATH='$D' bash '$D/deploy-remote.sh' deploy '$B' >/dev/null 2>&1)"
  check "and blue is still live" test "$(state ACTIVE)" = blue
fi

say "the database comes back"
db_on
for _ in $(seq 1 30); do grep -q '"database":"ok"' <<< "$(body "http://127.0.0.1:$BLUE/api/health")" && break; sleep 1; done
check "health recovers by itself, without a restart" grep -q '"database":"ok"' <<< "$(body "http://127.0.0.1:$BLUE/api/health")"
before="$(sql 'select count(*) from clicks' | tr -d '[:space:]')"
curl -s -o /dev/null -A "Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36" -H "X-Forwarded-For: 203.0.113.8" "http://127.0.0.1:$BLUE/go/$SWAP/brand"
sleep 1
check "clicks are recorded again" test "$(sql 'select count(*) from clicks' | tr -d '[:space:]')" -gt "$before"

say "the database hangs (accepts, never answers)"
db_hang
sleep 1
report "database hanging" "$BLUE"
check "home 200 within 10 s" test "$(code "http://127.0.0.1:$BLUE/" 10)" = 200
check "swap page 200 within 10 s" test "$(code "http://127.0.0.1:$BLUE/compare/$SWAP" 10)" = 200
check "/go redirects within 10 s" test "$(code "http://127.0.0.1:$BLUE/go/$SWAP/alternative" 10)" = 302
check "/api/health answers within 5 s" test "$(code "http://127.0.0.1:$BLUE/api/health" 5)" = 200
# A visitor's write gives up after a few seconds (src/db/timed.ts) and says so, instead of spinning until TCP gives up.
check "a form's write gives up within 10 s (503)" test "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST -d t=rehearsal-token-0123456789abcdef "http://127.0.0.1:$BLUE/api/newsletter/confirm" || true)" = 503
db_unhang
for _ in $(seq 1 40); do grep -q '"database":"ok"' <<< "$(body "http://127.0.0.1:$BLUE/api/health")" && break; sleep 1; done
check "recovers after the hang" grep -q '"database":"ok"' <<< "$(body "http://127.0.0.1:$BLUE/api/health")"

# ------------------------------------------------------- upkeep -------------------------------------------------
say "in-server upkeep (first run a minute after start)"
for _ in $(seq 1 45); do { logs_of blue; logs_of green; } | grep -q '"event":"maintenance\.' && break; sleep 2; done
check "the upkeep timer ran (maintenance.done in the log)" grep -q '"event":"maintenance.done"' <<< "$(logs_of blue; logs_of green)"
check "the server said what is configured at start (startup.readiness)" grep -q 'startup.readiness' <<< "$(logs_of blue)"
check "no secret in the logs" bash -c "! grep -qE 'FAKE-(admin|postgres|click|postback)' <<< \"\$(cat)\"" <<< "$(logs_of blue; logs_of green)"

say "done in $(( $(date +%s) - STARTED )) s: $PASS passed, $FAIL failed"
for f in "${FAILED[@]}"; do echo "  failed: $f"; done
[ "$FAIL" -eq 0 ]

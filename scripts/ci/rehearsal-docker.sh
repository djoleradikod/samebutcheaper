#!/usr/bin/env bash
# A stand-in for `docker` that scripts/ci/rehearse-deploy.sh (standalone mode) puts on PATH, so deploy-remote.sh runs
# unchanged against real processes where there is no Docker daemon (CI, or a container without one):
#
#   docker compose ... up -d --no-deps web-blue   starts the image's `node server.js` on SBC_BLUE_PORT, with .env and
#                                                 the environment the Dockerfile's runner stage sets
#   docker compose ... stop -t 30 web-blue        SIGTERM, then waits up to 30 s, as Docker does
#   docker compose ... ps --status running -q X   an id while that process is alive
#   docker compose ... run --rm migrate           the image's migrator (node migrator/scripts/migrate.mjs), for real
#   docker compose ... exec -T backup ... once    deploy/backup.sh, for real (pg_dump into DEPLOY_PATH/backups)
#   docker compose ... up -d db backup            nothing: the database is REHEARSAL_DATABASE_URL
#   docker pull / image inspect / image ls / rm   against the "images" in $REHEARSAL_WORK/images (one file each)
#
# Every call is appended to $REHEARSAL_WORK/docker.log. An "image" is a file holding APP=<dir with server.js> and
# MIGRATOR=<dir with scripts/migrate.mjs>.
set -uo pipefail
W="${REHEARSAL_WORK:?REHEARSAL_WORK is not set}"
echo "docker $*" >> "$W/docker.log"
img_file() { printf '%s/images/%s' "$W" "$(printf '%s' "$1" | tr '/:@' '___')"; }
img_id() { printf 'sha256:%s' "$(printf '%s' "$1" | sha256sum | cut -c1-64)"; }
pid_of() { local f="$W/run/$1.pid"; [ -f "$f" ] && kill -0 "$(cat "$f")" 2>/dev/null && cat "$f"; }

compose() {
  # --project-name P --project-directory D -f F <sub> ...
  local dir="" sub
  while [ $# -gt 0 ]; do
    case "$1" in
      --project-name|-f) shift 2 ;;
      --project-directory) dir="$2"; shift 2 ;;
      *) break ;;
    esac
  done
  sub="$1"; shift
  local svc="${*: -1}"
  case "$sub" in
    up)
      case "$svc" in
        web-blue|web-green)
          local colour="${svc#web-}" image port
          if [ "$colour" = blue ]; then image="$SBC_IMAGE_BLUE"; port="$SBC_BLUE_PORT"; else image="$SBC_IMAGE_GREEN"; port="$SBC_GREEN_PORT"; fi
          local f; f="$(img_file "$image")"
          [ -f "$f" ] || { echo "No such image: $image" >&2; return 1; }
          # A container with the same image that is running stays as it is; a changed image is recreated.
          if [ -n "$(pid_of "$svc")" ]; then
            [ "$(cat "$W/run/$svc.image")" = "$image" ] && return 0
            stop_svc "$svc" 30
          fi
          # shellcheck disable=SC1090
          local APP MIGRATOR; . "$f"
          mkdir -p "$W/run"
          # The runner stage's ENV, then env_file .env, then compose's DATABASE_URL, as Docker applies them.
          local envs=() line
          while IFS= read -r line; do
            [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
            line="${line%$'\r'}"
            [[ "$line" =~ ^([^=]*)=[\"\'](.*)[\"\']$ ]] && line="${BASH_REMATCH[1]}=${BASH_REMATCH[2]}"
            envs+=("$line")
          done < "$dir/.env"
          # 9>&-: a container doesn't inherit deploy-remote.sh's lock (fd 9), so the server mustn't either.
          (
            cd "$APP" || exit 1
            env -i PATH="$PATH" HOME="$W/home" NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 SOURCE_COMMIT="$image" \
              "${envs[@]}" PORT="$port" HOSTNAME="$SBC_BIND" DATABASE_URL="$REHEARSAL_DATABASE_URL" \
              node server.js >> "$W/run/$svc.log" 2>&1 9>&- &
            echo $! > "$W/run/$svc.pid"
          )
          echo "$image" > "$W/run/$svc.image"
          ;;
        *) ;;
      esac
      ;;
    stop)
      local t=10
      [ "${1:-}" = -t ] && t="$2"
      stop_svc "$svc" "$t"
      ;;
    ps)
      case "$svc" in
        web-blue|web-green) local p; p="$(pid_of "$svc")"; [ -n "$p" ] && echo "pid-$p" ;;
        *) for s in web-blue web-green; do p="$(pid_of "$s")"; [ -n "$p" ] && echo "$s running ($(cat "$W/run/$s.image"))"; done ;;
      esac
      return 0
      ;;
    run)
      local f; f="$(img_file "${SBC_IMAGE_NEW:-}")"
      [ -f "$f" ] || { echo "No such image: ${SBC_IMAGE_NEW:-}" >&2; return 1; }
      local APP MIGRATOR; . "$f"
      DATABASE_URL="$REHEARSAL_DATABASE_URL" node "$MIGRATOR/scripts/migrate.mjs"
      ;;
    exec)
      # exec -T backup true | exec -T backup /bin/sh /backup.sh once
      [ "${*: -1}" = true ] && return 0
      DATABASE_URL="$REHEARSAL_DATABASE_URL" BACKUP_DIR="$dir/backups" sh "$dir/backup.sh" once
      ;;
    logs) tail -n 80 "$W/run/$svc.log" 2>/dev/null || true ;;
    *) ;;
  esac
}

stop_svc() {
  local svc="$1" t="$2" p i
  p="$(pid_of "$svc")"
  [ -n "$p" ] || return 0
  kill -TERM "$p" 2>/dev/null
  for i in $(seq 1 $((t * 5))); do kill -0 "$p" 2>/dev/null || break; sleep 0.2; done
  kill -0 "$p" 2>/dev/null && kill -KILL "$p" 2>/dev/null
  rm -f "$W/run/$svc.pid"
}

case "${1:-}" in
  compose) shift; compose "$@" ;;
  pull) [ -f "$(img_file "${*: -1}")" ] || { echo "manifest unknown: ${*: -1}" >&2; exit 1; } ;;
  image)
    case "${2:-}" in
      inspect) [ -f "$(img_file "${*: -1}")" ] && img_id "${*: -1}" ;;
      ls)
        local_repo="${*: -1}"
        for f in "$W"/images/*; do
          [ -f "$f" ] || continue
          ref="$(sed -n 's/^REF=//p' "$f")"
          [ "${ref%%[:@]*}" = "$local_repo" ] && img_id "$ref"
        done
        ;;
      rm) for f in "$W"/images/*; do [ "$(img_id "$(sed -n 's/^REF=//p' "$f")")" = "${*: -1}" ] && rm -f "$f"; done ;;
    esac
    ;;
  info) echo "$W" ;;
  inspect) echo $((768 * 1024 * 1024)) ;;
  ps|login|logout) ;;
  *) echo "rehearsal docker: unsupported: $*" >&2; exit 1 ;;
esac

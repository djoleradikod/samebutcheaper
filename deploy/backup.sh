#!/bin/sh
# Nightly database backup, run by the `backup` service in docker-compose.yml.
# Writes /backups/samebutcheaper-YYYY-MM-DD.sql.gz and keeps the newest BACKUP_KEEP_DAYS (14).
# Restore:  gunzip -c backups/samebutcheaper-2026-11-10.sql.gz | docker compose exec -T db psql -U sbc -d samebutcheaper
set -eu

KEEP="${BACKUP_KEEP_DAYS:-14}"
DIR=/backups
mkdir -p "$DIR"

backup() {
  name="samebutcheaper-$(date -u +%F).sql.gz"
  tmp="$DIR/.$name.part"
  # --clean --if-exists makes the file restorable over an existing database.
  if pg_dump --clean --if-exists --no-owner "$DATABASE_URL" | gzip -9 > "$tmp" && [ -s "$tmp" ] && gzip -t "$tmp"; then
    mv "$tmp" "$DIR/$name"
    echo "$(date -u +%FT%TZ) backup written: $name ($(du -h "$DIR/$name" | cut -f1))"
  else
    rm -f "$tmp"
    echo "$(date -u +%FT%TZ) backup FAILED" >&2
    return 1
  fi
  # Remove backups older than KEEP days, never the one just written.
  find "$DIR" -name 'samebutcheaper-*.sql.gz' -mtime "+$KEEP" ! -name "$name" -delete
}

if [ "${1:-}" = "once" ]; then
  backup
  exit $?
fi

# One now if today's is missing, then one every day at about 03:15 UTC.
[ -f "$DIR/samebutcheaper-$(date -u +%F).sql.gz" ] || backup || true
while true; do
  now=$(date -u +%s)
  next=$(( (now / 86400) * 86400 + 3 * 3600 + 15 * 60 ))
  [ "$next" -le "$now" ] && next=$(( next + 86400 ))
  sleep $(( next - now ))
  backup || true
done

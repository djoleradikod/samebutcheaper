#!/usr/bin/env bash
# Build this checkout and swap the result into the folder ~/ops/sbc-push-20261106/serve-preview.sh serves on :8851.
# Run from a checkout at origin/main, so the preview keeps showing main: capped --mem 4G --name sbc-build -- bash scripts/qa/build-preview.sh
set -Eeuo pipefail
QA=/mnt/fast-storage/samebutcheaper-qa
export NEXT_PUBLIC_SITE_URL=http://192.168.0.62:8851
npm run catalog
npx next typegen
npm run typecheck
npm run lint
npm run build
rm -rf "$QA/preview/new"
mkdir -p "$QA/preview/new/.next"
cp -a .next/standalone/. "$QA/preview/new/"
cp -a .next/static "$QA/preview/new/.next/static"
[ -d public ] && cp -a public "$QA/preview/new/public"
rm -rf "$QA/preview/old"
[ -d "$QA/preview/current" ] && mv "$QA/preview/current" "$QA/preview/old"
mv "$QA/preview/new" "$QA/preview/current"
rm -rf "$QA/preview/old"
git rev-parse --short HEAD > "$QA/preview/current/COMMIT"
touch "$QA/preview/reload"
echo "preview built from $(cat "$QA/preview/current/COMMIT")"

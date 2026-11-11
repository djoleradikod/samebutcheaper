#!/usr/bin/env bash
# The pre-push check from CLAUDE.md plus the tests. Prints each step's exit code, and the end of the log for any that fails.
# Usage, from the repo root: bash scripts/qa/gate.sh [log dir]
logs=${1:-${TMPDIR:-/tmp}/sbc-gate}
mkdir -p "$logs"
fail=0
step() {
  name=$1
  shift
  "$@" > "$logs/$name.log" 2>&1
  code=$?
  echo "$name exit $code"
  if [ "$code" -ne 0 ]; then
    fail=1
    tail -25 "$logs/$name.log"
  fi
}
step catalog npm run catalog
step typegen npx next typegen
step typecheck npm run typecheck
step lint npm run lint
step tests npm test
step build npm run build
# Needs TEST_DATABASE_URL (a database that may be wiped); skipped without it.
step e2e npm run test:e2e
echo "gate finished, fail=$fail"
exit "$fail"

/**
 * scripts/ci/deploy-remote.sh against stand-ins for docker, curl and ss: what it refuses, the order it works in,
 * and how blue and green take turns. No Docker needed:  npx tsx --test scripts/tests/deploy-remote.test.ts
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const script = join(import.meta.dirname, "..", "ci", "deploy-remote.sh");
const work = mkdtempSync(join(tmpdir(), "sbc-deploy-test-"));
after(() => rmSync(work, { recursive: true, force: true }));

const shims = join(work, "bin");
mkdirSync(shims);
// docker: logs each call; remembers which colours run in $SHIM_STATE/running.
writeFileSync(
  join(shims, "docker"),
  `#!/usr/bin/env bash
echo "docker $*" >> "$SHIM_LOG"
run="$SHIM_STATE/running"; touch "$run"
if [ "$1" = compose ]; then
  shift 7
  sub="$1"; shift
  case "$sub" in
    up) svc="\${@: -1}"; case "$svc" in web-*) echo "up $svc blue=$SBC_IMAGE_BLUE green=$SBC_IMAGE_GREEN" >> "$SHIM_LOG"; grep -qx "$svc" "$run" || echo "$svc" >> "$run";; esac ;;
    stop) svc="\${@: -1}"; grep -vx "$svc" "$run" > "$run.n" || true; mv "$run.n" "$run" ;;
    ps) svc="\${@: -1}"; grep -qx "$svc" "$run" && echo "id-$svc" || true ;;
    run) echo "migrate with $SBC_IMAGE_NEW" >> "$SHIM_LOG"; [ -z "$FAIL_MIGRATE" ] || exit 1 ;;
    *) ;;
  esac
  exit 0
fi
case "$1" in
  pull) [ -z "$FAIL_PULL" ] || exit 1 ;;
  image) [ "$2" = inspect ] && { [ -z "$NO_LOCAL_IMAGE" ] || exit 1; echo "sha256:$(printf '%s' "\${@: -1}" | cksum | cut -d' ' -f1)"; } ;;
  ps) ;;
esac
exit 0
`,
);
// curl: /api/health answers $HEALTH_BODY; anything else succeeds.
writeFileSync(
  join(shims, "curl"),
  `#!/usr/bin/env bash
for a in "$@"; do case "$a" in *"/api/health?ready=1") [ -z "$NOT_READY" ]; exit $?;; *"/api/health") printf '%s' "$HEALTH_BODY"; exit 0;; esac; done
exit 0
`,
);
writeFileSync(join(shims, "ss"), "#!/usr/bin/env bash\nprintf '%s\\n' \"$SS_OUTPUT\"\n");
for (const f of ["docker", "curl", "ss"]) chmodSync(join(shims, f), 0o755);

const HEALTHY = '{"status":"ok","pairs":458,"database":"ok","migrations":"11/11","ready":false,"blockers":["affiliate"]}';

let n = 0;
/** A fresh site directory with the marker and an .env, unless told otherwise. */
function site(opts: { marker?: boolean; env?: string } = {}) {
  const dir = join(work, `site${++n}`);
  mkdirSync(dir);
  if (opts.marker !== false) writeFileSync(join(dir, ".samebutcheaper-deploy"), "");
  writeFileSync(join(dir, ".env"), opts.env ?? "POSTGRES_PASSWORD=secret\n");
  writeFileSync(join(dir, "docker-compose.deploy.yml"), "services: {}\n");
  const state = join(work, `state${n}`);
  mkdirSync(state);
  return { dir, state, log: join(state, "log") };
}

function run(s: { dir: string; state: string; log: string } | null, args: string[], env: Record<string, string | undefined> = {}) {
  const r = spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    env: {
      NODE_ENV: "test",
      PATH: `${shims}:${process.env.PATH}`,
      HOME: work,
      HEALTH_BODY: HEALTHY,
      HEALTH_TIMEOUT: "1",
      SHIM_LOG: s?.log ?? join(work, "nolog"),
      SHIM_STATE: s?.state ?? work,
      DEPLOY_PATH: s?.dir,
      ...env,
    },
  });
  return { code: r.status, out: r.stdout + r.stderr, log: s && existsSync(s.log) ? readFileSync(s.log, "utf8") : "" };
}

const stateOf = (dir: string) => readFileSync(join(dir, ".deploy", "state"), "utf8");
const IMG1 = "ghcr.io/owner/samebutcheaper:sha-111111111111";
const IMG2 = "ghcr.io/owner/samebutcheaper:sha-222222222222";

test("refuses without DEPLOY_PATH, outside a directory of its own, or without the marker", () => {
  let r = run(null, ["status"], { DEPLOY_PATH: undefined });
  assert.equal(r.code, 1);
  assert.match(r.out, /DEPLOY_PATH is not set/);
  for (const bad of ["/", "/opt", "/srv/", "/home", "/home/deploy", "/var/lib/docker/volumes", "relative/path", "/srv/a b", "/srv/../etc"]) {
    r = run(null, ["status"], { DEPLOY_PATH: bad });
    assert.equal(r.code, 1, bad);
  }
  const s = site({ marker: false });
  r = run(s, ["deploy", IMG1]);
  assert.equal(r.code, 1);
  assert.match(r.out, /\.samebutcheaper-deploy/);
  assert.equal(r.log, "", "nothing was run");
});

test("refuses a deploy without an .env database password or with a bad image reference", () => {
  const s = site({ env: "ADMIN_PASSWORD=x\n" });
  assert.match(run(s, ["deploy", IMG1]).out, /POSTGRES_PASSWORD is empty/);
  const t = site();
  assert.equal(run(t, ["deploy", "ghcr.io/x/y:tag; rm -rf /"]).code, 1);
  assert.equal(run(t, ["deploy"]).code, 1);
  // Never on every address: Docker's published ports skip the firewall.
  for (const bind of ["0.0.0.0", "203.0.113.5", "::"]) {
    const u = site({ env: `POSTGRES_PASSWORD=x\nSBC_BIND=${bind}\n` });
    const r = run(u, ["deploy", IMG1]);
    assert.equal(r.code, 1, bind);
    assert.match(r.out, /SBC_BIND must be/);
    assert.equal(r.log, "");
  }
  const v = site({ env: "POSTGRES_PASSWORD=x\nSBC_BIND=172.17.0.1\n" });
  const ok = run(v, ["deploy", IMG1]);
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /live: web-blue on 172\.17\.0\.1:3101/);
});

test("deploys blue, then green, keeps the previous image, and rolls back", () => {
  const s = site();
  let r = run(s, ["deploy", IMG1]);
  assert.equal(r.code, 0, r.out);
  // Order: pull, database, backup, migrations with the new image, then the new colour.
  const order = ["docker pull -q " + IMG1, "up -d db backup", "/backup.sh once", "migrate with " + IMG1, "up web-blue blue=" + IMG1];
  let at = -1;
  for (const step of order) {
    const i = r.log.indexOf(step);
    assert.ok(i > at, `${step} after the step before it\n${r.log}`);
    at = i;
  }
  assert.match(stateOf(s.dir), /ACTIVE=blue/);
  assert.doesNotMatch(r.log, /compose .* (down|restart)|system prune|systemctl|service /);
  // Every compose call is pinned to this project and this directory.
  for (const line of r.log.split("\n").filter((l) => l.startsWith("docker compose"))) {
    assert.ok(line.startsWith(`docker compose --project-name samebutcheaper --project-directory ${s.dir} -f ${s.dir}/docker-compose.deploy.yml`), line);
  }

  r = run(s, ["deploy", IMG2]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.log, new RegExp(`up web-green blue=${IMG1} green=${IMG2}`));
  assert.match(r.log, /stop -t 30 web-blue/);
  assert.match(stateOf(s.dir), new RegExp(`ACTIVE=green\nIMAGE_BLUE=${IMG1}\nIMAGE_GREEN=${IMG2}`));

  r = run(s, ["rollback"]);
  assert.equal(r.code, 0, r.out);
  assert.match(stateOf(s.dir), /ACTIVE=blue/);
  assert.match(r.log, /stop -t 30 web-green/);
  assert.equal(r.log.match(/migrate with/g)?.length, 2, "a rollback runs no migrations");
  assert.equal(r.log.match(/docker pull/g)?.length, 2, "a rollback pulls nothing");
  assert.match(run(s, ["status"]).out, /live:\s+blue/);
});

test("a new colour that never gets healthy is stopped and the old one keeps serving", () => {
  const s = site();
  assert.equal(run(s, ["deploy", IMG1]).code, 0);
  const r = run(s, ["deploy", IMG2], { HEALTH_BODY: '{"status":"ok","database":"down","migrations":null}' });
  assert.equal(r.code, 1);
  assert.match(r.out, /web-green did not become healthy/);
  assert.match(r.log, /stop -t 30 web-green/);
  assert.doesNotMatch(r.log, /stop -t 30 web-blue/);
  assert.match(stateOf(s.dir), /ACTIVE=blue/);
});

test("health: migrations must all be applied; more than expected (after a rollback) is fine", () => {
  const s = site();
  assert.equal(run(s, ["deploy", IMG1], { HEALTH_BODY: HEALTHY.replace("11/11", "10/11") }).code, 1);
  const t = site();
  assert.equal(run(t, ["deploy", IMG1], { HEALTH_BODY: HEALTHY.replace("11/11", "12/11") }).code, 0);
  const u = site({ env: "POSTGRES_PASSWORD=x\nDEPLOY_REQUIRE_READY=1\n" });
  assert.equal(run(u, ["deploy", IMG1], { NOT_READY: "1" }).code, 1);
});

test("a pull that fails uses the image already on the server, and stops when there is none", () => {
  const s = site();
  let r = run(s, ["deploy", IMG1], { FAIL_PULL: "1" });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /using the copy already on this server/);
  const t = site();
  r = run(t, ["deploy", IMG1], { FAIL_PULL: "1", NO_LOCAL_IMAGE: "1" });
  assert.equal(r.code, 1);
  assert.match(r.out, /not on this server/);
  assert.doesNotMatch(r.log, /up -d db/);
});

test("refuses the .env.example database password", () => {
  const s = site({ env: "POSTGRES_PASSWORD=change-me-to-a-long-random-string\n" });
  const r = run(s, ["deploy", IMG1]);
  assert.equal(r.code, 1);
  assert.match(r.out, /still the placeholder/);
  assert.equal(r.log, "");
});

test("stops before touching the site when migrations fail or a port is taken", () => {
  const s = site();
  let r = run(s, ["deploy", IMG1], { FAIL_MIGRATE: "1" });
  assert.equal(r.code, 1);
  assert.match(r.out, /Migrations failed/);
  assert.doesNotMatch(r.log, /up web-/);
  const t = site({ env: "POSTGRES_PASSWORD=x\nSBC_BLUE_PORT=8080\n" });
  r = run(t, ["deploy", IMG1], { SS_OUTPUT: "LISTEN 0 4096 127.0.0.1:8080 0.0.0.0:*" });
  assert.equal(r.code, 1);
  assert.match(r.out, /Port 8080 is already in use/);
  assert.doesNotMatch(r.log, /up web-/);
});

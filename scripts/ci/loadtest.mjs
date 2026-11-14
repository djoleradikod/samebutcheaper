#!/usr/bin/env node
/**
 * A small, repeatable load test for a running build (no dependencies). For each page it keeps a fixed number of
 * connections busy for a fixed time and reports requests per second, latency percentiles, the HTML's size raw and
 * gzipped, and, when it can read the server's process (--pid, same machine, Linux), the server's CPU time per request.
 *
 *   node scripts/ci/loadtest.mjs --url http://127.0.0.1:3000 [--pid 1234] [--connections 20] [--seconds 10]
 *        [--runs 3] [--only home,swap-us] [--encoding gzip] [--json out.json]
 *
 * Every number depends on the machine and what else runs on it: compare runs on the same machine, and use --runs to see
 * the spread. This is a report, never a gate (see docs/deploy.md, "Load test").
 */
import http from "node:http";
import https from "node:https";
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync, brotliCompressSync, constants as zlib } from "node:zlib";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]);
    return acc;
  }, []),
);
const BASE = (args.url ?? process.env.LOADTEST_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const CONNECTIONS = Number(args.connections ?? 20);
const SECONDS = Number(args.seconds ?? 10);
const RUNS = Number(args.runs ?? 1);
const PID = args.pid ? Number(args.pid) : null;

/** One of each kind of page. The slugs are real catalogue entries; a 404 here is reported, not hidden. */
const PAGES = [
  { name: "home", path: "/" },
  { name: "home-de", path: "/de" },
  { name: "swap-us", path: "/compare/tylenol-extra-strength-vs-equate-acetaminophen-500mg" },
  { name: "swap-us-pfx", path: "/us/compare/tylenol-extra-strength-vs-equate-acetaminophen-500mg" },
  { name: "swap-de", path: "/de/compare/aspirin-vs-ass-500-1a-pharma-de" },
  { name: "kit", path: "/bundle/advil-20ct-300ct-value-bundle-vs-up-and-up-ibuprofen-200mg" },
  // A hub: its whole list renders per request, for the shopper's country.
  { name: "hub", path: "/dupe/zyrtec-cetirizine-dihydrochloride" },
  { name: "search", path: "/search" },
  { name: "search-index", path: "/search/index.json" },
  { name: "go", path: "/go/tylenol-extra-strength-vs-equate-acetaminophen-500mg/alternative", expect: [302, 303, 307, 308] },
  { name: "health", path: "/api/health" },
];

const only = args.only ? new Set(String(args.only).split(",")) : null;
const pages = PAGES.filter((p) => !only || only.has(p.name));

const client = BASE.startsWith("https:") ? https : http;
// A shopper with a country: unprefixed pages render their per-country parts for the US, as a returning visitor's would.
// --encoding gzip asks for what a browser gets when the server compresses (Next does unless `compress: false`).
const HEADERS = { "user-agent": "sbc-loadtest", cookie: "sbc_country=US", "accept-encoding": args.encoding ?? "identity" };

function get(agent, path) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const req = client.get(`${BASE}${path}`, { agent, headers: HEADERS }, (res) => {
      let bytes = 0;
      res.on("data", (c) => (bytes += c.length));
      res.on("end", () => resolve({ status: res.statusCode, ms: Number(process.hrtime.bigint() - start) / 1e6, bytes }));
    });
    req.on("error", () => resolve({ status: 0, ms: Number(process.hrtime.bigint() - start) / 1e6, bytes: 0 }));
  });
}

function cpuMs(pid) {
  if (!pid) return null;
  try {
    // utime and stime, in clock ticks (100 per second on Linux), of the server and its finished children.
    const f = readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ");
    return (Number(f[11]) + Number(f[12]) + Number(f[13]) + Number(f[14])) * 10;
  } catch {
    return null;
  }
}

function rssMb(pid) {
  if (!pid) return null;
  try {
    const m = /VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, "utf8"));
    return m ? Math.round(Number(m[1]) / 1024) : null;
  } catch {
    return null;
  }
}

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : NaN);

async function sizes(path) {
  const body = await new Promise((resolve) => {
    client.get(`${BASE}${path}`, { headers: { ...HEADERS, "accept-encoding": "identity" } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", () => resolve(Buffer.alloc(0)));
  });
  return {
    raw: body.length,
    gzip: gzipSync(body, { level: 6 }).length,
    brotli: brotliCompressSync(body, { params: { [zlib.BROTLI_PARAM_QUALITY]: 5 } }).length,
  };
}

async function run(page) {
  const agent = new client.Agent({ keepAlive: true, maxSockets: CONNECTIONS });
  // Warm up: the first request of a page fills caches a long-running server already has.
  for (let i = 0; i < 3; i++) await get(agent, page.path);
  const latencies = [];
  const statuses = {};
  const cpu0 = cpuMs(PID);
  const end = Date.now() + SECONDS * 1000;
  const t0 = process.hrtime.bigint();
  await Promise.all(
    Array.from({ length: CONNECTIONS }, async () => {
      while (Date.now() < end) {
        const r = await get(agent, page.path);
        latencies.push(r.ms);
        statuses[r.status] = (statuses[r.status] ?? 0) + 1;
      }
    }),
  );
  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;
  const cpu1 = cpuMs(PID);
  agent.destroy();
  latencies.sort((a, b) => a - b);
  const n = latencies.length;
  return {
    reqPerSec: n / elapsed,
    p50: pct(latencies, 50),
    p95: pct(latencies, 95),
    p99: pct(latencies, 99),
    cpuMsPerReq: cpu0 !== null && cpu1 !== null ? (cpu1 - cpu0) / n : null,
    statuses,
    rssMb: rssMb(PID),
  };
}

const fmt = (n, d = 0) => (n === null || Number.isNaN(n) ? "-" : n.toFixed(d));
const results = [];
console.log(`Load test ${BASE}: ${CONNECTIONS} connections, ${SECONDS}s per page, ${RUNS} run(s)${PID ? `, server pid ${PID}` : ""}`);
console.log("page          req/s (best, spread)   p50 ms  p95 ms  p99 ms  cpu ms/req  raw KB  gzip KB  br KB  status");
for (const page of pages) {
  const size = await sizes(page.path);
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await run(page));
  const best = runs.reduce((a, b) => (b.reqPerSec > a.reqPerSec ? b : a));
  const rates = runs.map((r) => r.reqPerSec);
  const spread = Math.max(...rates) - Math.min(...rates);
  const ok = Object.keys(best.statuses).every((s) => (page.expect ?? [200]).includes(Number(s)));
  results.push({ ...page, size, runs, best });
  console.log(
    [
      page.name.padEnd(13),
      `${fmt(best.reqPerSec, 1)} (±${fmt(spread / 2, 1)})`.padEnd(22),
      fmt(best.p50, 1).padStart(7),
      fmt(best.p95, 1).padStart(7),
      fmt(best.p99, 1).padStart(7),
      fmt(best.cpuMsPerReq, 2).padStart(11),
      fmt(size.raw / 1024, 1).padStart(7),
      fmt(size.gzip / 1024, 1).padStart(8),
      fmt(size.brotli / 1024, 1).padStart(6),
      `  ${ok ? "" : "UNEXPECTED "}${JSON.stringify(best.statuses)}`,
    ].join(" "),
  );
}
if (args.json) writeFileSync(args.json, JSON.stringify({ base: BASE, connections: CONNECTIONS, seconds: SECONDS, results }, null, 2));

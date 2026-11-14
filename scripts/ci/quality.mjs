/**
 * Browser checks on the built site, run by CI after `npm run build`:
 *   - accessibility: axe (@axe-core/playwright) on each page in scripts/ci/quality.config.json, at phone and desktop
 *     width; serious and critical violations fail;
 *   - phone width: no page may scroll sideways at 390 px (in each country of `overflowCountries`);
 *   - performance budget, under CPU throttling and with a cold cache: script bytes transferred for the swap page,
 *     and largest contentful paint and cumulative layout shift from the browser's own PerformanceObserver;
 *   - HTML weight: each page's document, raw and gzipped, against `budgets.htmlKb`, so the cut of 14 Nov 2026
 *     (docs/deploy.md, "Load test") can't grow back unnoticed.
 *
 *   node scripts/ci/quality.mjs              check against the budgets; exit 1 on any failure
 *   node scripts/ci/quality.mjs --measure    print today's numbers and suggested budgets; budgets don't fail
 *
 * Needs `playwright` and `@axe-core/playwright` (pinned devDependencies; CI then installs Chromium, see .github/workflows/ci.yml)
 * and a Chromium for Playwright. Starts .next/standalone/server.js itself on a free port, with no database (pages are
 * static), unless QUALITY_BASE_URL points at a running site. Writes a Markdown report to stdout and, on GitHub, to
 * the job summary, and the raw numbers to QUALITY_OUT (default .next/quality.json).
 */
import { spawn } from "node:child_process";
import { appendFileSync, cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const root = join(import.meta.dirname, "..", "..");
const config = JSON.parse(readFileSync(process.env.QUALITY_CONFIG ?? join(import.meta.dirname, "quality.config.json"), "utf8"));
const MEASURE = process.argv.includes("--measure");
const OUT = process.env.QUALITY_OUT ?? join(root, ".next", "quality.json");
/** Margins used for --measure suggestions: LCP +25% (rounded up to 100 ms), CLS +0.02, script +5 KB, HTML +5%. */
const MARGIN = { lcp: 1.25, cls: 0.02, kb: 5, html: 1.05 };

const failures = [];
/** A page is a path, measured in `config.country`, or { path, country } for one seen from another country. */
const pagePath = (p) => (typeof p === "string" ? p : p.path);
const pageCountry = (p) => (typeof p === "string" ? config.country : p.country);
const report = [];
const results = { axe: {}, overflow: {}, perf: {}, firstHtml: {}, html: {} };

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function startServer() {
  if (process.env.QUALITY_BASE_URL) return { base: process.env.QUALITY_BASE_URL.replace(/\/$/, ""), stop: () => {} };
  const standalone = join(root, ".next", "standalone");
  if (!existsSync(join(standalone, "server.js"))) throw new Error("No .next/standalone/server.js: run `npm run build` first.");
  // The standalone server serves these only when they sit beside it, as the Dockerfile puts them.
  cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
  cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
  const port = await freePort();
  const env = { ...process.env, NODE_ENV: "production", PORT: String(port), HOSTNAME: "127.0.0.1" };
  delete env.DATABASE_URL;
  const child = spawn(process.execPath, ["server.js"], { cwd: standalone, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (c) => (log += c));
  child.stderr.on("data", (c) => (log += c));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    if (i > 120 || child.exitCode !== null) throw new Error(`The server did not start:\n${log.slice(-2000)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
  return { base, stop: () => child.kill("SIGTERM") };
}

async function newPage(browser, base, widthName, country, extraInit) {
  const w = config.widths[widthName];
  const context = await browser.newContext({
    viewport: { width: w.width, height: w.height },
    isMobile: w.mobile,
    hasTouch: w.mobile,
    deviceScaleFactor: w.mobile ? 2 : 1,
    // The site's own worker would answer some requests from its cache; measure the network.
    serviceWorkers: "block",
  });
  await context.addCookies([{ name: "sbc_country", value: country, url: base }]);
  await context.addInitScript(
    ({ saved }) => {
      try {
        if (location.pathname === "/my-list") localStorage.setItem("sbc:saved", JSON.stringify(saved));
      } catch {}
    },
    { saved: config.savedForMyList },
  );
  if (extraInit) await context.addInitScript(extraInit);
  return { context, page: await context.newPage() };
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

// ---------- accessibility and sideways scroll ----------
async function checkPage(browser, base, name, entry) {
  const path = pagePath(entry);
  for (const widthName of Object.keys(config.widths)) {
    const { context, page } = await newPage(browser, base, widthName, pageCountry(entry));
    const res = await page.goto(base + path, { waitUntil: "load" });
    if (!res || res.status() >= 400) failures.push(`${name} (${path}) answered ${res?.status()}`);
    await settle(page);
    const axe = await new AxeBuilder({ page }).withTags(config.axe.tags).analyze();
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const v of axe.violations) counts[v.impact ?? "minor"] += v.nodes.length;
    results.axe[`${name}@${widthName}`] = { counts, violations: axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0]?.target?.join(" ") })) };
    for (const v of axe.violations.filter((v) => config.axe.failOn.includes(v.impact))) {
      failures.push(`axe ${v.impact}: ${v.id} on ${name} at ${widthName} (${v.nodes.length}x, e.g. ${v.nodes[0]?.target?.join(" ")}): ${v.help}`);
    }
    await context.close();
  }
  const phone = Object.keys(config.widths).find((k) => config.widths[k].width <= 400) ?? "phone";
  for (const country of config.overflowCountries) {
    const { context, page } = await newPage(browser, base, phone, country);
    await page.goto(base + path, { waitUntil: "load" });
    await settle(page);
    const o = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const over = document.documentElement.scrollWidth - vw;
      const wide = [];
      if (over > 1) {
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.right > vw + 1 && r.width > 0 && getComputedStyle(el).position !== "fixed") {
            wide.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : ""} (right ${Math.round(r.right)})`);
            if (wide.length >= 5) break;
          }
        }
      }
      return { over, wide };
    });
    results.overflow[`${name}@${country}`] = o.over;
    if (o.over > 1) failures.push(`${name} scrolls sideways by ${o.over}px at 390 px in ${country}: ${o.wide.join(", ")}`);
    await context.close();
  }
}

// ---------- the first HTML of a prefixed page ----------
/**
 * A prefixed page's header must be right in its first HTML: the logo goes to that country's home and the country picker
 * names the country, with no part of the header left to a streamed segment (React outlines a finished Suspense boundary
 * over 500 bytes once the shell is big, so a large boundary there arrives late even on a prerendered page).
 */
async function checkFirstHtml(base) {
  for (const { path, home, label } of config.firstHtml ?? []) {
    const html = await (await fetch(base + path)).text();
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    const logo = /<a[^>]*aria-label="SameButCheaper (?:home|Startseite)"[^>]*>/.exec(header)?.[0] ?? "";
    results.firstHtml = { ...results.firstHtml, [path]: { logo, deferred: header.includes("<template id=") } };
    if (!logo.includes(`href="${home}"`)) failures.push(`${path}: the header logo in the first HTML is ${logo || "missing"}, not a link to ${home}`);
    if (!header.includes(`>${label}<`)) failures.push(`${path}: the country picker in the first HTML doesn't say ${label}`);
    if (header.includes("<template id=")) failures.push(`${path}: part of the header is left to a streamed segment`);
  }
}

// ---------- HTML weight ----------
/** The document as a shopper in the page's country gets it, whole (the streamed parts included), raw and gzipped. */
async function measureHtml(base, name, entry) {
  const res = await fetch(base + pagePath(entry), { headers: { cookie: `sbc_country=${pageCountry(entry)}`, "accept-encoding": "identity" } });
  const body = Buffer.from(await res.arrayBuffer());
  const m = { rawKb: Math.round(body.length / 1024), gzipKb: Math.round(gzipSync(body, { level: 6 }).length / 1024) };
  results.html[name] = m;
  return m;
}

function checkHtmlBudgets() {
  const b = config.budgets.htmlKb ?? {};
  for (const [name, m] of Object.entries(results.html)) {
    const budget = b[name];
    if (!budget) {
      failures.push(`No htmlKb budget for ${name} in quality.config.json`);
      continue;
    }
    if (m.rawKb > budget.raw) failures.push(`HTML of ${name}: ${m.rawKb} KB, budget ${budget.raw} KB`);
    if (m.gzipKb > budget.gzip) failures.push(`HTML of ${name}: ${m.gzipKb} KB gzipped, budget ${budget.gzip} KB`);
  }
}

// ---------- performance ----------
const OBSERVE = () => {
  window.__perf = { lcp: 0, cls: 0 };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
};

async function measure(browser, base, name, entry) {
  const path = pagePath(entry);
  const runs = [];
  for (let i = 0; i < config.performance.runs; i++) {
    const { context, page } = await newPage(browser, base, config.performance.width, pageCountry(entry), OBSERVE);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: config.performance.cpuThrottle });
    const types = new Map();
    let scriptBytes = 0;
    let allBytes = 0;
    cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
    cdp.on("Network.loadingFinished", (e) => {
      allBytes += e.encodedDataLength;
      if (types.get(e.requestId) === "Script") scriptBytes += e.encodedDataLength;
    });
    await page.goto(base + path, { waitUntil: "load" });
    await settle(page);
    await page.waitForTimeout(1000);
    const p = await page.evaluate(() => window.__perf);
    runs.push({ lcp: p.lcp, cls: p.cls, scriptKb: scriptBytes / 1024, totalKb: allBytes / 1024 });
    await context.close();
  }
  const median = (k) => runs.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(runs.length / 2)];
  const m = { lcpMs: Math.round(median("lcp")), cls: Number(median("cls").toFixed(3)), scriptKb: Math.round(median("scriptKb")), totalKb: Math.round(median("totalKb")) };
  results.perf[name] = m;
  return m;
}

function checkBudgets() {
  const b = config.budgets;
  for (const [name, m] of Object.entries(results.perf)) {
    const lcp = b.lcpMs[name];
    const cls = b.cls[name];
    if (lcp && m.lcpMs > lcp) failures.push(`LCP on ${name}: ${m.lcpMs} ms, budget ${lcp} ms`);
    if (cls !== undefined && m.cls > cls) failures.push(`CLS on ${name}: ${m.cls}, budget ${cls}`);
    if (lcp === undefined || cls === undefined) failures.push(`No LCP/CLS budget for ${name} in quality.config.json`);
  }
  const swap = results.perf.swap;
  if (swap && b.swapScriptKb && swap.scriptKb > b.swapScriptKb) failures.push(`Script on the swap page: ${swap.scriptKb} KB transferred, budget ${b.swapScriptKb} KB`);
  if (!b.swapScriptKb) failures.push("No swapScriptKb budget in quality.config.json");
}

function suggest() {
  const s = { swapScriptKb: (results.perf.swap?.scriptKb ?? 0) + MARGIN.kb, lcpMs: {}, cls: {}, htmlKb: {} };
  for (const [name, m] of Object.entries(results.html)) s.htmlKb[name] = { raw: Math.ceil((m.rawKb * MARGIN.html) / 5) * 5, gzip: Math.ceil(m.gzipKb * MARGIN.html) };
  for (const [name, m] of Object.entries(results.perf)) {
    s.lcpMs[name] = Math.ceil((m.lcpMs * MARGIN.lcp) / 100) * 100;
    s.cls[name] = Number((m.cls + MARGIN.cls).toFixed(2));
  }
  return s;
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    await checkFirstHtml(server.base);
    for (const [name, path] of Object.entries(config.pages)) await measureHtml(server.base, name, path);
    for (const [name, path] of Object.entries(config.pages)) await checkPage(browser, server.base, name, path);
    for (const [name, path] of Object.entries(config.pages)) await measure(browser, server.base, name, path);
  } finally {
    await browser.close();
    server.stop();
  }
  if (!MEASURE) {
    // Timings on a shared runner are noisy: a page over its LCP or CLS budget is measured once more, and only fails
    // when both medians are over. Script size doesn't vary, so it gets no second try.
    const over = Object.entries(results.perf).filter(([name, m]) => m.lcpMs > (config.budgets.lcpMs[name] ?? Infinity) || m.cls > (config.budgets.cls[name] ?? Infinity));
    if (over.length) {
      const again = await chromium.launch();
      const server2 = await startServer();
      try {
        for (const [name, first] of over) {
          const second = await measure(again, server2.base, name, config.pages[name]);
          results.perf[name] = { ...second, lcpMs: Math.min(first.lcpMs, second.lcpMs), cls: Math.min(first.cls, second.cls), retried: true };
        }
      } finally {
        await again.close();
        server2.stop();
      }
    }
    checkBudgets();
    checkHtmlBudgets();
  }

  const b = config.budgets;
  report.push(`## Quality checks (${config.country} unless a page says otherwise, phone ${config.widths.phone.width} px and desktop ${config.widths.desktop.width} px)`, "");
  report.push(`Performance: phone width, ${config.performance.cpuThrottle}x CPU slowdown, cold cache, no network throttling, median of ${config.performance.runs}.`, "");
  report.push("| Page | LCP ms (budget) | CLS (budget) | Script KB (budget) | All KB | HTML KB raw / gzip (budget) | axe serious+critical, phone / desktop | Sideways px |", "|---|---|---|---|---|---|---|---|");
  for (const name of Object.keys(config.pages)) {
    const m = results.perf[name];
    const ax = (w) => {
      const c = results.axe[`${name}@${w}`]?.counts;
      return c ? c.serious + c.critical : "?";
    };
    const over = config.overflowCountries.map((c) => results.overflow[`${name}@${c}`] ?? "?").join(" / ");
    const label = typeof config.pages[name] === "string" ? name : `${name} (${config.pages[name].country})`;
    const html = (n) => {
      const h = results.html[n];
      const hb = b.htmlKb?.[n];
      return h ? `${h.rawKb} / ${h.gzipKb}${hb ? ` (${hb.raw} / ${hb.gzip})` : ""}` : "?";
    };
    report.push(
      `| ${label} | ${m.lcpMs} (${b.lcpMs[name] ?? "-"}) | ${m.cls} (${b.cls[name] ?? "-"}) | ${m.scriptKb}${name === "swap" ? ` (${b.swapScriptKb || "-"})` : ""} | ${m.totalKb} | ${html(name)} | ${ax("phone")} / ${ax("desktop")} | ${over} |`,
    );
  }
  report.push("");
  if (MEASURE) report.push("Suggested budgets (today plus margin):", "```json", JSON.stringify(suggest(), null, 2), "```", "");
  report.push(failures.length ? `### ${failures.length} failure(s)\n\n${failures.map((f) => `- ${f}`).join("\n")}` : "All checks passed.");
  const text = report.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
  writeFileSync(OUT, JSON.stringify({ ...results, failures }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

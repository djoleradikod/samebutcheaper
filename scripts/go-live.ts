/**
 * The go-live half of `npm run preflight`: asks the running site, over HTTP, what a visitor, a crawler and an attacker
 * would see. Used with --url (docs/deploy.md, "Verify"); the configuration half is src/lib/readiness.ts.
 *
 * `base` is where the site is reached from here (the public https address, or http://127.0.0.1:3101 on the server),
 * `site` the public address it was built for. Checks that only make sense over the public https address (the http to
 * https redirect, HSTS) are skipped when `base` is not https.
 */
export type LiveCheck = { label: string; ok: boolean | null; detail: string; fix?: string };

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 sbc-preflight";

export async function goLiveChecks(base: string, site: string, opts: { fetch?: Fetch; slug?: string } = {}): Promise<LiveCheck[]> {
  const f = opts.fetch ?? ((url, init) => fetch(url, init));
  base = base.replace(/\/$/, "");
  site = site.replace(/\/$/, "");
  const out: LiveCheck[] = [];
  const add = (label: string, ok: boolean | null, detail: string, fix?: string) => out.push({ label, ok, detail, fix });
  const get = async (path: string, init: RequestInit = {}) => {
    try {
      return await f(base + path, { redirect: "manual", signal: AbortSignal.timeout(15_000), ...init, headers: { "User-Agent": UA, ...init.headers } });
    } catch (e) {
      return e instanceof Error ? e : new Error(String(e));
    }
  };
  const failed = (r: Response | Error): r is Error => r instanceof Error;

  // ---- health
  const h = await get("/api/health");
  if (failed(h)) {
    add("Site answers", false, `${base}/api/health: ${h.message}`, "Is the container running (deploy-remote.sh status), and does the reverse proxy forward to 127.0.0.1:3101 and 3102?");
    return out;
  }
  let health: { database?: string; migrations?: string | null; ready?: boolean; blockers?: string[] } = {};
  try {
    health = await h.json();
  } catch {}
  add("Site answers", h.status === 200, `/api/health ${h.status}`);
  const [applied, expected] = String(health.migrations ?? "").split("/").map(Number);
  add(
    "Database",
    health.database === "ok" && applied >= expected,
    `${health.database ?? "unknown"}, migrations ${health.migrations ?? "unknown"}`,
    "deploy-remote.sh status; then docker compose logs db (docs/deploy.md, \"When something is wrong\").",
  );
  add(
    "Launch checklist",
    health.ready === true,
    health.ready ? "nothing blocks" : `blocked by: ${(health.blockers ?? []).join(", ") || "unknown"}`,
    "Details and fixes on /admin, or run npm run preflight on the server with its .env.",
  );

  // ---- https
  const https = base.startsWith("https://");
  if (https) {
    const http = await (async () => {
      try {
        return await f(base.replace(/^https:/, "http:") + "/", { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": UA } });
      } catch (e) {
        return e instanceof Error ? e : new Error(String(e));
      }
    })();
    const loc = failed(http) ? "" : (http.headers.get("location") ?? "");
    add(
      "http:// goes to https://",
      !failed(http) && [301, 302, 307, 308].includes(http.status) && loc.startsWith("https://"),
      failed(http) ? http.message : `${http.status} ${loc}`,
      "The reverse proxy should redirect port 80 to https (Caddy does by default; see docs/deploy.md, \"Reverse proxy\").",
    );
  } else {
    add("http:// goes to https://", null, `skipped: ${base} is not https`);
  }

  // ---- home: headers, canonical
  // A browser's language, so the country cookie is set and its flags can be read.
  const home = await get("/", { headers: { "Accept-Language": "en-GB,en;q=0.8" } });
  if (failed(home)) {
    add("Home page", false, home.message);
    return out;
  }
  const html = await home.text();
  add("Home page", home.status === 200, `${home.status}, ${Math.round(html.length / 1024)} KB`);
  const hd = (k: string) => home.headers.get(k) ?? "";
  const hsts = hd("strict-transport-security");
  if (https) add("HSTS", /max-age=\d{7,}/.test(hsts), hsts || "missing", "The site sends it when built for an https:// address: rebuild with SITE_URL set to https://...");
  else add("HSTS", null, hsts ? `${hsts} (sent; only browsers on https act on it)` : "skipped: not https");
  const csp = hd("content-security-policy");
  add("Content-Security-Policy", /frame-ancestors/.test(csp) && /object-src 'none'/.test(csp), csp || "missing");
  add("Framing refused to other sites", /SAMEORIGIN|DENY/i.test(hd("x-frame-options")), hd("x-frame-options") || "missing");
  add("nosniff", hd("x-content-type-options") === "nosniff", hd("x-content-type-options") || "missing");
  add("Referrer-Policy", Boolean(hd("referrer-policy")), hd("referrer-policy") || "missing");
  add("Permissions-Policy", /camera=\(\)/.test(hd("permissions-policy")), hd("permissions-policy") || "missing");
  add("No X-Powered-By", !hd("x-powered-by"), hd("x-powered-by") || "not sent");
  const canonical = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/.exec(html)?.[1] ?? /<link[^>]+href="([^"]+)"[^>]+rel="canonical"/.exec(html)?.[1] ?? "";
  add(
    "Canonical link is the public address",
    canonical === site || canonical === `${site}/`,
    canonical || "missing",
    "Pages are built for one address: set SITE_URL (repository variable) to the public https address and deploy again.",
  );
  const cookies = home.headers.getSetCookie?.() ?? [];
  const loose = cookies.filter((c) => !/samesite=(lax|strict)/i.test(c));
  const insecure = https ? cookies.filter((c) => !/;\s*secure/i.test(c)).map((c) => c.split("=")[0]) : [];
  add(
    "Cookies are SameSite",
    loose.length === 0,
    cookies.length
      ? `${cookies.map((c) => c.split(";")[0].split("=")[0]).join(", ")}${insecure.length ? ` (without Secure: ${insecure.join(", ")}; they hold only a country and a traffic source)` : ""}`
      : "none set on this request",
  );

  // ---- crawlers
  const robots = await get("/robots.txt");
  const robotsText = failed(robots) ? "" : await robots.text();
  add(
    "robots.txt names the sitemap",
    robotsText.includes(`Sitemap: ${site}/sitemap.xml`),
    failed(robots) ? robots.message : (/^Sitemap:.*$/m.exec(robotsText)?.[0] ?? "no Sitemap line"),
  );
  add("robots.txt keeps /admin and /go out", /Disallow: \/admin/.test(robotsText) && /Disallow: \/go/.test(robotsText), robotsText.match(/^Disallow:.*$/gm)?.join(" ") ?? "none");
  const sm = await get("/sitemap.xml");
  const smText = failed(sm) ? "" : await sm.text();
  const locs = smText.match(/<loc>[^<]+<\/loc>/g) ?? [];
  const foreign = locs.filter((l) => !l.startsWith(`<loc>${site}`));
  add("Sitemap lists only the public address", !failed(sm) && sm.status === 200 && locs.length > 0 && foreign.length === 0, failed(sm) ? sm.message : `${sm.status}, ${locs.length} URLs${foreign.length ? `, ${foreign.length} elsewhere, e.g. ${foreign[0]}` : ""}`);

  // ---- protected and outbound
  const admin = await get("/admin");
  add("/admin asks for a password", !failed(admin) && (admin.status === 401 || admin.status === 404), failed(admin) ? admin.message : `${admin.status}`);
  if (opts.slug) {
    const go = await get(`/go/${opts.slug}/alternative`, { method: "HEAD" });
    const to = failed(go) ? "" : (go.headers.get("location") ?? "");
    let host = "";
    try {
      host = new URL(to).host;
    } catch {}
    add("/go sends shoppers to the store", !failed(go) && go.status === 302 && Boolean(host) && host !== new URL(site).host, failed(go) ? go.message : `${go.status} to ${host || "nowhere"}`);
  }
  const evil = await get("/go/%2F%2Fevil.example/alternative");
  add("/go is not an open redirect", !failed(evil) && evil.status === 404, failed(evil) ? evil.message : `${evil.status} ${evil.headers.get("location") ?? ""}`);
  const sw = await get("/sw.js");
  add("Service worker is never cached", !failed(sw) && sw.status === 200 && /no-cache/.test(sw.headers.get("cache-control") ?? ""), failed(sw) ? sw.message : `${sw.status} ${sw.headers.get("cache-control") ?? ""}`);
  return out;
}

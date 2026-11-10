import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import { pickAffiliateEnv } from "./src/lib/affiliate-links";

/**
 * Affiliate settings come from the environment, plus a dotenv-style file when one is mounted (Docker passes .env in
 * as the build secret "affiliate", so a new AFF_ program needs no Dockerfile change). The environment wins.
 */
function affiliateSettings() {
  const file = process.env.AFFILIATE_ENV_FILE ?? "/run/secrets/affiliate";
  const fromFile: Record<string, string> = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m) fromFile[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
    }
  }
  return pickAffiliateEnv({ ...fromFile, ...process.env });
}

const HTTPS_SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Fixed at build time, so links can't start earning under pages built saying they don't. See src/lib/affiliate.ts.
  env: {
    AFFILIATE_CONFIG: JSON.stringify(affiliateSettings()),
  },
  // Share images read the font files at run time when a page wasn't prerendered.
  outputFileTracingIncludes: { "/**/opengraph-image": ["./assets/fonts/*.ttf"] },
  experimental: {
    // One static-generation worker per CPU overruns a 4 GB build cage on a 20-core host.
    cpus: 4,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // No page may be framed by another site, load plugins, repoint relative links or post a form elsewhere.
          // Scripts aren't restricted here: the layout has an inline one, which needs a per-request nonce to allow.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'",
          },
          // Once the site is built for an https address, browsers stop trying it over http for a year.
          ...(HTTPS_SITE ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
        ],
      },
      // Redirects, admin and API answers are per visitor: nothing in between may keep a copy.
      {
        source: "/(admin|api|go|out)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;

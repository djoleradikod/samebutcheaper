import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Fixed at build time, so the pages' words about earning and the links they sit beside always agree. See src/lib/affiliate.ts.
  env: {
    AMAZON_ASSOCIATE_TAG: process.env.AMAZON_ASSOCIATE_TAG ?? "",
    AMAZON_TAGS: process.env.AMAZON_TAGS ?? "",
    WALMART_AFFILIATE_TEMPLATE: process.env.WALMART_AFFILIATE_TEMPLATE ?? "",
    TARGET_AFFILIATE_TEMPLATE: process.env.TARGET_AFFILIATE_TEMPLATE ?? "",
  },
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
        ],
      },
    ];
  },
};

export default nextConfig;

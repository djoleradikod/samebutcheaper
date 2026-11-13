# syntax=docker/dockerfile:1.7
# One image runs the site and its migrations:
#   docker run --rm <image>                                  the site on port 3000 (non-root, standalone output)
#   docker run --rm -e DATABASE_URL=... <image> node migrator/scripts/migrate.mjs   apply ./drizzle migrations
# The deploy workflow (.github/workflows/deploy.yml) builds this and pushes it to GHCR; docs/deploy.md has the rest.

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
# Affiliate settings are fixed at build time (next.config.ts). They arrive as the build secret "affiliate"
# (docker compose passes .env; the deploy workflow passes the AFFILIATE_ENV secret), so they never land in a layer.
# `npm run build` runs `prebuild` first, which validates data/pairs and compiles the catalogue, and with it the
# freshness tiers: an image is as fresh as the day it was built, which is why the workflow rebuilds weekly.
RUN --mount=type=secret,id=affiliate,required=false npm run build

# ---------- migration tool: drizzle-orm and postgres only ----------
FROM node:22-alpine AS migrate-deps
WORKDIR /migrator
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /app/node_modules/postgres ./node_modules/postgres
COPY drizzle ./drizzle
COPY scripts/migrate.mjs ./scripts/migrate.mjs

# ---------- migrator (one-shot, used by docker-compose.yml) ----------
FROM node:22-alpine AS migrator
WORKDIR /app
COPY --from=migrate-deps /migrator ./
CMD ["node", "scripts/migrate.mjs"]

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app
ARG SOURCE_COMMIT=unknown
ARG SOURCE_REPO=
LABEL org.opencontainers.image.title="samebutcheaper" \
      org.opencontainers.image.revision=$SOURCE_COMMIT \
      org.opencontainers.image.source=$SOURCE_REPO
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    SOURCE_COMMIT=$SOURCE_COMMIT
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# Read-only for the app user: nothing at run time writes here.
COPY --from=migrate-deps /migrator ./migrator
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]

# SameButCheaper: notes for agents

- Next.js 16 with Cache Components. Read `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md).
- The catalog source of truth is `data/pairs/*.json`. `npm run catalog` validates it with `src/lib/schema.ts` and writes `src/generated/catalog.json` (gitignored). Never hand-edit the generated file.
- Pair rules and the format are in `data/README.md`. Research brief for new pairs: accuracy over volume, at least 2 real sources, the same unit on both sides.
- Postgres only stores clicks, lookups, submissions and subscribers (`src/db/schema.ts`). After schema changes, run `npm run db:generate` and commit `drizzle/`.
- Before pushing, run `npm run catalog && npx next typegen && npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e`. The database and end-to-end tests need `TEST_DATABASE_URL` set to a Postgres database that may be wiped; they skip without it.
- Server code logs through `src/lib/log.ts` (one JSON line each), never `console`. Anything a visitor can trigger repeatedly goes through `src/lib/rate-limit.ts`.
- Emails only go to subscribers with status `confirmed` (double opt-in, `src/lib/newsletter.ts`), and every one carries `listHeaders()`.
- A new env var that a launch depends on gets a check in `src/lib/readiness.ts` and a line in `.env.example`.

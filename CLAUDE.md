# SameButCheaper: notes for agents

- Next.js 16 with Cache Components. Read `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md).
- The catalog source of truth is `data/pairs/*.json`. `npm run catalog` validates it with `src/lib/schema.ts` and writes `src/generated/catalog.json` (gitignored). Never hand-edit the generated file.
- Pair rules and the format are in `data/README.md`. Research brief for new pairs: accuracy over volume, at least 2 real sources, the same unit on both sides.
- Postgres only stores clicks, lookups, submissions and subscribers (`src/db/schema.ts`). After schema changes, run `npm run db:generate` and commit `drizzle/`.
- Before pushing, run `npm run catalog && npx next typegen && npm run typecheck && npm run lint && npm run build`.

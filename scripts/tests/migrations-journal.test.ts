/**
 * drizzle/ as the production migrator reads it. Drizzle applies a migration when its journal "when" is later than the
 * newest one recorded in the database, and finds its SQL by the journal tag, so a hand rename (0006 and 0007 were) or
 * a merge that reorders entries would silently skip a migration on a live database. No database needed.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const dir = join(import.meta.dirname, "..", "..", "drizzle");
const journal = JSON.parse(readFileSync(join(dir, "meta", "_journal.json"), "utf8")) as {
  dialect: string;
  entries: { idx: number; when: number; tag: string }[];
};
const sqlFiles = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const snapshots = readdirSync(join(dir, "meta")).filter((f) => f.endsWith("_snapshot.json")).sort();

test("every SQL file is in the journal, under its own name, in order", () => {
  assert.equal(journal.dialect, "postgresql");
  assert.deepEqual(
    journal.entries.map((e) => `${e.tag}.sql`),
    sqlFiles,
    "journal tags and drizzle/*.sql must match one to one",
  );
  journal.entries.forEach((e, i) => {
    assert.equal(e.idx, i, `entry ${e.tag} has idx ${e.idx}, expected ${i}`);
    assert.ok(e.tag.startsWith(String(i).padStart(4, "0") + "_"), `${e.tag} should start with its number`);
  });
});

test("journal times only go up, and none is in the future", () => {
  for (let i = 1; i < journal.entries.length; i++) {
    const [a, b] = [journal.entries[i - 1], journal.entries[i]];
    assert.ok(b.when > a.when, `${b.tag} (${b.when}) must be later than ${a.tag} (${a.when}), or databases that have ${a.tag} never get it`);
  }
  // A "when" far ahead of today would make every later migration look older than it, and be skipped.
  const last = journal.entries.at(-1)!;
  assert.ok(last.when < Date.now() + 24 * 3600_000, `${last.tag} is dated in the future`);
});

test("one snapshot per migration, chained by prevId", () => {
  assert.equal(snapshots.length, journal.entries.length);
  let prev = "00000000-0000-0000-0000-000000000000";
  for (const e of journal.entries) {
    const s = JSON.parse(readFileSync(join(dir, "meta", `${e.tag.slice(0, 4)}_snapshot.json`), "utf8")) as { id: string; prevId: string };
    assert.equal(s.prevId, prev, `${e.tag}'s snapshot does not follow the one before it`);
    prev = s.id;
  }
});

test("migrations only add: nothing drops or renames what an older build still reads during a rollback", () => {
  // deploy-remote.sh rolls back by starting the previous image on the migrated database (docs/deploy.md).
  // One that must drop something needs a two-step release: stop reading it, ship, then drop in a later release.
  for (const f of sqlFiles) {
    const bad = /\b(DROP\s+(TABLE|COLUMN)|RENAME\s+(COLUMN|TO))\b/i.exec(readFileSync(join(dir, f), "utf8"));
    assert.equal(bad, null, `${f} contains "${bad?.[0]}": a rollback to the previous image would break`);
  }
});

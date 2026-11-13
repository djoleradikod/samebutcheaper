/**
 * Writes this week's letter to files, as a new reader would get it, without sending anything or touching the
 * database:  npm run newsletter:preview [-- --country DE] [--out <dir>]
 *
 * Without --country it writes one per market plus "unknown" (a reader whose country we don't know). Each gets an
 * .html and a .txt (the plain-text part). Open the .html in a browser. Records count as "new" only through the
 * live site's upkeep, so here every issue shows the biggest savings, the same as a reader's first letter.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  isoWeek,
  letterMail,
  letterSettings,
  sampleIssue,
  TEST_TOKEN,
} from "../src/lib/letter";

const { values } = parseArgs({
  options: { country: { type: "string" }, out: { type: "string" } },
});
const countries = values.country
  ? [values.country.toUpperCase()]
  : ["US", "GB", "DE", "CA", "IE", "unknown"];
const out = resolve(values.out ?? join(tmpdir(), "samebutcheaper-newsletter"));
mkdirSync(out, { recursive: true });

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const contactEmail =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@samebutcheaper.com";
const postalAddress =
  letterSettings(process.env).postalAddress ??
  "(MAIL_POSTAL_ADDRESS is not set: the real letter is held back until it is)";
const now = new Date();

async function main() {
  for (const cc of countries) {
    const issue = await sampleIssue(null, cc === "unknown" ? null : cc, now);
    if (!issue) {
      console.log(`${cc}: nothing to send`);
      continue;
    }
    const mail = letterMail(
      issue,
      {
        to: "preview@example.com",
        token: TEST_TOKEN,
        issueKey: isoWeek(now),
        test: true,
      },
      { siteUrl, contactEmail, postalAddress },
    );
    const base = join(out, `letter-${cc}`);
    writeFileSync(`${base}.html`, mail.html);
    writeFileSync(`${base}.txt`, `Subject: ${mail.subject}\n\n${mail.text}`);
    console.log(
      `${cc}: ${issue.keys.length} items, "${mail.subject}"\n  ${base}.html`,
    );
  }
}

void main();

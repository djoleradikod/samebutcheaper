/**
 * The visible text of a prerendered page, for comparing English pages before and after the German work
 * (scripts/tests/i18n-english.test.ts). Reads the static HTML Next writes for a prerendered page, drops what a reader
 * never sees (scripts, styles, the hidden React payload, attributes), and puts one block of text per line.
 *
 *   npx tsx scripts/tests/i18n-page-text.ts <file.html>   prints the text
 */
import { readFileSync } from "node:fs";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#x27": "'" };

/** Tags after which a reader sees a new line. */
const BLOCK = /<\/?(p|div|li|ul|ol|h[1-6]|section|article|header|footer|nav|main|table|tr|td|th|details|summary|dt|dd|dl|br|form|figure|figcaption|aside|button|label|span role="(?:cell|row|columnheader)")\b[^>]*>/gi;

export function pageText(html: string) {
  const body = html.slice(html.indexOf("<body"));
  return body
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<template\b[\s\S]*?<\/template>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(BLOCK, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (ENTITIES[e]) return ENTITIES[e];
      if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (/^#/.test(e)) return String.fromCodePoint(Number(e.slice(1)));
      return m;
    })
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

if (process.argv[1]?.endsWith("i18n-page-text.ts") && process.argv[2]) {
  process.stdout.write(`${pageText(readFileSync(process.argv[2], "utf8"))}\n`);
}

/** Small text helpers for cleaning label text from public databases. */

export function first<T>(a: T[] | undefined | null): T | undefined {
  return a && a.length ? a[0] : undefined;
}

export function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : t;
}

/** "CETIRIZINE HYDROCHLORIDE" -> "Cetirizine hydrochloride"; leaves mixed case alone. */
export function sentenceCase(s: string) {
  const t = s.trim();
  if (t !== t.toUpperCase()) return t;
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** "Claritin 24 hour" -> ["claritin", "24", "hour"] */
export function tokens(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Share of the query's tokens found in the text (0 to 1). */
export function overlap(query: string, text: string) {
  const q = tokens(query);
  if (!q.length) return 0;
  const t = new Set(tokens(text));
  return q.filter((w) => t.has(w)).length / q.length;
}

/** Normalises a strength for comparison: "10 MG" and "10mg" are equal. */
export function normAmount(a: string) {
  return a
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/µg|μg/g, "mcg")
    .replace(/units?$/, "iu")
    // "5.0mg" is 5 mg. "1.000mg" may be a thousand, so it keeps its zeros.
    .replace(/\.0{1,2}(?=[a-z%])/, "");
}

/** Removes a leading section heading ("Uses", "Purpose", "Directions") from label text. */
export function stripHeading(s: string, ...headings: string[]) {
  let t = s.replace(/\s+/g, " ").trim();
  for (const h of headings) {
    const re = new RegExp(`^${h}\\s*[:.]?\\s*`, "i");
    t = t.replace(re, "");
  }
  return t;
}

/** Splits label bullet text ("• runny nose • sneezing") into items. */
export function bullets(s: string) {
  return s
    .split(/\s*[•■●▪◆]\s*|\s{2,}/)
    .map((x) => x.trim())
    .filter((x) => x.length > 2);
}

/** Valid GTIN (UPC-A, EAN-13, EAN-8) by check digit. */
export function isGtin(code: string) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** The forms a barcode may be stored under: UPC-A and its EAN-13 with a leading zero. */
export function gtinVariants(code: string) {
  const c = code.replace(/\D/g, "");
  const out = new Set<string>([c]);
  if (c.length === 12) out.add(`0${c}`);
  if (c.length === 13 && c.startsWith("0")) out.add(c.slice(1));
  if (c.length === 14 && c.startsWith("00")) {
    out.add(c.slice(1));
    out.add(c.slice(2));
  }
  return [...out];
}

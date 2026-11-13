/**
 * Product codes on catalogue records: the GS1 barcode (GTIN) and, for German medicines, the PZN. Both carry a check
 * digit, so a mistyped or truncated code fails here instead of matching some other product in an affiliate feed.
 * Pure, for the catalogue schema, the price scripts and tests.
 */

/** A GS1 barcode with a correct check digit: EAN-8, UPC-A (12), EAN-13 or GTIN-14. */
export function isGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  // Weights run 3, 1, 3, ... from the digit next to the check digit, whatever the length.
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** GTIN-8, UPC-A, EAN-13 and GTIN-14 of one product are the same number padded to 14 digits. */
export function gtin14(code: string) {
  return code.replace(/\D/g, "").padStart(14, "0");
}

/**
 * A German Pharmazentralnummer with a correct check digit: 8 digits, the first seven weighted 1 to 7, the sum mod 11
 * is the last digit (a remainder of 10 is never issued). Older 7-digit PZNs are written with a leading 0.
 * A PZN is not a GTIN: it names a pack in the German pharmacy system only.
 */
export function isPzn(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  const d = code.split("").map(Number);
  const sum = d.slice(0, 7).reduce((s, x, i) => s + x * (i + 1), 0);
  const check = sum % 11;
  return check !== 10 && check === d[7];
}

/** The PZN in a licence number the record already gives as "PZN 01234567", or null. */
export function pznFromLicence(licence: string | null | undefined): string | null {
  const m = /^PZN[\s:-]*(\d{7,8})$/i.exec(String(licence ?? "").trim());
  if (!m) return null;
  const code = m[1].padStart(8, "0");
  return isPzn(code) ? code : null;
}

/** A record side priced per amount ("price per wash", "cost per day") names a product, not one pack, so no feed row is it. */
export function pricedPerAmount(product: string) {
  return /\b(price|cost) per\b/i.test(product);
}

export type CodedSide = { where: string; gtin?: string | null; product: string; size: number; unit: string };

/**
 * One barcode is one pack. Sides that carry the same GTIN but differ in size or unit can't both be right, and the
 * wrong one would take the other's price from a feed. Sides priced per amount are left out: they name no pack.
 */
export function gtinConflicts(sides: CodedSide[], unitKey: (unit: string) => string = (u) => u.toLowerCase().trim()) {
  // Keyed by code and unit: one roll counted in sheets on one record and in square metres on another is still one pack.
  const byCode = new Map<string, { size: number; pack: string; where: string }[]>();
  for (const s of sides) {
    if (!s.gtin || pricedPerAmount(s.product)) continue;
    const key = `${gtin14(s.gtin)} ${unitKey(s.unit)}`;
    const list = byCode.get(key) ?? [];
    list.push({ size: s.size, pack: `${s.size} ${unitKey(s.unit)}`, where: s.where });
    byCode.set(key, list);
  }
  const out: string[] = [];
  for (const [key, list] of byCode) {
    if (new Set(list.map((l) => l.size)).size < 2) continue;
    const code = key.split(" ")[0].replace(/^0+(?=\d{8})/, "");
    out.push(`gtin ${code} is on different packs: ${list.map((l) => `${l.where} (${l.pack})`).join(", ")}`);
  }
  return out;
}

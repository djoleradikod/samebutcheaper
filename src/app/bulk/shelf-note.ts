/** Ends in a capital or lower-case initial or a common short form, so the full stop doesn't end the sentence: "U.S.", "e.g." */
const ABBREVIATION = /(?:\b[A-Za-z]|\be\.g|\bi\.e|\bvs|\betc|\bapprox|\bSt|\bDr)\.$/;

/** A lead this short ("Figures differ.", "Two years.") says little without the sentence after it. */
const THIN_LEAD = 30;

/**
 * Splits on full stops, leaving anything inside brackets alone. The words are never changed. A question
 * mark doesn't count, because the notes cite the magazine Which? mid-sentence.
 */
function sentences(text: string) {
  const found: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && c === "." && /\s/.test(text[i + 1] ?? "")) {
      const sentence = text.slice(start, i + 1);
      if (ABBREVIATION.test(sentence)) continue;
      found.push(sentence.trim());
      start = i + 1;
    }
  }
  const last = text.slice(start).trim();
  if (last) found.push(last);
  return found;
}

/**
 * A shelf-life note cut to its first sentence or two, and whatever that leaves out. A note of up to
 * `limit` characters stays whole, and so does a single long sentence. Only cuts, never rewords.
 */
export function trimNote(text: string, limit: number) {
  if (text.length <= limit) return { lead: text, rest: "" };
  const parts = sentences(text);
  const two = parts.length > 1 && (parts[0].length < THIN_LEAD || parts[0].length + parts[1].length + 1 <= limit);
  const kept = two ? 2 : 1;
  return { lead: parts.slice(0, kept).join(" "), rest: parts.slice(kept).join(" ") };
}

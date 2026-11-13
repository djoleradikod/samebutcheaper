/**
 * Changes single values in a JSON file without reformatting it: the pair files use one, two and four
 * space indents and one is a single line, and a price update should be a one-line diff in each of them.
 *
 * A small parser that keeps every value's character span, then a splice. Every edit is checked by
 * parsing the result and comparing it with the original plus the intended change.
 */
import { isDeepStrictEqual } from "node:util";

type Span = { start: number; end: number };
export type JsonNode =
  | (Span & { kind: "object"; entries: Map<string, JsonNode> })
  | (Span & { kind: "array"; items: JsonNode[] })
  | (Span & { kind: "value" });

export type JsonPath = (string | number)[];

export function parseWithSpans(text: string): JsonNode {
  let i = 0;
  const ws = () => {
    while (i < text.length && /\s/.test(text[i])) i++;
  };
  const fail = (what: string): never => {
    throw new Error(`JSON parse error at ${i}: ${what}`);
  };
  const str = () => {
    if (text[i] !== '"') fail("expected string");
    const start = i++;
    while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    if (text[i] !== '"') fail("unterminated string");
    i++;
    return { start, end: i, value: JSON.parse(text.slice(start, i)) as string };
  };
  const value = (): JsonNode => {
    ws();
    const start = i;
    const c = text[i];
    if (c === "{") {
      i++;
      const entries = new Map<string, JsonNode>();
      ws();
      if (text[i] === "}") {
        i++;
        return { kind: "object", start, end: i, entries };
      }
      for (;;) {
        ws();
        const key = str().value;
        ws();
        if (text[i] !== ":") fail("expected :");
        i++;
        entries.set(key, value());
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") {
          i++;
          return { kind: "object", start, end: i, entries };
        }
        fail("expected , or }");
      }
    }
    if (c === "[") {
      i++;
      const items: JsonNode[] = [];
      ws();
      if (text[i] === "]") {
        i++;
        return { kind: "array", start, end: i, items };
      }
      for (;;) {
        items.push(value());
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return { kind: "array", start, end: i, items };
        }
        fail("expected , or ]");
      }
    }
    if (c === '"') {
      const s = str();
      return { kind: "value", start: s.start, end: s.end };
    }
    const m = /^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 40));
    if (!m) fail("unexpected token");
    i += m![0].length;
    return { kind: "value", start, end: i };
  };
  const root = value();
  ws();
  if (i !== text.length) fail("trailing text");
  return root;
}

export function nodeAt(root: JsonNode, path: JsonPath): JsonNode | null {
  let node: JsonNode | undefined = root;
  for (const step of path) {
    if (!node) return null;
    if (typeof step === "number") node = node.kind === "array" ? node.items[step] : undefined;
    else node = node.kind === "object" ? node.entries.get(step) : undefined;
  }
  return node ?? null;
}

export type ValueEdit = { path: JsonPath; value: number | string };

function setIn(obj: unknown, path: JsonPath, value: unknown) {
  let cur = obj as Record<string | number, unknown>;
  for (const step of path.slice(0, -1)) cur = cur[step] as Record<string | number, unknown>;
  cur[path.at(-1)!] = value;
}

/**
 * Replaces existing values in place. Throws when a path doesn't exist or the result isn't exactly the
 * original with those values changed, so a bad edit never reaches a data file.
 */
export function editJson(text: string, edits: ValueEdit[]): string {
  const root = parseWithSpans(text);
  const spans = edits.map((e) => {
    const node = nodeAt(root, e.path);
    if (!node || node.kind !== "value") throw new Error(`no value at ${e.path.join(".")}`);
    return { node, raw: JSON.stringify(e.value) };
  });
  let out = text;
  for (const { node, raw } of [...spans].sort((a, b) => b.node.start - a.node.start)) out = out.slice(0, node.start) + raw + out.slice(node.end);
  const expected = JSON.parse(text);
  for (const e of edits) setIn(expected, e.path, e.value);
  if (!isDeepStrictEqual(JSON.parse(out), expected)) throw new Error("edit check failed: the rewritten file isn't the original plus the change");
  return out;
}

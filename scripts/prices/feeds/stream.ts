/**
 * Reading a feed without holding it: feeds run to hundreds of megabytes, so bytes are decompressed and parsed as
 * they arrive and each row is handed on and dropped. Nothing here keeps more than one row (plus one network chunk).
 *
 * - openFeed: a URL (fetched) or a local path, gzip detected by its magic bytes, zip refused with a clear message.
 *   A URL with user:password@ in it is sent as HTTP Basic auth instead (Node's fetch refuses credentials in a URL);
 *   neither the URL nor the credentials ever reach a message.
 * - csvRecords: RFC 4180 (quotes, doubled quotes, new lines inside quotes), delimiter guessed from the first line.
 * - jsonItems: the objects of a JSON array, either the root array or the first array under a key such as "Items"
 *   (Impact's API), "products" or "data"; or NDJSON, one object per line.
 */
import { createReadStream, existsSync } from "node:fs";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import type { Fetcher } from "../adapters/types";

/** Splits user:password@ out of a URL so it can go in a header. */
export function credentialsOf(location: string): { url: string; headers: Record<string, string> } {
  try {
    const u = new URL(location);
    if (!u.username && !u.password) return { url: location, headers: {} };
    const auth = Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString("base64");
    u.username = "";
    u.password = "";
    return { url: u.toString(), headers: { Authorization: `Basic ${auth}` } };
  } catch {
    return { url: location, headers: {} };
  }
}

async function* withFirst(first: Uint8Array, rest: AsyncIterator<Uint8Array>): AsyncGenerator<Uint8Array> {
  yield first;
  for (;;) {
    const r = await rest.next();
    if (r.done) return;
    yield r.value;
  }
}

/** Bytes of a feed, decompressed. Throws with a short, secret-free reason. */
export async function openFeed(location: string, fetcher: Fetcher): Promise<AsyncIterable<Uint8Array>> {
  let source: AsyncIterable<Uint8Array>;
  if (/^https?:\/\//i.test(location)) {
    const { url, headers } = credentialsOf(location);
    const res = await fetcher(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    source = res.body ? Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]) : Readable.from([Buffer.from(await res.arrayBuffer())]);
  } else {
    if (!existsSync(location)) throw new Error("file not found");
    source = createReadStream(location, { highWaterMark: 1 << 20 });
  }
  const it = source[Symbol.asyncIterator]();
  const head = await it.next();
  if (head.done) return (async function* () {})();
  const first = head.value instanceof Uint8Array ? head.value : Buffer.from(head.value as string);
  if (first[0] === 0x50 && first[1] === 0x4b) throw new Error("zip compression isn't supported: choose gzip or none");
  const all = Readable.from(withFirst(first, it));
  if (first[0] === 0x1f && first[1] === 0x8b) return all.pipe(createGunzip());
  return all;
}

/** Text of a byte stream, UTF-8, with a leading byte-order mark dropped. */
export async function* textOf(bytes: AsyncIterable<Uint8Array | string>): AsyncGenerator<string> {
  const decoder = new TextDecoder("utf-8");
  let first = true;
  for await (const chunk of bytes) {
    let s = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    if (first && s) {
      s = s.replace(/^﻿/, "");
      first = false;
    }
    if (s) yield s;
  }
  const tail = decoder.decode();
  if (tail) yield tail;
}

function guessDelimiter(firstLine: string) {
  return [",", "|", "\t", ";"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
}

/** CSV records (arrays of fields) as they arrive. Blank lines are skipped. */
export async function* csvRecords(text: AsyncIterable<string>, delimiter?: string): AsyncGenerator<string[]> {
  let delim = delimiter;
  let pending = "";
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  let lastWasCr = false;
  const endRow = function* () {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) yield row;
    row = [];
    field = "";
  };
  for await (const chunk of text) {
    let s = chunk;
    if (!delim) {
      pending += s;
      const nl = pending.search(/[\r\n]/);
      if (nl === -1) continue;
      delim = guessDelimiter(pending.slice(0, nl));
      s = pending;
      pending = "";
    }
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (lastWasCr) {
        lastWasCr = false;
        if (c === "\n") continue;
      }
      if (quoted) {
        if (c === '"') {
          quoted = false;
          afterQuote = true;
        } else field += c;
        continue;
      }
      if (c === '"' && afterQuote) {
        // A doubled quote inside a quoted field: the quote closed and opens again at once.
        field += '"';
        quoted = true;
        afterQuote = false;
        continue;
      }
      if (c === '"' && field === "") {
        quoted = true;
        continue;
      }
      afterQuote = false;
      if (c === delim) {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        lastWasCr = c === "\r";
        yield* endRow();
      } else field += c;
    }
  }
  if (!delim && pending) {
    delim = guessDelimiter(pending);
    yield* csvRecords((async function* () { yield pending; })(), delim);
    return;
  }
  if (field !== "" || row.length) yield* endRow();
}

const ITEM_KEYS = new Set(["items", "products", "data", "results", "catalogitems"]);

/**
 * Objects from a JSON feed, one at a time. Only the object being read is held: the scanner tracks depth and
 * strings, and cuts out each element of the item array.
 */
export async function* jsonItems(text: AsyncIterable<string>): AsyncGenerator<Record<string, unknown>> {
  let depth = 0;
  let inString = false;
  let escape = false;
  /** Depth of the array whose elements we yield, once found. */
  let target = -1;
  let capture: string[] | null = null;
  let captureFrom = -1;
  let rootCapture: string[] | null = null;
  let str = "";
  let lastKey = "";
  let sawColon = false;
  for await (const chunk of text) {
    let segStart = 0;
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (inString) {
        if (escape) escape = false;
        else if (c === "\\") escape = true;
        else if (c === '"') {
          inString = false;
          if (!sawColon) lastKey = str.toLowerCase();
        } else if (str.length < 64) str += c;
        continue;
      }
      if (c === '"') {
        inString = true;
        str = "";
        continue;
      }
      if (c === ":") {
        sawColon = true;
        continue;
      }
      if (c === "," ) {
        sawColon = false;
        continue;
      }
      if (c === "{" || c === "[") {
        if (target === -1 && c === "[" && (depth === 0 || (depth === 1 && sawColon && ITEM_KEYS.has(lastKey)))) {
          target = depth + 1;
          rootCapture = null;
        } else if (target !== -1 && depth === target && c === "{" && !capture) {
          capture = [];
          captureFrom = i;
          segStart = i;
        } else if (target === -1 && depth === 0 && c === "{") {
          rootCapture = [];
          segStart = i;
        }
        depth++;
        sawColon = false;
        continue;
      }
      if (c === "}" || c === "]") {
        depth--;
        sawColon = false;
        if (capture && depth === target && c === "}") {
          capture.push(chunk.slice(captureFrom === -1 ? 0 : segStart, i + 1));
          const obj = JSON.parse(capture.join("")) as Record<string, unknown>;
          capture = null;
          captureFrom = -1;
          yield obj;
        } else if (rootCapture && depth === 0 && c === "}") {
          rootCapture.push(chunk.slice(segStart, i + 1));
          // NDJSON: a root object that held no item array is itself an item.
          if (target === -1) yield JSON.parse(rootCapture.join("")) as Record<string, unknown>;
          rootCapture = null;
        } else if (target !== -1 && depth === target - 1 && c === "]") {
          // The item array ended: nothing after it is an item (Impact puts paging keys around "Items").
          target = -2;
        }
      }
    }
    // Carry the part of an object that runs past this chunk.
    if (capture) {
      capture.push(chunk.slice(captureFrom === -1 ? 0 : segStart));
      captureFrom = -1;
    } else if (rootCapture) {
      rootCapture.push(chunk.slice(segStart));
    }
    segStart = 0;
  }
}

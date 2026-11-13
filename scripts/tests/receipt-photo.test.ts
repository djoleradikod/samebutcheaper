/**
 * Reading a receipt photo. The API can't be called from here, so the client is a stub that answers with a recorded
 * structured output (written by hand in the shape the SDK's parse() returns), and the test checks the request matches
 * the label reader's: same model setting, same beta, same effort, an image block.
 *
 *   npx tsx --test scripts/tests/receipt-photo.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { MAX_PHOTO_LINES, MODEL, readReceiptPhoto, type ReceiptClient } from "../../src/lib/receipt/photo";
import { parseReceipt } from "../../src/lib/receipt/parse";

const root = join(import.meta.dirname, "..", "..");

/** A recorded answer for a photo of a UK supermarket receipt. */
const RECORDED = {
  stop_reason: "end_turn",
  parsed_output: {
    is_receipt: true,
    lines: ["NUROFEN 200MG 16S", "HEINZ TOM KETCHUP 460G", "FAIRY ORIGINAL W/UP 320ML", "  WARBURTONS   TOASTIE 800G ", ""],
  },
};

function stub(answer: unknown | (() => never)) {
  const calls: Record<string, unknown>[] = [];
  const client: ReceiptClient = {
    beta: {
      messages: {
        parse: (async (params: Record<string, unknown>) => {
          calls.push(params);
          if (typeof answer === "function") return (answer as () => never)();
          return answer;
        }) as ReceiptClient["beta"]["messages"]["parse"],
      },
    },
  };
  return { client, calls };
}

test("the request is the label reader's: same model setting, beta, effort and output format", async () => {
  const identify = readFileSync(join(root, "src/app/api/identify/route.ts"), "utf8");
  const model = /const MODEL = (.+);/.exec(identify)?.[1];
  assert.equal(model, 'process.env.PHOTO_MODEL || "claude-opus-5-5"', "the label reader's model setting moved: update photo.ts to match");
  assert.equal(MODEL, process.env.PHOTO_MODEL || "claude-opus-5-5");

  const { client, calls } = stub(RECORDED);
  await readReceiptPhoto("aGVsbG8=", "image/jpeg", client);
  const req = calls[0] as {
    model: string;
    betas: string[];
    fallbacks: string;
    max_tokens: number;
    output_config: { effort: string; format: unknown };
    messages: { content: { type: string; source?: { media_type: string; data: string } }[] }[];
  };
  assert.equal(req.model, MODEL);
  for (const part of ["server-side-fallback-2026-07-01", "\"default\"", "effort: \"low\"", "max_tokens: 8000"]) {
    assert.ok(identify.includes(part), `the label reader no longer sends ${part}`);
  }
  assert.deepEqual(req.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(req.fallbacks, "default");
  assert.equal(req.max_tokens, 8000);
  assert.equal(req.output_config.effort, "low");
  assert.ok(req.output_config.format, "structured output");
  const image = req.messages[0].content[0];
  assert.equal(image.type, "image");
  assert.deepEqual(image.source, { type: "base64", media_type: "image/jpeg", data: "aGVsbG8=" });
});

test("the product lines come back cleaned, ready for the box and the parser", async () => {
  const { client } = stub(RECORDED);
  const out = await readReceiptPhoto("x", "image/png", client);
  assert.deepEqual(out, {
    ok: true,
    lines: ["NUROFEN 200MG 16S", "HEINZ TOM KETCHUP 460G", "FAIRY ORIGINAL W/UP 320ML", "WARBURTONS TOASTIE 800G"],
  });
  if (out.ok) assert.equal(parseReceipt(out.lines.join("\n")).filter((l) => l.kind === "item").length, 4);
});

test("at most MAX_PHOTO_LINES lines, each at most 120 characters", async () => {
  const { client } = stub({ stop_reason: "end_turn", parsed_output: { is_receipt: true, lines: Array.from({ length: 200 }, () => "X".repeat(300)) } });
  const out = await readReceiptPhoto("x", "image/png", client);
  assert.ok(out.ok);
  if (out.ok) {
    assert.equal(out.lines.length, MAX_PHOTO_LINES);
    assert.ok(out.lines.every((l) => l.length <= 120));
  }
});

test("not a receipt, a refusal, an empty read or a malformed answer is a plain 422", async () => {
  for (const answer of [
    { stop_reason: "end_turn", parsed_output: { is_receipt: false, lines: [] } },
    { stop_reason: "refusal", parsed_output: null },
    { stop_reason: "end_turn", parsed_output: { is_receipt: true, lines: ["  "] } },
    { stop_reason: "end_turn", parsed_output: { lines: "not a list" } },
  ]) {
    const out = await readReceiptPhoto("x", "image/png", stub(answer).client);
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.status, 422);
  }
});

test("API errors map to the same answers as the label reader, with no photo in the log", async () => {
  const headers = new Headers();
  const cases: [() => never, number][] = [
    [() => { throw new Anthropic.RateLimitError(429, undefined, "rate limited", headers); }, 503],
    [() => { throw new Anthropic.BadRequestError(400, undefined, "bad image", headers); }, 422],
    [() => { throw new Anthropic.InternalServerError(500, undefined, "down", headers); }, 502],
    [() => { throw new Error("socket hang up"); }, 502],
  ];
  const original = { warn: console.warn, error: console.error };
  const logged: string[] = [];
  console.warn = console.error = (line: string) => logged.push(line);
  try {
    for (const [fail, status] of cases) {
      const out = await readReceiptPhoto("U0VDUkVUUEhPVE8=", "image/png", stub(fail).client);
      assert.equal(out.ok, false);
      if (!out.ok) assert.equal(out.status, status);
    }
  } finally {
    console.warn = original.warn;
    console.error = original.error;
  }
  assert.ok(logged.every((l) => !l.includes("U0VDUkVUUEhPVE8=")), "the photo never reaches the log");
});

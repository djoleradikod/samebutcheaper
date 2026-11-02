/** Copies browser-side binaries from node_modules into public/vendor (gitignored). */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const out = join(import.meta.dirname, "..", "public", "vendor");
mkdirSync(out, { recursive: true });

// zxing-wasm reader used by the barcode-detector ponyfill (src/lib/client/photo.ts).
copyFileSync(require.resolve("zxing-wasm/reader/zxing_reader.wasm"), join(out, "zxing_reader.wasm"));
console.log("Copied zxing_reader.wasm to public/vendor/");

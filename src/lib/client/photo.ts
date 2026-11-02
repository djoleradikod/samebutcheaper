"use client";

/**
 * Photo helpers for /check: read a barcode in the browser (native
 * BarcodeDetector where available, otherwise the zxing-wasm ponyfill served
 * from /vendor), and shrink photos before uploading them.
 */

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;
type Format = (typeof FORMATS)[number];
type Detected = { rawValue: string; format: string };
type Detector = { detect(source: ImageBitmapSource): Promise<Detected[]> };
type DetectorClass = {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
};

let detectorPromise: Promise<Detector | null> | null = null;

async function makeDetector(): Promise<Detector | null> {
  const Native = (globalThis as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) return new Native({ formats });
    } catch {
      /* fall through to the ponyfill */
    }
  }
  try {
    const mod = await import("barcode-detector/ponyfill");
    mod.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/vendor/zxing_reader.wasm" : prefix + path),
      },
    });
    return new mod.BarcodeDetector({ formats: [...FORMATS] as Format[] }) as unknown as Detector;
  } catch {
    return null;
  }
}

/** UPC-E (8 digits) to UPC-A (12 digits), which is how labels are indexed. */
export function upcEtoA(e: string) {
  if (!/^[01]\d{7}$/.test(e)) return e;
  const ns = e[0];
  const d = e.slice(1, 7);
  const check = e[7];
  let m: string;
  switch (d[5]) {
    case "0":
    case "1":
    case "2":
      m = `${d[0]}${d[1]}${d[5]}0000${d[2]}${d[3]}${d[4]}`;
      break;
    case "3":
      m = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
      break;
    case "4":
      m = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
      break;
    default:
      m = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${d[5]}`;
  }
  return `${ns}${m}${check}`;
}

/** The first retail barcode in a photo, or null. */
export async function readBarcode(file: Blob): Promise<string | null> {
  detectorPromise ??= makeDetector();
  const detector = await detectorPromise;
  if (!detector) return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const found = await detector.detect(bitmap);
    const hit = found.find((f) => /^\d{8,14}$/.test(f.rawValue));
    if (!hit) return null;
    return hit.format === "upc_e" ? upcEtoA(hit.rawValue) : hit.rawValue;
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

/** Downscales a photo to at most `max` px on its long side, as JPEG. */
export async function shrinkImage(file: Blob, max = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg" && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
    );
  } finally {
    bitmap.close();
  }
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2, ScanBarcode, Search } from "lucide-react";
import { readBarcode, shrinkImage } from "@/lib/client/photo";
import type { PhotoResult } from "@/app/api/identify/route";

type Status = { kind: "idle" } | { kind: "busy"; text: string } | { kind: "error"; text: string };

/** Compact, URL-safe form of a photo reading, decoded by /check. */
export function photoParam(r: PhotoResult) {
  return JSON.stringify({
    b: r.brand,
    n: r.product_name,
    k: r.kind,
    s: r.size,
    f: r.form,
    a: r.active_ingredients.slice(0, 12).map((a) => [a.name, a.amount]),
    i: r.other_ingredients.slice(0, 40),
    u: r.purpose,
  });
}

export function LookupForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  // A status belongs to the page it was set on, so it clears once the results page loads.
  const here = params.toString();
  const [state, setState] = useState<{ status: Status; at: string }>({ status: { kind: "idle" }, at: here });
  const status: Status = state.at === here ? state.status : { kind: "idle" };
  const setStatus = (next: Status) => setState({ status: next, at: here });
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const busy = status.kind === "busy";

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setStatus({ kind: "busy", text: "Looking for a barcode…" });
      const code = await readBarcode(file);
      if (code) {
        setStatus({ kind: "busy", text: `Found barcode ${code}. Looking it up…` });
        router.push(`/check?upc=${code}`);
        return;
      }
      setStatus({ kind: "busy", text: "No barcode found. Reading the label…" });
      const body = new FormData();
      body.append("image", await shrinkImage(file), "photo.jpg");
      const res = await fetch("/api/identify", { method: "POST", body });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; product?: PhotoResult } | null;
      if (!json?.ok || !json.product) {
        setStatus({
          kind: "error",
          text: json?.error ?? "We couldn't read that photo. Try typing the product name instead.",
        });
        return;
      }
      const r = json.product;
      setStatus({ kind: "busy", text: `Found ${[r.brand, r.product_name].filter(Boolean).join(" ")}. Checking…` });
      const q = r.search_query || [r.brand, r.product_name].filter(Boolean).join(" ");
      const digits = r.barcode.replace(/\D/g, "");
      const upc = /^\d{8}$|^\d{12,14}$/.test(digits) ? `&upc=${digits}` : "";
      router.push(`/check?q=${encodeURIComponent(q)}${upc}&photo=${encodeURIComponent(photoParam(r))}`);
    } catch {
      setStatus({ kind: "error", text: "Something went wrong with that photo. Try again, or type the product name." });
    } finally {
      if (cameraRef.current) cameraRef.current.value = "";
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  return (
    <div className="max-w-2xl">
      <form action="/check" role="search" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            key={params.get("q") ?? ""}
            name="q"
            type="search"
            defaultValue={params.get("q") ?? ""}
            autoFocus={autoFocus}
            placeholder="Product name or barcode"
            aria-label="Product name or barcode number"
            className="h-14 w-full rounded-2xl border border-line bg-surface pr-4 pl-12 text-base placeholder:text-muted sm:text-lg focus:border-accent focus:outline-none"
          />
        </div>
        <button type="submit" className="btn btn-primary h-14 px-5 text-base" disabled={busy}>
          Check
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
          className="btn btn-ghost px-4 py-2.5 text-sm"
        >
          <ScanBarcode className="h-4 w-4" />
          Scan a barcode
          <span className="text-muted">or</span>
          <Camera className="h-4 w-4" />
          snap the label
        </button>
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          <ImageUp className="h-4 w-4" /> Upload a photo
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
      </div>

      <p className="mt-2 min-h-5 text-sm" role="status" aria-live="polite">
        {status.kind === "busy" && (
          <span className="inline-flex items-center gap-2 text-ink-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {status.text}
          </span>
        )}
        {status.kind === "error" && <span className="text-warn">{status.text}</span>}
        {status.kind === "idle" && (
          <span className="text-xs text-muted">
            Barcodes are read on your device. If there&apos;s no barcode, the photo goes to our label reader and
            isn&apos;t stored.
          </span>
        )}
      </p>
    </div>
  );
}

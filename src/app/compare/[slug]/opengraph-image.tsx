import { ImageResponse } from "next/og";
import { getAllPairs, getPair } from "@/lib/catalog";
import { ppu } from "@/lib/format";

export const alt = "SameButCheaper swap";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return getAllPairs().map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pair = getPair(slug);
  const green = "#0b7a4b";
  const lime = "#d9f26a";
  if (!pair) {
    return new ImageResponse(
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#fbfaf6", alignItems: "center", justifyContent: "center", fontSize: 64 }}>
        SameButCheaper
      </div>,
      size,
    );
  }
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#fbfaf6",
          padding: 64,
          fontFamily: "sans-serif",
          color: "#111a15",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
            SameBut<span style={{ color: green }}>Cheaper</span>
          </div>
          <div
            style={{
              display: "flex",
              background: lime,
              color: "#1b2a05",
              fontSize: 44,
              fontWeight: 700,
              padding: "10px 28px",
              borderRadius: 999,
            }}
          >
            Save {Math.round(pair.savingsPct)}%
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
          <div style={{ display: "flex", fontSize: 34, color: "#8b5d4a" }}>Instead of {pair.brand.brand}</div>
          <div style={{ display: "flex", fontSize: 86, fontWeight: 700, lineHeight: 1.05, marginTop: 8 }}>
            Buy {pair.alternative.brand}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#3d4a42", marginTop: 20, maxWidth: 1000 }}>
            {pair.summary.length > 140 ? pair.summary.slice(0, 137) + "…" : pair.summary}
          </div>
        </div>
        <div style={{ display: "flex", marginTop: "auto", gap: 48, fontSize: 36, alignItems: "baseline" }}>
          <div style={{ display: "flex", color: "#6b766f", textDecoration: "line-through" }}>
            {ppu(pair.brand.ppu, pair.currency)}
          </div>
          <div style={{ display: "flex", color: green, fontWeight: 700, fontSize: 56 }}>
            {ppu(pair.alternative.ppu, pair.currency)}
          </div>
          <div style={{ display: "flex", color: "#6b766f" }}>per {pair.brand.unit}</div>
        </div>
      </div>
    ),
    size,
  );
}

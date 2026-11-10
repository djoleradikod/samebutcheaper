import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** The site's own face (Archivo), so a shared card reads like the page it links to. See assets/fonts/README.md. */
const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 800; style: "normal" }[]> | undefined;
function loadFonts() {
  fonts ??= Promise.all([
    font("Archivo-Regular.ttf").then((data) => ({ name: "Archivo", data, weight: 400 as const, style: "normal" as const })),
    font("Archivo-ExtraBold.ttf").then((data) => ({ name: "Archivo", data, weight: 800 as const, style: "normal" as const })),
    font("Archivo-Condensed-ExtraBold.ttf").then((data) => ({ name: "Archivo Condensed", data, weight: 800 as const, style: "normal" as const })),
  ]);
  return fonts;
}
const CONDENSED = '"Archivo Condensed"';

/**
 * Share images in the shelf-ticket look (docs/design/shelf-ticket.md): white paper, ink type, and the yellow ticket only
 * for the saving. What people see when a swap is posted to WhatsApp, Reddit, X or iMessage, so it says the answer:
 * what to buy instead and how much less it costs.
 */
export const OG_SIZE = { width: 1200, height: 630 };

const INK = "#15171c";
const INK_2 = "#40454e";
const MUTED = "#6b7079";
const TICKET = "#ffd60a";
const LINE = "#c9ccd1";

export async function shareImage({
  kicker,
  title,
  sub,
  pct,
  prices,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  /** The saving, shown on the yellow ticket. */
  pct?: number;
  /** Cheaper unit price, the brand's, and the unit ("per tablet"). */
  prices?: { cheap: string; brand: string; unit: string };
}) {
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  const loaded = await loadFonts();
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#ffffff",
          padding: "56px 64px",
          color: INK,
          fontFamily: "Archivo",
          borderTop: `14px solid ${INK}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="48" height="36" viewBox="0 0 32 24">
              <path
                fill={INK}
                fillRule="evenodd"
                d="M3 0h26a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3Zm4.5 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM13 7v10h3V7h-3Zm6 3v7h7v-7h-7Z"
              />
            </svg>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>
              SameBut<span style={{ fontFamily: CONDENSED, fontSize: 40 }}>Cheaper</span>
            </div>
          </div>
          {pct != null && pct > 0 && (
            <div
              style={{
                display: "flex",
                background: TICKET,
                color: INK,
                fontFamily: CONDENSED,
                fontSize: 84,
                fontWeight: 800,
                padding: "6px 26px",
                borderRadius: 4,
                letterSpacing: -2,
              }}
            >
              −{Math.round(pct)}%
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
          {kicker && <div style={{ display: "flex", fontSize: 32, color: INK_2 }}>{clip(kicker, 60)}</div>}
          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 8, letterSpacing: -2 }}>
            {clip(title, 52)}
          </div>
          {sub && (
            <div style={{ display: "flex", fontSize: 28, color: INK_2, marginTop: 20, lineHeight: 1.35, maxWidth: 1060 }}>
              {clip(sub, 150)}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            paddingTop: 22,
            borderTop: `2px solid ${LINE}`,
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          {prices ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
              <div style={{ display: "flex", fontFamily: CONDENSED, fontSize: 72, fontWeight: 800, letterSpacing: -1 }}>{prices.cheap}</div>
              <div style={{ display: "flex", fontFamily: CONDENSED, fontSize: 40, fontWeight: 800, color: MUTED }}>vs {prices.brand}</div>
              <div style={{ display: "flex", fontSize: 30, color: MUTED }}>{prices.unit}</div>
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>Compared per unit, with sources</div>
          )}
          {prices && <div style={{ display: "flex", fontSize: 26, color: MUTED }}>Sources on every swap</div>}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: loaded },
  );
}

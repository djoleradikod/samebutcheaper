"use client";

import { useState } from "react";
import { CATEGORY_TONE } from "@/lib/categories";
import type { CategorySlug } from "@/lib/types";

const SIZES = {
  sm: "h-16 w-16 rounded-xl",
  md: "h-24 w-24 rounded-2xl",
  lg: "h-40 w-full rounded-2xl sm:h-44",
} as const;

type Shape = "bottle" | "pump" | "jar" | "box" | "bag";

const DOSE_FORMS = /tablet|caplet|capsule|softgel|gelcap|gumm|lozenge|chewable|pill/i;
const LIQUID = /fl ?oz|ml|litre|liter|^l$/i;

/** Pick a pack shape that looks like what's on the shelf. */
function shapeFor(category: CategorySlug, unit = ""): Shape {
  if (DOSE_FORMS.test(unit)) return "bottle";
  switch (category) {
    case "pet":
      return "bag";
    case "tech-tools":
      return "box";
    case "beauty-hair":
    case "household":
      return LIQUID.test(unit) ? "pump" : "box";
    case "skincare-personal-care":
      return LIQUID.test(unit) ? "pump" : /oz|g$|gram/i.test(unit) ? "jar" : "box";
    case "food-pantry":
      return /oz|g$|gram|lb|kg/i.test(unit) ? "jar" : "box";
    case "otc-medicine":
    case "supplements":
    case "baby":
      return LIQUID.test(unit) ? "bottle" : "box";
    default:
      return "box";
  }
}

/** Label area of each drawing, in viewBox units (0-100), so the brand name sits on the pack. */
const LABEL: Record<Shape, { x: number; y: number; w: number; h: number }> = {
  bottle: { x: 24, y: 44, w: 52, h: 34 },
  pump: { x: 28, y: 46, w: 44, h: 32 },
  jar: { x: 16, y: 48, w: 68, h: 30 },
  box: { x: 20, y: 38, w: 60, h: 32 },
  bag: { x: 24, y: 40, w: 52, h: 32 },
};

function Pack({ shape, body, ink }: { shape: Shape; body: string; ink: string }) {
  const stroke = { stroke: ink, strokeOpacity: 0.22, strokeWidth: 1.2 };
  const l = LABEL[shape];
  const label = <rect x={l.x} y={l.y} width={l.w} height={l.h} fill="#fff" fillOpacity={0.92} />;
  switch (shape) {
    case "bottle":
      return (
        <>
          <rect x="30" y="8" width="40" height="16" rx="3" fill={ink} />
          <rect x="33" y="24" width="34" height="5" fill={ink} fillOpacity={0.55} />
          <rect x="24" y="29" width="52" height="64" rx="8" fill={body} {...stroke} />
          {label}
        </>
      );
    case "pump":
      return (
        <>
          <rect x="44" y="5" width="22" height="5" rx="2" fill={ink} />
          <rect x="46" y="10" width="7" height="11" fill={ink} fillOpacity={0.7} />
          <rect x="38" y="21" width="24" height="8" rx="2" fill={ink} />
          <rect x="28" y="29" width="44" height="64" rx="10" fill={body} {...stroke} />
          {label}
        </>
      );
    case "jar":
      return (
        <>
          <rect x="20" y="22" width="60" height="14" rx="4" fill={ink} />
          <rect x="16" y="36" width="68" height="56" rx="12" fill={body} {...stroke} />
          {label}
        </>
      );
    case "bag":
      return (
        <>
          <rect x="22" y="8" width="56" height="8" rx="2" fill={ink} />
          <path d="M24 16 H76 L82 91 Q82 94 79 94 H21 Q18 94 18 91 Z" fill={body} {...stroke} />
          {label}
        </>
      );
    default:
      return (
        <>
          <rect x="20" y="12" width="60" height="80" rx="4" fill={body} {...stroke} />
          <rect x="20" y="12" width="60" height="13" rx="4" fill={ink} />
          <rect x="20" y="20" width="60" height="5" fill={ink} />
          {label}
        </>
      );
  }
}

function initials(brand: string) {
  const words = brand.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : brand.slice(0, 2)).toUpperCase();
}

/**
 * A product photo on a white tile. With no licensed photo (or when it fails to
 * load) it draws a simple pack in the category's colours with the brand on the
 * label, so cards look like products and never show a broken image.
 */
export function ProductThumb({
  image,
  brand,
  category,
  unit,
  size = "md",
  className = "",
}: {
  image?: string | null;
  brand: string;
  category: CategorySlug;
  /** The pack unit (tablet, fl oz, oz...), used to pick the drawing. */
  unit?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const tone = CATEGORY_TONE[category];
  const box = `${SIZES[size]} shrink-0 overflow-hidden border border-line ${className}`;

  if (image && !failed) {
    return (
      <div className={`${box} grid place-items-center bg-white p-2`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={brand}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain mix-blend-multiply"
        />
      </div>
    );
  }

  const shape = shapeFor(category, unit);
  const l = LABEL[shape];
  const text = size === "lg" ? brand : size === "md" && brand.length <= 9 ? brand : initials(brand);
  return (
    <div
      aria-hidden="true"
      className={`${box} grid place-items-center`}
      style={{ background: `radial-gradient(circle at 50% 70%, color-mix(in srgb, ${tone.bg} 55%, #fff), #fff 72%)` }}
    >
      <div className="relative aspect-square h-[86%]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-sm">
          <Pack shape={shape} body={tone.bg} ink={tone.fg} />
        </svg>
        <span
          className={`absolute grid place-items-center overflow-hidden px-0.5 text-center leading-tight font-bold tracking-tight ${
            size === "lg" ? "text-sm sm:text-base" : size === "md" ? "text-[10px]" : "text-[9px]"
          }`}
          style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%`, color: tone.fg }}
        >
          <span className="line-clamp-2 break-words">{text}</span>
        </span>
      </div>
    </div>
  );
}

import { CATEGORY_MAP } from "@/lib/categories";
import type { CategorySlug } from "@/lib/types";

/**
 * Fixed sizes for lists, fluid sizes for card grids. `tile` keeps itself square and
 * `fill` takes the size of its parent, so nothing shifts when a photo loads.
 * `tile` sizes follow the card grid: half of a card, 2 across on a phone, 3 then 4 on a desktop.
 */
const SIZES = {
  xs: { box: "h-11 w-11", pixels: 160, sizes: "44px" },
  sm: { box: "h-16 w-16", pixels: 160, sizes: "64px" },
  md: { box: "h-24 w-24", pixels: 160, sizes: "96px" },
  lg: { box: "h-40 w-full sm:h-44", pixels: 480, sizes: "(min-width: 640px) 320px, 45vw" },
  tile: {
    box: "aspect-square w-full",
    pixels: 480,
    sizes: "(min-width: 1320px) 160px, (min-width: 1024px) 12.5vw, (min-width: 768px) 17vw, 25vw",
  },
  fill: { box: "h-full w-full", pixels: 480, sizes: "(min-width: 768px) 90px, 130px" },
} as const;

/** Font size for the name on a label, as a share of the tile: short names large, long ones small enough to fit. */
function labelScale(name: string) {
  const longestWord = Math.max(...name.split(/\s+/).map((w) => w.length));
  return Math.min(24, 170 / longestWord, 300 / name.length);
}

/** "Member's Mark" gives "MM". */
function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w.match(/\p{L}|\p{N}/u)?.[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The real photo, or with no licensed photo a shelf label: the name set large on a quiet tint and
 * a line saying there's no photo, so it can't pass for a pack. Photos are checked to exist when the
 * catalogue is built, so this needs no client code and works on the server.
 */
export function ProductThumb({
  image,
  brand,
  category,
  unit,
  kind,
  size = "md",
  className = "",
  alt,
  eager = false,
  sizes,
  quiet = false,
  flush = false,
}: {
  image?: string | null;
  brand: string;
  /** Describes the photo. Defaults to the brand name. */
  alt?: string;
  /** Set for the largest image on the page so it isn't lazy-loaded. */
  eager?: boolean;
  /** The aisle, named on a label when `kind` isn't given. */
  category?: CategorySlug;
  /** The pack unit (tablet, fl oz, oz...), named on a label when there's nothing better. */
  unit?: string;
  /** What the product is ("Cookware"), for the label's second line. */
  kind?: string;
  size?: keyof typeof SIZES;
  className?: string;
  /** Overrides the `sizes` attribute when the tile's width is known. */
  sizes?: string;
  /** Initials only on a label, for tiles too small to fit the name. */
  quiet?: boolean;
  /** No line or corners of its own, for tiles set edge to edge inside a card. */
  flush?: boolean;
}) {
  const s = SIZES[size];
  const edge = flush ? "" : "rounded-tile border border-line";
  const box = `relative shrink-0 overflow-hidden ${edge} ${s.box} ${className}`;

  if (image) {
    return (
      <div className={`${box} bg-white`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${image}-${s.pixels}.webp`}
          srcSet={`${image}-160.webp 160w, ${image}-480.webp 480w`}
          sizes={sizes ?? s.sizes}
          width={s.pixels}
          height={s.pixels}
          alt={alt ?? brand}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding={eager ? "sync" : "async"}
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>
    );
  }

  const label = `${alt ?? brand}: no photo yet`;
  const tint = `${box} bg-canvas [container-type:size]`;

  if (quiet || size === "xs" || size === "sm") {
    return (
      <div role="img" aria-label={label} className={`${tint} grid place-items-center`}>
        <span className="price text-ink-2" style={{ fontSize: "38cqmin" }}>
          {initials(brand)}
        </span>
      </div>
    );
  }

  const detail = kind ?? (category ? CATEGORY_MAP[category].name : unit);
  return (
    <div role="img" aria-label={label} className={`${tint} flex flex-col text-left`} style={{ padding: "6cqmin" }}>
      <span
        className="price min-h-0 overflow-hidden text-ink [overflow-wrap:anywhere]"
        style={{ fontSize: `clamp(10px, ${labelScale(brand)}cqmin, 44px)`, lineHeight: 1.05 }}
      >
        {brand}
      </span>
      {detail && detail !== brand && (
        <span
          className="mt-[0.3em] truncate leading-tight font-medium text-ink-2"
          style={{ fontSize: "clamp(10px, 9cqmin, 15px)" }}
        >
          {detail}
        </span>
      )}
      <span
        className="mt-auto shrink-0 pt-[0.3em] leading-tight text-muted"
        style={{ fontSize: "clamp(9px, 7.5cqmin, 12px)" }}
      >
        No photo yet
      </span>
    </div>
  );
}

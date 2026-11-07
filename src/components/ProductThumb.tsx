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

/**
 * Font size for the name on a tile, as a share of the tile. The longest word has to fit across it, and all
 * the wrapped lines above the caption. The display face runs about 0.62em a letter.
 */
function nameScale(name: string) {
  const longestWord = Math.max(...name.split(/\s+/).map((w) => w.length));
  return Math.min(26, 140 / longestWord, 90 / Math.sqrt(name.length));
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
 * The real photo, or with no licensed photo a typographic tile: the brand name set large on white under
 * a plain ink band, like a no-frills own-label pack, and a small caption saying there's no photo, so it
 * can't pass for one. Photos are checked to exist when the catalogue is built, so this needs no client
 * code and works on the server.
 */
export function ProductThumb({
  image,
  brand,
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
  /** Still accepted from callers. The tile prints only the brand name now. */
  category?: CategorySlug;
  /** Still accepted from callers. The tile prints only the brand name now. */
  unit?: string;
  /** Still accepted from callers. The tile prints only the brand name now. */
  kind?: string;
  size?: keyof typeof SIZES;
  className?: string;
  /** Overrides the `sizes` attribute when the tile's width is known. */
  sizes?: string;
  /** Initials only on the tile, for tiles too small to fit the name. */
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
  const tile = `${box} bg-white [container-type:size]`;
  const band = <span aria-hidden="true" className="absolute inset-x-0 top-0 bg-ink" style={{ height: "max(3px, 3.5cqmin)" }} />;

  if (quiet || size === "xs" || size === "sm") {
    return (
      <div role="img" aria-label={label} className={`${tile} grid place-items-center`}>
        {band}
        <span className="display text-ink" style={{ fontSize: "36cqmin" }}>
          {initials(brand)}
        </span>
      </div>
    );
  }

  return (
    <div role="img" aria-label={label} className={tile}>
      {band}
      <span className="absolute inset-0 flex flex-col text-left" style={{ padding: "10cqmin 7cqmin 6cqmin" }}>
        <span
          className="display min-h-0 overflow-hidden text-ink [overflow-wrap:anywhere]"
          style={{ fontSize: `clamp(11px, ${nameScale(brand)}cqmin, 64px)`, lineHeight: 1.06 }}
        >
          {brand}
        </span>
        <span
          className="mt-auto shrink-0 pt-[0.3em] leading-tight text-muted"
          style={{ fontSize: "clamp(9px, 6.5cqmin, 11px)" }}
        >
          no photo yet
        </span>
      </span>
    </div>
  );
}

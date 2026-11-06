import type { CategorySlug } from "@/lib/types";

/**
 * Fixed sizes for lists, fluid sizes for card grids. `tile` keeps itself square and
 * `fill` takes the size of its parent, so nothing shifts when a photo loads.
 */
const SIZES = {
  xs: { box: "h-11 w-11", pixels: 160, sizes: "44px" },
  sm: { box: "h-16 w-16", pixels: 160, sizes: "64px" },
  md: { box: "h-24 w-24", pixels: 160, sizes: "96px" },
  lg: { box: "h-40 w-full sm:h-44", pixels: 480, sizes: "(min-width: 640px) 320px, 45vw" },
  tile: { box: "aspect-square w-full", pixels: 480, sizes: "(min-width: 768px) 150px, 24vw" },
  fill: { box: "h-full w-full", pixels: 480, sizes: "(min-width: 768px) 90px, 130px" },
} as const;

type Shape = "bottle" | "pump" | "jar" | "box" | "bag";

const DOSE_FORMS = /tablet|caplet|capsule|softgel|gelcap|gumm|lozenge|chewable|pill/i;
const LIQUID = /fl ?oz|ml|litre|liter|^l$/i;

/** Pick a pack shape that looks like what's on the shelf. */
function shapeFor(category: CategorySlug | undefined, unit = ""): Shape {
  if (DOSE_FORMS.test(unit)) return "bottle";
  switch (category) {
    case "pet":
      return "bag";
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

/** Outline only, with a dashed line: it has to read as a placeholder, never as a photo. */
function PackOutline({ shape }: { shape: Shape }) {
  switch (shape) {
    case "bottle":
      return (
        <>
          <rect x="33" y="10" width="34" height="14" rx="2" />
          <rect x="25" y="29" width="50" height="61" rx="6" />
          <path d="M25 46h50M25 72h50" />
        </>
      );
    case "pump":
      return (
        <>
          <path d="M42 8h20M49 8v13" />
          <rect x="39" y="21" width="22" height="8" rx="1" />
          <rect x="29" y="29" width="42" height="61" rx="8" />
          <path d="M29 48h42M29 74h42" />
        </>
      );
    case "jar":
      return (
        <>
          <rect x="21" y="24" width="58" height="12" rx="2" />
          <rect x="17" y="36" width="66" height="54" rx="9" />
          <path d="M17 52h66M17 76h66" />
        </>
      );
    case "bag":
      return (
        <>
          <path d="M24 12h52l6 76q0 2-3 2H21q-3 0-3-2l6-76Z" />
          <path d="M22 40h56M20 70h60" />
        </>
      );
    default:
      return (
        <>
          <rect x="21" y="12" width="58" height="78" rx="2" />
          <path d="M21 26h58M21 42h58M21 70h58" />
        </>
      );
  }
}

/**
 * A real product photo on a white 4px tile with a 1px line. With no licensed photo it
 * draws an honest outline of a pack and says so. Photos are checked to exist when the
 * catalogue is built, so this needs no client code and works on the server.
 */
export function ProductThumb({
  image,
  brand,
  category,
  unit,
  size = "md",
  className = "",
  alt,
  eager = false,
  sizes,
  quiet = false,
}: {
  image?: string | null;
  brand: string;
  /** Describes the photo. Defaults to the brand name. */
  alt?: string;
  /** Set for the largest image on the page so it isn't lazy-loaded. */
  eager?: boolean;
  category?: CategorySlug;
  /** The pack unit (tablet, fl oz, oz...), used to pick the drawing. */
  unit?: string;
  size?: keyof typeof SIZES;
  className?: string;
  /** Overrides the `sizes` attribute when the tile's width is known. */
  sizes?: string;
  /** Leaves the words off a drawn pack, for tiles too small to fit them. */
  quiet?: boolean;
}) {
  const s = SIZES[size];
  const box = `relative shrink-0 overflow-hidden rounded-tile border border-line bg-white ${s.box} ${className}`;

  if (image) {
    return (
      <div className={box}>
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
          className="absolute inset-0 h-full w-full object-contain p-1"
        />
      </div>
    );
  }

  const showText = !quiet && size !== "xs" && size !== "sm";
  return (
    <div role="img" aria-label={`${alt ?? brand}: no photo yet`} className={`${box} grid place-items-center bg-canvas!`}>
      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 p-1">
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="2"
          strokeDasharray="5 4"
          className="min-h-0 w-full flex-1"
        >
          <PackOutline shape={shapeFor(category, unit)} />
        </svg>
        {showText && <span className="shrink-0 text-center text-[10px] leading-tight text-muted">No photo yet</span>}
      </div>
    </div>
  );
}

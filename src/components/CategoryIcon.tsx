import {
  Baby,
  BatteryFull,
  Car,
  CookingPot,
  Droplet,
  Leaf,
  Paperclip,
  PawPrint,
  Pill,
  Plug,
  Sparkles,
  SprayCan,
  Sprout,
  Wheat,
  Wrench,
  type LucideProps,
} from "lucide-react";
import type { CategoryMeta } from "@/lib/categories";

const ICONS = {
  pill: Pill,
  leaf: Leaf,
  droplet: Droplet,
  sparkles: Sparkles,
  spray: SprayCan,
  baby: Baby,
  paw: PawPrint,
  wheat: Wheat,
  plug: Plug,
  cooking: CookingPot,
  battery: BatteryFull,
  wrench: Wrench,
  paperclip: Paperclip,
  car: Car,
  sprout: Sprout,
} as const;

export function CategoryIcon({ icon, ...props }: { icon: CategoryMeta["icon"] } & LucideProps) {
  const Icon = ICONS[icon];
  return <Icon aria-hidden="true" {...props} />;
}

/**
 * An aisle with no product photo yet: its icon and name on white under the same ink band as a
 * product's typographic tile. Fills its parent. Hidden from screen readers, as the link names the aisle.
 */
export function AisleTile({ icon, name }: { icon: CategoryMeta["icon"]; name: string }) {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-tile border border-line bg-white px-2.5 pt-3.5 pb-2"
    >
      <span className="absolute inset-x-0 top-0 h-1 bg-ink" />
      <CategoryIcon icon={icon} className="h-8 w-8 text-ink" strokeWidth={1.5} />
      <span className="display text-lg text-ink md:text-xl">{name}</span>
    </div>
  );
}

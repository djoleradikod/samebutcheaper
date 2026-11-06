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

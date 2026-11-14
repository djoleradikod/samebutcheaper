import type { ReactNode } from "react";
import { ShopBand } from "@/components/CountryBand";

/** The shopper's country band above every page here (src/components/CountryBand.tsx). */
export default function Layout({ children }: { children: ReactNode }) {
  return <ShopBand>{children}</ShopBand>;
}

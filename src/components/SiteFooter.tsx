import Link from "next/link";
import { getCategoryStats } from "@/lib/catalog";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/check", label: "Check any product" },
  { href: "/biggest-savings", label: "Biggest savings" },
  { href: "/bundles", label: "Bundles" },
  { href: "/bulk", label: "Buy in bulk" },
  { href: "/why", label: "Why it's worth switching" },
  { href: "/brands", label: "Browse by brand" },
  { href: "/ingredients", label: "Browse by ingredient" },
  { href: "/my-list", label: "My savings list" },
  { href: "/how-we-verify", label: "How we check" },
  { href: "/suggest", label: "Suggest a swap" },
  { href: "/about", label: "About" },
  { href: "/credits", label: "Photo credits" },
  { href: "/disclosure", label: "Affiliate disclosure" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteFooter() {
  const aisles = getCategoryStats().filter((c) => c.count > 0);
  return (
    <footer className="mt-16 border-t border-line bg-canvas">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[1.3fr_1fr_1.4fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm text-ink-2">
            We find cheaper products that do the same job as the brand names, show what differs and link the proof.
            No brand pays to be listed or ranked.
          </p>
          <p className="mt-3 text-[13px] text-ink-2">
            As an Amazon Associate we earn from qualifying purchases. That never changes which swaps we list or how we
            rank them.{" "}
            <Link href="/disclosure" className="text-cobalt underline underline-offset-2">
              Read our disclosure
            </Link>
            .
          </p>
        </div>
        <div>
          <h2 className="text-sm">Aisles</h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">
            {aisles.map((a) => (
              <li key={a.slug}>
                <Link href={`/category/${a.slug}`} className="hover:text-ink hover:underline">
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm">SameButCheaper</h2>
          <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm text-ink-2 sm:grid-cols-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-ink hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-4 text-xs text-ink-2">
          Prices change often, so check the current price at the store. Brand names and pack designs belong to their
          owners and are used only to identify the products being compared. Nothing here is medical advice: read the
          label and ask a pharmacist or doctor about medicines and supplements.
        </p>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-muted">
            We find products that match famous brands ingredient for ingredient, then show you the proof. No
            sponsored rankings, no paid placements.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            As an Amazon Associate we earn from qualifying purchases. That never changes which swaps we list or
            how we rank them.{" "}
            <Link href="/disclosure" className="underline underline-offset-2">
              Read our disclosure
            </Link>
            .
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Categories</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="hover:text-ink">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">SameButCheaper</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/biggest-savings" className="hover:text-ink">Biggest savings</Link></li>
            <li><Link href="/how-we-verify" className="hover:text-ink">How we verify</Link></li>
            <li><Link href="/suggest" className="hover:text-ink">Suggest a swap</Link></li>
            <li><Link href="/about" className="hover:text-ink">About</Link></li>
            <li><Link href="/disclosure" className="hover:text-ink">Affiliate disclosure</Link></li>
            <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-5 text-xs leading-relaxed text-muted">
          Information on this site is for general purposes and is not medical advice. Always read the label and
          talk to a pharmacist or doctor about medicines and supplements. Prices change often, so check the
          current price at the retailer. Brand names belong to their owners and are used only to identify the
          products being compared.
        </p>
      </div>
    </footer>
  );
}

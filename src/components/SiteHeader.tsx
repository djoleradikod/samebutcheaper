import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { Logo } from "./Logo";
import { CATEGORIES } from "@/lib/categories";
import { CategoryIcon } from "./CategoryIcon";
import { Dropdown } from "./Dropdown";

const NAV = [
  { href: "/biggest-savings", label: "Biggest savings" },
  { href: "/how-we-verify", label: "How we verify" },
  { href: "/suggest", label: "Suggest a swap" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" aria-label="SameButCheaper home" className="shrink-0">
          <Logo />
        </Link>

        <form action="/search" className="relative ml-2 hidden flex-1 md:block md:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            type="search"
            placeholder="Search a brand, e.g. Advil, Tide, CeraVe"
            aria-label="Search swaps"
            className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </form>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Main">
          <Dropdown
            className="relative"
            summary="Categories"
            summaryClassName="cursor-pointer list-none rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden"
          >
            <div className="card absolute right-0 mt-2 grid w-[34rem] grid-cols-2 gap-1 p-2 shadow-xl">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  className="flex items-start gap-3 rounded-lg p-2.5 hover:bg-surface-2"
                >
                  <CategoryIcon icon={c.icon} className="mt-0.5 h-4 w-4 text-accent" />
                  <span>
                    <span className="block text-sm font-medium">{c.name}</span>
                    <span className="block text-xs text-muted">{c.short}</span>
                  </span>
                </Link>
              ))}
            </div>
          </Dropdown>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <Link href="/search" aria-label="Search" className="rounded-lg p-2 md:hidden">
            <Search className="h-5 w-5" />
          </Link>
          <Dropdown
            className="relative"
            summaryLabel="Menu"
            summary={<Menu className="h-5 w-5" />}
            summaryClassName="cursor-pointer list-none rounded-lg p-2 [&::-webkit-details-marker]:hidden"
          >
            <div className="card absolute right-0 mt-2 w-72 p-2 shadow-xl">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2 font-medium hover:bg-surface-2">
                  {n.label}
                </Link>
              ))}
              <div className="my-2 border-t border-line" />
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"
                >
                  <CategoryIcon icon={c.icon} className="h-4 w-4 text-accent" />
                  {c.name}
                </Link>
              ))}
            </div>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}

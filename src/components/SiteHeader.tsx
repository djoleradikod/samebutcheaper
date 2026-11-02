import Link from "next/link";
import { Bookmark, Menu, Search } from "lucide-react";
import { SavedCount } from "./SaveButton";
import { Logo } from "./Logo";
import { CATEGORIES } from "@/lib/categories";
import { CategoryIcon } from "./CategoryIcon";
import { Dropdown } from "./Dropdown";
import { CountryPicker } from "./CountryPicker";

const NAV = [
  { href: "/check", label: "Check a product" },
  { href: "/biggest-savings", label: "Biggest savings" },
  { href: "/bundles", label: "Bundles" },
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

        <form action="/search" className="relative ml-2 hidden flex-1 md:block md:max-w-sm xl:hidden">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            type="search"
            placeholder="Search a brand, e.g. Advil, Tide, CeraVe"
            aria-label="Search swaps"
            className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </form>

        <nav className="ml-auto hidden items-center gap-1 whitespace-nowrap xl:flex" aria-label="Main">
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
          <Link
            href="/search"
            aria-label="Search swaps"
            className="inline-flex items-center rounded-lg px-2.5 py-2 text-ink-2 hover:text-ink"
          >
            <Search className="h-4 w-4" />
          </Link>
          <Link
            href="/my-list"
            aria-label="My savings list"
            className="inline-flex items-center rounded-lg px-2.5 py-2 text-sm font-medium text-ink-2 hover:text-ink"
          >
            <Bookmark className="h-4 w-4" />
            <SavedCount />
          </Link>
          <CountryPicker className="ml-1" />
        </nav>

        <div className="ml-auto flex items-center gap-1 xl:hidden">
          <Link href="/my-list" aria-label="My savings list" className="inline-flex items-center rounded-lg p-2">
            <Bookmark className="h-5 w-5" />
            <SavedCount />
          </Link>
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
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-muted">Shopping from</span>
                <CountryPicker withName />
              </div>
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

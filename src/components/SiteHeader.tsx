import Link from "@/components/CountryLink";
import { Bookmark, Menu, Search } from "lucide-react";
import { SavedCount } from "./SaveButton";
import { Logo } from "./Logo";
import { Dropdown } from "./Dropdown";
import { CountryPicker } from "./CountryPicker";
import { getCategoryStats } from "@/lib/catalog";
import type { CategorySlug } from "@/lib/types";

const MENU = [
  { href: "/check", label: "Check a product" },
  { href: "/my-list", label: "My savings list" },
  { href: "/biggest-savings", label: "Biggest savings" },
  { href: "/bundles", label: "Bundles" },
  { href: "/bulk", label: "Buy in bulk" },
  { href: "/why", label: "Why not overpay" },
  { href: "/brands", label: "Browse by brand" },
  { href: "/how-we-verify", label: "How we check" },
  { href: "/suggest", label: "Suggest a swap" },
];

/** The right-hand end of the aisle row. */
const SHOP_LINKS = [
  { href: "/biggest-savings", label: "Biggest savings" },
  { href: "/bundles", label: "Bundles" },
  { href: "/bulk", label: "Buy in bulk" },
  { href: "/why", label: "Why not overpay" },
];

/** Short names for the aisle row, so the whole shop fits on one line. */
const AISLE_LABEL: Record<CategorySlug, string> = {
  "food-pantry": "Food",
  household: "Household",
  "skincare-personal-care": "Skincare",
  "beauty-hair": "Beauty",
  baby: "Baby",
  pet: "Pet",
  kitchen: "Kitchen",
  "tech-tools": "Tech",
  batteries: "Batteries",
  "tools-diy": "Tools",
  office: "Office",
  car: "Car",
  garden: "Garden",
  supplements: "Supplements",
  "otc-medicine": "Medicine",
};

export function SiteHeader() {
  // CATEGORIES is in display order: everyday shopping first, medicine last.
  const aisles = getCategoryStats().filter((c) => c.count > 0);
  return (
    <>
      <header className="z-40 border-b border-line bg-paper md:sticky md:top-0">
        <div className="container-page flex flex-wrap items-center gap-x-3 pb-2 md:h-14 md:flex-nowrap md:gap-x-5 md:pb-0">
          {/* The link lies over the logo, so the part that waits for the page's path stays small (see CountryLink). */}
          <span className="relative flex h-12 shrink-0 items-center md:h-full">
            <span aria-hidden="true">
              <Logo />
            </span>
            <Link href="/" aria-label="SameButCheaper home" className="absolute inset-0" />
          </span>

          <form action="/search" role="search" className="relative order-last w-full md:order-none md:w-auto md:flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              name="q"
              type="search"
              placeholder="Search swaps by brand or product"
              aria-label="Search swaps by brand or product"
              className="h-11 w-full rounded-search border border-line-strong bg-paper pr-[4.75rem] pl-9 text-base placeholder:text-muted focus:border-cobalt focus:outline-none md:h-10 md:text-[15px]"
            />
            <button
              type="submit"
              className="absolute top-1 right-1 bottom-1 rounded-[7px] bg-ink px-3 text-sm font-semibold text-white before:absolute before:-inset-1 before:content-[''] hover:bg-ink-2"
            >
              Search
            </button>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
            <Link
              href="/check"
              className="hidden h-9 items-center px-2 text-sm font-medium text-ink-2 hover:text-ink xl:inline-flex"
            >
              Check a product
            </Link>
            <Link
              href="/my-list"
              className="hidden h-11 min-w-11 items-center justify-center px-1.5 text-sm font-medium text-ink-2 hover:text-ink min-[360px]:inline-flex md:h-9"
            >
              <Bookmark className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="sr-only xl:not-sr-only xl:ml-1.5">My list</span>
              <SavedCount />
            </Link>
            <span className="hidden lg:block">
              <CountryPicker withName />
            </span>
            <span className="lg:hidden">
              <CountryPicker />
            </span>
            <Dropdown
              className="relative"
              summaryLabel="Menu"
              summary={<Menu className="h-5 w-5" aria-hidden="true" />}
              summaryClassName="flex h-11 w-11 cursor-pointer list-none items-center justify-center text-ink-2 hover:text-ink md:h-9 md:w-9 [&::-webkit-details-marker]:hidden"
            >
              <div className="card absolute right-0 z-50 mt-1 w-60 p-1 shadow-xl">
                {MENU.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="flex min-h-11 items-center rounded-tile px-3 text-sm font-medium hover:bg-canvas"
                  >
                    {n.label}
                  </Link>
                ))}
              </div>
            </Dropdown>
          </div>
        </div>
      </header>

      <nav aria-label="Aisles" className="border-b border-line bg-paper">
        <div className="container-page">
          {/* Below lg the whole row scrolls sideways. From lg the shop links stay put and only the aisles scroll. */}
          <div className="rail -mx-4 flex items-center overflow-x-auto whitespace-nowrap sm:-mx-6 lg:overflow-visible">
            <ul className="rail flex shrink-0 items-center pl-2 sm:pl-4 lg:min-w-0 lg:flex-1 lg:shrink lg:overflow-x-auto">
              {aisles.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/category/${a.slug}`}
                    title={a.name}
                    className="flex h-11 items-center px-2 text-sm lg:px-1.5 focus-visible:outline-offset-[-2px] font-medium text-ink-2 hover:text-ink hover:underline md:h-10"
                  >
                    {AISLE_LABEL[a.slug]}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="flex shrink-0 items-center pr-2 sm:pr-4 lg:border-l lg:border-line lg:pl-2">
              {SHOP_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="flex h-11 items-center px-2 text-sm focus-visible:outline-offset-[-2px] font-semibold text-ink hover:underline md:h-10"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>
    </>
  );
}

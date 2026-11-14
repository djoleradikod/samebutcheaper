import Link from "@/components/CountryLink";
import { Bookmark, Menu, Search } from "lucide-react";
import { SavedCount } from "./SaveButton";
import { Logo } from "./Logo";
import { Dropdown } from "./Dropdown";
import { CountryPicker } from "./CountryPicker";
import { getCategoryStats } from "@/lib/catalog";
import { dict, getT, type Lang } from "@/lib/i18n";

const MENU = ["/check", "/my-list", "/biggest-savings", "/bundles", "/bulk", "/why", "/brands", "/how-we-verify", "/suggest"];

/** The right-hand end of the aisle row. */
const SHOP_LINKS = ["/biggest-savings", "/bundles", "/bulk", "/why"];

export function SiteHeader({ lang = "en" }: { lang?: Lang }) {
  const t = getT(lang);
  const label = (href: string) => dict(lang).header.links[href];
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
            <Link href="/" aria-label={t("header.home")} className="absolute inset-0" />
          </span>

          <form action={lang === "de" ? "/de/search" : "/search"} role="search" className="relative order-last w-full md:order-none md:w-auto md:flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              name="q"
              type="search"
              placeholder={t("header.searchPlaceholder")}
              aria-label={t("header.searchPlaceholder")}
              className="h-11 w-full rounded-search border border-line-strong bg-paper pr-[4.75rem] pl-9 text-base placeholder:text-muted focus:border-cobalt focus:outline-none md:h-10 md:text-[15px]"
            />
            <button
              type="submit"
              className="absolute top-1 right-1 bottom-1 rounded-[7px] bg-ink px-3 text-sm font-semibold text-white before:absolute before:-inset-1 before:content-[''] hover:bg-ink-2"
            >
              {t("header.search")}
            </button>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
            <Link
              href="/check"
              className="hidden h-9 items-center px-2 text-sm font-medium text-ink-2 hover:text-ink xl:inline-flex"
            >
              {t("header.check")}
            </Link>
            {/* The link is an overlay, like the logo's: a small boundary stays in the first HTML (see CountryLink). */}
            <span className="relative hidden h-11 min-w-11 items-center justify-center px-1.5 text-sm font-medium text-ink-2 hover:text-ink min-[360px]:inline-flex md:h-9">
              <Bookmark className="h-[18px] w-[18px]" aria-hidden="true" />
              <span aria-hidden="true" className="hidden xl:ml-1.5 xl:inline">
                {t("header.myList")}
              </span>
              <SavedCount />
              <Link href="/my-list" aria-label={t("header.myList")} className="absolute inset-0" />
            </span>
            <span className="hidden lg:block">
              <CountryPicker withName />
            </span>
            <span className="lg:hidden">
              <CountryPicker />
            </span>
            <Dropdown
              className="relative"
              summaryLabel={t("header.menu")}
              summary={<Menu className="h-5 w-5" aria-hidden="true" />}
              summaryClassName="flex h-11 w-11 cursor-pointer list-none items-center justify-center text-ink-2 hover:text-ink md:h-9 md:w-9 [&::-webkit-details-marker]:hidden"
            >
              <div className="card absolute right-0 z-50 mt-1 w-60 p-1 shadow-xl">
                {MENU.map((href) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex min-h-11 items-center rounded-tile px-3 text-sm font-medium hover:bg-canvas"
                  >
                    {label(href)}
                  </Link>
                ))}
              </div>
            </Dropdown>
          </div>
        </div>
      </header>

      <nav aria-label={t("header.aisles")} className="border-b border-line bg-paper">
        <div className="container-page">
          {/* Below lg the whole row scrolls sideways. From lg the shop links stay put and only the aisles scroll. */}
          <div className="rail -mx-4 flex items-center overflow-x-auto whitespace-nowrap sm:-mx-6 lg:overflow-visible">
            <ul className="rail flex shrink-0 items-center pl-2 sm:pl-4 lg:min-w-0 lg:flex-1 lg:shrink lg:overflow-x-auto">
              {aisles.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/category/${a.slug}`}
                    title={t(`categories.${a.slug}.name`)}
                    className="flex h-11 items-center px-2 text-sm lg:px-1.5 focus-visible:outline-offset-[-2px] font-medium text-ink-2 hover:text-ink hover:underline md:h-10"
                  >
                    {dict(lang).header.aisleShort[a.slug]}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="flex shrink-0 items-center pr-2 sm:pr-4 lg:border-l lg:border-line lg:pl-2">
              {SHOP_LINKS.map((href) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex h-11 items-center px-2 text-sm focus-visible:outline-offset-[-2px] font-semibold text-ink hover:underline md:h-10"
                  >
                    {label(href)}
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

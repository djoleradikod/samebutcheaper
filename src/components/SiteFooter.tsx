import Link from "@/components/CountryLink";
import { amazonEarns, linksEarn } from "@/lib/affiliate";
import { getCategoryStats } from "@/lib/catalog";
import { Logo } from "./Logo";
import { CountryIndex } from "./CountryIndex";
import { dict, getT, type Lang } from "@/lib/i18n";

const LINKS = [
  "/check",
  "/biggest-savings",
  "/bundles",
  "/bulk",
  "/why",
  "/brands",
  "/ingredients",
  "/my-list",
  "/how-we-verify",
  "/suggest",
  "/about",
  "/credits",
  "/disclosure",
  "/privacy",
  "/impressum",
];

export function SiteFooter({ lang = "en" }: { lang?: Lang }) {
  const t = getT(lang);
  const label = (href: string) =>
    href === "/disclosure" && linksEarn() ? t("footer.affiliateDisclosure") : dict(lang).footer.links[href];
  const aisles = getCategoryStats().filter((c) => c.count > 0);
  return (
    <footer className="mt-16 border-t border-line bg-canvas">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[1.3fr_1fr_1.4fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm text-ink-2">{t("footer.about")}</p>
          <p className="mt-3 text-[13px] text-ink-2">
            {amazonEarns() ? t("footer.amazon") : linksEarn() ? t("footer.someLinks") : t("footer.noLinks")}{" "}
            <Link href="/disclosure" className="text-cobalt underline underline-offset-2">
              {t("footer.readDisclosure")}
            </Link>
            .
          </p>
        </div>
        <div>
          <h2 className="text-sm">{t("footer.aisles")}</h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">
            {aisles.map((a) => (
              <li key={a.slug}>
                <Link href={`/category/${a.slug}`} className="hover:text-ink hover:underline">
                  {t(`categories.${a.slug}.name`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm">SameButCheaper</h2>
          <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm text-ink-2 sm:grid-cols-2">
            {LINKS.map((href) => (
              <li key={href}>
                <Link href={href === "/privacy" ? t("footer.privacyHref") : href} className="hover:text-ink hover:underline">
                  {label(href)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <CountryIndex lang={lang} />
      <div className="border-t border-line">
        <p className="container-page py-4 text-xs text-ink-2">{t("footer.bottom")}</p>
      </div>
    </footer>
  );
}

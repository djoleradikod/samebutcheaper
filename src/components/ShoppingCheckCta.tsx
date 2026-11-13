import Link from "@/components/CountryLink";
import { ListChecks } from "lucide-react";
import { getT, type Lang } from "@/lib/i18n";

/**
 * The way into /check/list from the home page and My list. Static: it names no price, so it can sit outside a
 * CountryPart, and it promises only what the page does.
 */
export function ShoppingCheckCta({ className = "", lang = "en" }: { className?: string; lang?: Lang }) {
  const t = getT(lang);
  return (
    <Link
      href="/check/list"
      className={`card group flex min-h-11 items-center gap-3 p-3 hover:border-ink-2 md:p-4 print:hidden ${className}`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-tile bg-accent-soft text-accent">
        <ListChecks className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold group-hover:underline md:text-base">
          {t("home.cta")}
        </span>
        <span className="block text-[13px] text-ink-2">{t("home.ctaSub")}</span>
      </span>
    </Link>
  );
}

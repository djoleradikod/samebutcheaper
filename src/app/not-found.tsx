import Link from "@/components/CountryLink";
import { getT, type Lang } from "@/lib/i18n";
import { ByLang } from "@/lib/i18n/client";

/** Renders outside the page, so both languages come from the server and ByLang draws the page's one. */
export default function NotFound() {
  return <ByLang en={<Body lang="en" />} de={<Body lang="de" />} />;
}

function Body({ lang }: { lang: Lang }) {
  const t = getT(lang);
  return (
    <section className="container-page py-24 text-center">
      <p className="num text-sm font-medium text-accent">404</p>
      <h1 className="display mt-2 text-4xl font-medium">{t("notFound.title")}</h1>
      <p className="mt-3 text-ink-2">{t("notFound.body")}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/search" className="btn btn-primary">{t("notFound.search")}</Link>
        <Link href="/suggest" className="btn btn-ghost">{t("notFound.suggest")}</Link>
      </div>
    </section>
  );
}

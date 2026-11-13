import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import { getCategoryStats, getPairsByCategory } from "@/lib/catalog";
import { MEDICINE } from "@/lib/browse";
import { PairBrowser } from "@/components/PairBrowser";
import { HealthNotice } from "@/components/Evidence";
import { CountryPart } from "@/components/ForCountry";
import { ListSchema } from "@/components/ListSchema";
import { BestTicket, bestSaving, browseProps, PriceFacts, ShelfHead, swapCount, TagLinks } from "@/components/ShelfParts";
import { forCountry } from "@/lib/localize";
import { getT, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";
import { aisleMetadata, aisleText, lookup } from "./aisle-meta";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  return aisleMetadata((await params).slug);
}

export default async function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const cat = lookup(slug);
  if (!cat) notFound();
  const all = getPairsByCategory(cat.slug);
  const lang = getLang();
  const t = getT(lang);
  const text = aisleText(cat.slug, lang);

  return (
    <div className="bg-canvas pb-8 md:pb-10">
      <ShelfHead
        lang={lang}
        crumbs={[{ href: "/", label: t("lists.home") }, { label: text.name }]}
        title={
          <>
            {t("lists.category.cheaper", text.name)}
            <CountryPart fallback={null}>
              {(local) => {
                const n = forCountry(all, local).length;
                return n > 0 && `: ${swapCount(n, lang)}`;
              }}
            </CountryPart>
          </>
        }
        intro={text.description}
        ticket={<CountryPart fallback={null}>{(local) => <BestTicket best={bestSaving(forCountry(all, local))} lang={lang} />}</CountryPart>}
        facts={
          <CountryPart fallback={null}>
            {(local) => {
              const pairs = forCountry(all, local);
              return pairs.length > 0 && <PriceFacts pairs={pairs} lang={lang} />;
            }}
          </CountryPart>
        }
      />
      <CountryPart>
        {(local) => {
          const pairs = forCountry(all, local);
          return (
            <>
              {cat.slug === MEDICINE && pairs.length > 0 && (
                <div className="container-page mb-4">
                  <HealthNotice lang={lang} />
                </div>
              )}
              <div className="container-page">
                {pairs.length ? <PairBrowser path={`/category/${cat.slug}`} {...browseProps(pairs, { local })} /> : <EmptyAisle lang={lang} />}
              </div>
            </>
          );
        }}
      </CountryPart>
      {all.length > 0 && (
        <ListSchema
          name={`Cheaper ${cat.name}`}
          path={`/category/${cat.slug}`}
          crumbs={[]}
          items={[...all].sort((a, b) => b.savingsPct - a.savingsPct).map((p) => ({ name: p.title, path: `/compare/${p.slug}` }))}
        />
      )}
    </div>
  );
}

function EmptyAisle({ lang }: { lang: Lang }) {
  const t = getT(lang);
  const aisles = getCategoryStats().filter((c) => c.count > 0);
  return (
    <div className="card p-5">
      <p className="font-semibold">{t("lists.category.emptyTitle")}</p>
      <p className="mt-1 text-sm text-ink-2">{t("lists.category.emptyBody")}</p>
      <p className="mt-3">
        <Link href="/suggest" className="btn btn-primary">
          {t("lists.category.suggest")}
        </Link>
      </p>
      {aisles.length > 0 && (
        <div className="mt-4">
          <TagLinks links={aisles.map((a) => ({ href: `/category/${a.slug}`, label: aisleText(a.slug, lang).name }))} />
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, Camera, Check, Megaphone, ScanBarcode, Search, ShieldCheck, Scale } from "lucide-react";
import {
  getAllBundles,
  getAllPairs,
  getIngredients,
  getBiggestDollarSavings,
  getCategoryStats,
  getFeaturedPairs,
  getSiteStats,
  toSummary,
} from "@/lib/catalog";
import { FeaturedPairs } from "@/components/FeaturedPairs";
import { BundleCard } from "@/components/BundleCard";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MatchBadge, SavingsBadge } from "@/components/Badges";
import { NewsletterForm } from "@/components/NewsletterForm";
import { MATCH_TYPE_META } from "@/lib/categories";
import { MARKET_CODES } from "@/lib/markets";
import { money, ppu } from "@/lib/format";
import type { MatchType } from "@/lib/types";

const FAQ = [
  {
    q: "If they're the same, why is the brand so much more expensive?",
    a: "Mostly advertising, packaging and shelf placement. In the US, UK, Canada and Germany, an over-the-counter medicine has to meet the same regulator's rules for its active ingredient whatever name is on the box, and every medicine swap here has the same active ingredient at the same strength. The lower price comes from skipping the TV ads, not from cutting the active ingredient.",
  },
  {
    q: "How do you decide two products are “the same”?",
    a: "We only list a swap when the evidence fits one of four standards: the same active ingredient at the same strength, the same formula per the label, the same manufacturer, or an equivalent spec. Every swap says which standard it meets, shows what is the same and what is different point by point, and links to at least two sources.",
  },
  {
    q: "How do you make money?",
    a: "Some links are affiliate links, so we may earn a small commission if you buy, at no extra cost to you. No brand or store pays to be listed or ranked. Swaps are ranked by how much you save, and we show where the brand is better too.",
  },
  {
    q: "Are the prices current?",
    a: "Prices are typical shelf prices from the month shown on each swap, and they change often. Price per unit is what matters, and the gap is usually large enough that day-to-day price changes don't close it. Always check the price at the retailer.",
  },
  {
    q: "Is this medical advice?",
    a: "No. We compare labels and published evidence. Inactive ingredients can differ, which matters if you have allergies. Read the label, and talk to a pharmacist or doctor about medicines and supplements.",
  },
];

export default function Home() {
  const stats = getSiteStats();
  const featured = Object.fromEntries(
    MARKET_CODES.map((m) => [m, getFeaturedPairs(12, m).map(toSummary)]).filter(([, list]) => list.length),
  );
  const dollar = getBiggestDollarSavings(6);
  const categories = getCategoryStats().filter((c) => c.count > 0);
  const hero = getAllPairs()[0];
  const bundles = getAllBundles().slice(0, 3);
  const topIngredients = getIngredients().slice(0, 18);
  const chips = Array.from(new Set(getAllPairs().slice(0, 40).map((p) => p.brand.brand))).slice(0, 7);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="hero-wash relative overflow-hidden border-b border-line">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:radial-gradient(var(--line)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />
        <div className="container-page relative grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="num inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {stats.pairs} verified swaps · on average {Math.round(stats.avgSavings)}% cheaper
            </p>
            <h1 className="display mt-5 text-[2.6rem] leading-[1.05] font-medium sm:text-6xl">
              Same ingredients.
              <br />
              Same job.
              <br />
              <span className="highlight">Less money.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
              Big brands spend billions telling you they&apos;re different. We read the labels. These are the
              cheaper products with the <em>same active ingredients or formula</em>, with the sources to prove
              it and an honest list of what differs.
            </p>

            <form action="/search" className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" />
                <input
                  name="q"
                  type="search"
                  aria-label="Search for a brand or product"
                  placeholder="What do you usually buy?"
                  className="h-14 w-full rounded-2xl border border-line-strong bg-surface pr-4 pl-12 text-base shadow-sm placeholder:text-muted focus:border-accent focus:outline-none"
                />
              </div>
              <button type="submit" className="btn btn-primary h-14 rounded-2xl px-6">
                Find it cheaper
              </button>
            </form>
            {chips.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Try:</span>
                {chips.map((c) => (
                  <Link
                    key={c}
                    href={`/search?q=${encodeURIComponent(c)}`}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-ink-2 hover:border-accent hover:text-accent"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            )}
            <Link
              href="/check"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              <ScanBarcode className="h-4 w-4" />
              Not on our list? Check any product by name, barcode or photo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {hero && <HeroReceipt pair={hero} />}
        </div>
      </section>

      {/* ---------- Biggest savings ---------- */}
      <section className="container-page py-16">
        <SectionHeading
          eyebrow="Ranked by savings"
          title="The biggest savings right now"
          body="The swaps that cut the most, ranked by price per unit and how much you save on every pack."
          href="/biggest-savings"
          cta="See all swaps"
        />
        <FeaturedPairs lists={featured} />
      </section>

      {/* ---------- Product check ---------- */}
      <section className="container-page pb-16">
        <div className="card flex flex-col gap-6 overflow-hidden p-6 sm:p-8 md:flex-row md:items-center">
          <div className="flex shrink-0 gap-3 text-accent">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft">
              <ScanBarcode className="h-7 w-7" />
            </span>
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft">
              <Camera className="h-7 w-7" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="display text-2xl font-medium sm:text-3xl">Check what&apos;s in your cabinet</h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-2">
              Scan a barcode or snap a label. We read the official label, tell you what it&apos;s for and what&apos;s
              really in it, and show cheaper products with the same ingredients from stores that deliver to you.
            </p>
          </div>
          <Link href="/check" className="btn btn-primary shrink-0 px-6 py-3">
            Check a product <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ---------- Bundles ---------- */}
      {bundles.length > 0 && (
        <section className="container-page pb-16">
          <SectionHeading
            eyebrow="Kits, sets and stacks"
            title="Brand bundles, rebuilt for less"
            body="Regimens and kits taken apart item by item, then rebuilt from cheaper products with the same ingredients."
            href="/bundles"
            cta="All bundles"
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.map((b) => (
              <BundleCard key={b.slug} bundle={b} />
            ))}
          </div>
        </section>
      )}

      {/* ---------- Categories ---------- */}
      <section className="border-y border-line bg-tint">
        <div className="container-page py-16">
          <SectionHeading eyebrow="Browse" title="Every aisle, cheaper" />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="group flex items-center gap-4 rounded-2xl border border-line bg-paper p-5 transition hover:border-accent"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <CategoryIcon icon={c.icon} className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.name}</span>
                  <span className="num block text-sm text-muted">
                    {c.count} swaps · up to {Math.round(c.maxSavings)}% off
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
              </Link>
            ))}
          </div>
          {topIngredients.length > 0 && (
            <div className="mt-10">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">Or start from the ingredient on the label</h3>
                <Link href="/ingredients" className="text-sm font-semibold text-accent hover:underline">
                  All ingredients →
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {topIngredients.map((i) => (
                  <Link
                    key={i.slug}
                    href={`/ingredient/${i.slug}`}
                    className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent"
                  >
                    {i.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Why cheaper ---------- */}
      <section className="container-page py-16">
        <SectionHeading eyebrow="The short version" title="Why the same thing costs less" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Explainer
            icon={<Megaphone className="h-5 w-5" />}
            title="You're paying for the ads"
            body="A big share of a famous brand's price goes to marketing, packaging and shelf placement. Store brands skip most of that."
          />
          <Explainer
            icon={<Scale className="h-5 w-5" />}
            title="The rules require it"
            body="OTC medicines and infant formula must meet the same FDA standards, whoever's name is on the box. Disinfectants share EPA registrations."
          />
          <Explainer
            icon={<ShieldCheck className="h-5 w-5" />}
            title="We show the receipts"
            body="Each swap lists the ingredients side by side, the standard it meets, any real differences, and the sources we checked."
          />
        </div>
      </section>

      {/* ---------- Match standards ---------- */}
      <section className="border-y border-line bg-tint">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-sm font-medium text-accent">Our standard</p>
            <h2 className="display mt-2 text-3xl font-medium sm:text-4xl">“Looks similar” doesn&apos;t count.</h2>
            <p className="mt-4 leading-relaxed text-ink-2">
              Smells alike, looks alike, has a similar name: none of that gets a product listed. Every swap has
              to meet one of these four standards, and we tell you which one.
            </p>
            <Link href="/how-we-verify" className="btn btn-ghost mt-6">
              How we verify <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(MATCH_TYPE_META) as MatchType[]).map((t) => (
              <div key={t} className="rounded-2xl border border-line bg-paper p-5">
                <MatchBadge type={t} long />
                <p className="mt-3 text-sm leading-relaxed text-ink-2">{MATCH_TYPE_META[t].description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Dollar savings ---------- */}
      {dollar.length > 0 && (
        <section className="container-page py-16">
          <SectionHeading
            eyebrow="Biggest in cash"
            title="Where the switch saves the most cash"
            body="Based on buying the same amount as one brand-name pack."
          />
          <ol className="card mt-8 divide-y divide-line">
            {dollar.map((p, i) => (
              <li key={p.slug}>
                <Link
                  href={`/compare/${p.slug}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-surface-2 sm:flex-nowrap"
                >
                  <span className="num w-6 text-sm text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{p.brand.brand}</span>
                    <span className="text-muted"> → </span>
                    <span className="font-medium text-accent">{p.alternative.brand}</span>
                    <span className="block truncate text-sm text-muted">{p.subcategory}</span>
                  </span>
                  <span className="num text-right">
                    <span className="block font-semibold">{money(p.savingsPerPack, p.currency)} saved</span>
                    <span className="block text-xs text-muted">{Math.round(p.savingsPct)}% cheaper</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ---------- Newsletter ---------- */}
      <section className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-12 text-paper sm:px-12">
          <div className="relative grid items-center gap-8 lg:grid-cols-2">
            <div>
              <h2 className="display text-3xl font-medium sm:text-4xl">
                New swaps, the week we <span className="text-highlight">verify</span> them.
              </h2>
              <p className="mt-3 text-paper/70">
                We add new swaps every week. Get them by email, along with the occasional big price drop.
              </p>
            </div>
            <div className="[&_input]:border-white/20 [&_input]:bg-white/10 [&_input]:text-paper [&_p]:text-paper/70">
              <NewsletterForm source="home" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="container-page py-16">
        <SectionHeading eyebrow="Questions" title="Fair questions" />
        <div className="mt-8 grid gap-3 lg:grid-cols-2">
          {FAQ.map((f) => (
            <details key={f.q} className="card group p-5 open:border-line-strong">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="mt-0.5 text-muted transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted">
          Know a swap we&apos;re missing?{" "}
          <Link href="/suggest" className="font-medium text-accent underline underline-offset-2">
            Suggest it
          </Link>{" "}
          and we&apos;ll check it out.
        </p>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
  href,
  cta,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-accent">{eyebrow}</p>
        <h2 className="display mt-1 text-3xl font-medium sm:text-4xl">{title}</h2>
        {body && <p className="mt-2 text-ink-2">{body}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
          {cta} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function Explainer({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card p-6">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

function HeroReceipt({ pair }: { pair: ReturnType<typeof getAllPairs>[number] }) {
  const rows = pair.alternative.key_ingredients.slice(0, 4);
  return (
    <Link
      href={`/compare/${pair.slug}`}
      className="group relative mx-auto block w-full max-w-md rotate-[0.6deg] transition hover:rotate-0"
    >
      <div className="card overflow-hidden shadow-[0_30px_60px_-25px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between border-b border-dashed border-line-strong bg-surface-2 px-5 py-3">
          <span className="text-xs font-semibold tracking-widest text-muted uppercase">Swap #1</span>
          <SavingsBadge pct={pair.savingsPct} />
        </div>
        <div className="grid grid-cols-2 divide-x divide-dashed divide-line-strong">
          <div className="p-5">
            <p className="text-xs text-brand-tone">Brand name</p>
            <p className="mt-1 font-semibold">{pair.brand.brand}</p>
            <p className="num mt-3 text-2xl text-muted line-through decoration-brand-tone/50">
              {ppu(pair.brand.ppu, pair.currency)}
            </p>
            <p className="text-xs text-muted">per {pair.brand.unit}</p>
          </div>
          <div className="bg-accent-soft/50 p-5">
            <p className="text-xs text-accent">Cheaper match</p>
            <p className="mt-1 font-semibold">{pair.alternative.brand}</p>
            <p className="num mt-3 text-2xl font-semibold text-accent">{ppu(pair.alternative.ppu, pair.currency)}</p>
            <p className="text-xs text-muted">per {pair.alternative.unit}</p>
          </div>
        </div>
        {rows.length > 0 && (
          <ul className="space-y-2 border-t border-dashed border-line-strong px-5 py-4 text-sm">
            {rows.map((r) => (
              <li key={r.name} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-accent" />
                <span className="flex-1 truncate">{r.name}</span>
                <span className="num text-muted">{r.amount}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
          <MatchBadge type={pair.match_type} />
          <span className="inline-flex items-center gap-1 font-medium text-accent">
            See the proof <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

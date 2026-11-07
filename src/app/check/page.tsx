import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { ArrowRight, Barcode, Camera, FlaskConical, Search, Store } from "lucide-react";
import { LookupForm } from "@/components/LookupForm";
import { PairCard } from "@/components/PairCard";
import { ProductReport } from "@/components/ProductReport";
import { toSummary } from "@/lib/catalog";
import {
  detailFor,
  isGtin,
  productFromBarcode,
  productFromSource,
  searchProducts,
  SOURCE_LABEL,
  type Candidate,
  type LookupProduct,
  type LookupSource,
} from "@/lib/lookup";
import { logLookup } from "@/lib/lookup/log";
import type { CategorySlug } from "@/lib/types";
import { forCountry } from "@/lib/localize";
import { getCountry, getLocal } from "@/lib/server-country";

export const metadata: Metadata = {
  title: "Check any product: ingredients, uses and cheaper swaps",
  description:
    "Search a product name, scan its barcode or snap the label. See what's in it, what it's for, and cheaper products that deliver to your country, with what each one matches on.",
  alternates: { canonical: "/check" },
};

export default function CheckPage({ searchParams }: PageProps<"/check">) {
  return (
    <>
      <section className="hero-wash border-b border-line">
        <div className="container-page py-10 md:py-14">
          <p className="text-sm font-medium text-accent">Product check</p>
          <h1 className="display mt-1 max-w-3xl text-4xl font-medium sm:text-5xl">
            What&apos;s in it, what it&apos;s for, and what costs less
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">
            Type a product, scan its barcode or snap the label. We read the official label data and show cheaper
            products from stores that deliver where you live, with what each one matches on.
          </p>
          <div className="mt-7">
            <Suspense fallback={<div className="h-14 max-w-2xl rounded-2xl border border-line bg-paper" />}>
              <LookupForm />
            </Suspense>
          </div>
        </div>
      </section>
      <div className="container-page py-10">
        <Suspense fallback={<ResultsSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

function one(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() ? s.trim().slice(0, 2000) : null;
}

const photoSchema = z.object({
  b: z.string().max(120).default(""),
  n: z.string().max(200).default(""),
  k: z.string().max(20).default("other"),
  s: z.string().max(80).default(""),
  f: z.string().max(40).default(""),
  a: z.array(z.tuple([z.string().max(120), z.string().max(60)])).max(30).default([]),
  i: z.array(z.string().max(200)).max(80).default([]),
  u: z.string().max(400).default(""),
});

const PHOTO_CATEGORY: Partial<Record<LookupProduct["kind"], CategorySlug>> = {
  medicine: "otc-medicine",
  supplement: "supplements",
  cosmetic: "skincare-personal-care",
  food: "food-pantry",
  pet: "pet",
};

/** A product built from what our label reader saw in the shopper's photo. */
function productFromPhoto(raw: string): LookupProduct | null {
  let parsed;
  try {
    parsed = photoSchema.safeParse(JSON.parse(raw));
  } catch {
    return null;
  }
  if (!parsed.success) return null;
  const r = parsed.data;
  const kind = (["medicine", "supplement", "cosmetic", "food", "pet"] as const).find((k) => k === r.k) ?? "other";
  const category = PHOTO_CATEGORY[kind] ?? null;
  return {
    source: "photo",
    id: "photo",
    url: null,
    brand: r.b,
    name: r.n || r.b || "Your product",
    kind,
    category,
    size: r.s,
    form: r.f.toLowerCase(),
    upc: null,
    actives: r.a.map(([name, amount]) => ({ name, amount })),
    ingredients: r.i,
    uses: r.u ? [r.u] : [],
    directions: null,
    warnings: [],
    countries: [],
    manufacturer: null,
    image: null,
  };
}

async function Results({ searchParams }: { searchParams: PageProps<"/check">["searchParams"] }) {
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 120) ?? null;
  const src = one(sp.src);
  const id = one(sp.id);
  const photo = one(sp.photo);
  const typedCode = q && /^[\d\s-]{8,18}$/.test(q) ? q : "";
  const digits = (one(sp.upc) ?? typedCode).replace(/\D/g, "");
  const reqHeaders = new Headers(await headers());
  const country = await getCountry();
  const local = await getLocal();

  // 1. A product picked from the results list.
  if (src && id) {
    const [product, failed] = await productFromSource(src, id);
    if (!product) return <NothingFound failed={failed ? [failed] : []} what="that product" />;
    const detail = await detailFor(product, country);
    after(() =>
      logLookup(
        { kind: "product", source: src, sourceId: id, productName: `${product.brand} ${product.name}`, verified: detail.verified.length > 0 },
        reqHeaders,
        country,
      ),
    );
    return <ProductReport detail={detail} from="lookup" />;
  }

  const fromPhoto = photo ? productFromPhoto(photo) : null;

  // 2. A barcode, typed or scanned.
  if (digits && isGtin(digits)) {
    const { product, failed } = await productFromBarcode(digits);
    if (product) {
      const detail = await detailFor(product, country);
      after(() =>
        logLookup(
          { kind: "barcode", query: digits, source: product.source, sourceId: product.id, productName: `${product.brand} ${product.name}`, verified: detail.verified.length > 0 },
          reqHeaders,
          country,
        ),
      );
      return <ProductReport detail={detail} from="lookup" />;
    }
    if (!fromPhoto) {
      after(() => logLookup({ kind: "barcode", query: digits }, reqHeaders, country));
      return <NothingFound failed={failed} what={`barcode ${digits}`} barcode />;
    }
  } else if (digits && !q?.match(/[a-z]/i)) {
    return <NothingFound failed={[]} what={`${digits}`} invalidBarcode />;
  }

  // 3. A label read from a photo.
  if (fromPhoto) {
    const [detail, outcome] = await Promise.all([detailFor(fromPhoto, country), q ? searchProducts(q) : null]);
    return (
      <div className="space-y-10">
        <ProductReport detail={detail} from="lookup" />
        {outcome && outcome.candidates.length > 0 && (
          <Candidates q={q!} candidates={outcome.candidates} title="The same product in label databases" />
        )}
      </div>
    );
  }

  // 4. A name search.
  if (q) {
    const outcome = await searchProducts(q);
    after(() => logLookup({ kind: "text", query: q, verified: outcome.catalog.length > 0 }, reqHeaders, country));
    const swaps = forCountry(outcome.catalog, local);
    if (!swaps.length && !outcome.candidates.length) {
      return <NothingFound failed={outcome.failed} what={`“${q}”`} />;
    }
    return (
      <div className="space-y-10">
        {swaps.length > 0 && (
          <section>
            <h2 className="display text-2xl font-medium">Swaps already in our catalogue</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {swaps.map((p) => (
                <PairCard key={p.slug} pair={toSummary(p)} />
              ))}
            </div>
          </section>
        )}
        {outcome.candidates.length > 0 && (
          <Candidates q={q} candidates={outcome.candidates} title="Pick your product to see what's in it" />
        )}
        <FailedNote failed={outcome.failed} />
      </div>
    );
  }

  return <HowItWorks />;
}

function Candidates({ q, candidates, title }: { q: string; candidates: Candidate[]; title: string }) {
  return (
    <section>
      <h2 className="display text-2xl font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted">Results for “{q}” from public label databases.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {candidates.map((c) => (
          <li key={`${c.source}-${c.id}`}>
            <Link
              href={`/check?src=${c.source}&id=${encodeURIComponent(c.id)}`}
              className="card flex h-full items-center gap-4 p-4 hover:border-accent"
            >
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.image}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 shrink-0 rounded-lg border border-line bg-white object-contain"
                />
              ) : (
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <FlaskConical className="h-6 w-6" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.brand || c.name}</span>
                <span className="block truncate text-sm text-ink-2">{c.brand ? c.name : ""}</span>
                <span className="block truncate text-xs text-muted">
                  {[c.detail, SOURCE_LABEL[c.source]].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-accent" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FailedNote({ failed }: { failed: LookupSource[] }) {
  if (!failed.length) return null;
  return (
    <p className="text-xs text-muted">
      Some databases didn&apos;t answer just now ({failed.map((f) => SOURCE_LABEL[f]).join(", ")}). Try again in a
      minute for more results.
    </p>
  );
}

function NothingFound({
  failed,
  what,
  barcode = false,
  invalidBarcode = false,
}: {
  failed: LookupSource[];
  what: string;
  barcode?: boolean;
  invalidBarcode?: boolean;
}) {
  return (
    <div className="card max-w-2xl p-8">
      <p className="text-lg font-semibold">
        {invalidBarcode ? `${what} isn't a valid barcode number.` : `We couldn't find ${what}.`}
      </p>
      <p className="mt-2 text-ink-2">
        {invalidBarcode
          ? "Check the digits under the barcode, or search by the product's name."
          : barcode
            ? "It isn't in the open label databases yet. Search by the product's name instead, or snap the label so we can read it."
            : "Try the brand and product name as printed on the pack, for example “Advil 200 mg” or “CeraVe moisturizing cream”."}
      </p>
      <FailedNote failed={failed} />
      <p className="mt-4 text-sm">
        <Link href="/suggest" className="text-accent underline underline-offset-2">
          Tell us what you were looking for
        </Link>{" "}
        and we&apos;ll research it.
      </p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Search,
      title: "Search, scan or snap",
      text: "Type the name, scan the barcode, or photograph the label. Barcodes are read on your phone.",
    },
    {
      icon: Barcode,
      title: "We read the official label",
      text: "FDA drug labels, the NIH supplement label database, and the open beauty and food databases.",
    },
    {
      icon: FlaskConical,
      title: "See what's really in it",
      text: "Active ingredients and strengths, what it's for, how to use it and the main warnings.",
    },
    {
      icon: Store,
      title: "Find what costs less",
      text: "Swaps from our catalogue, store brands with the same active ingredients on the label, and stores that deliver to your country.",
    },
  ];
  const examples = ["Claritin", "Zyrtec", "Centrum Silver", "Mucinex", "Nature Made fish oil", "CeraVe"];
  return (
    <div className="space-y-10">
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="card p-5">
            <s.icon className="h-6 w-6 text-accent" />
            <p className="mt-3 font-semibold">
              <span className="num mr-1.5 text-muted">{i + 1}.</span>
              {s.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.text}</p>
          </li>
        ))}
      </ol>
      <div>
        <p className="text-sm font-medium text-muted">Try one:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {examples.map((e) => (
            <Link
              key={e}
              href={`/check?q=${encodeURIComponent(e)}`}
              className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm hover:border-accent"
            >
              {e}
            </Link>
          ))}
        </div>
      </div>
      <p className="flex items-center gap-2 text-sm text-muted">
        <Camera className="h-4 w-4" /> On a phone, “Scan a barcode” opens your camera.
      </p>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Checking the label databases">
      <div className="h-6 w-64 animate-pulse rounded bg-surface-2" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-24 animate-pulse bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

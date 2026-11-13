import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPairs, getPair } from "@/lib/catalog";
import { swapMetadata, SwapView } from "./SwapView";

export function generateStaticParams() {
  const params = getAllPairs().map((p) => ({ slug: p.slug }));
  // Cache Components needs at least one param to check the route. This one renders the 404.
  return params.length ? params : [{ slug: "__no-swaps__" }];
}

export async function generateMetadata({ params }: PageProps<"/compare/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return swapMetadata(slug, null);
}

export default async function ComparePage({ params }: PageProps<"/compare/[slug]">) {
  const { slug } = await params;
  const record = getPair(slug);
  if (!record) notFound();
  return <SwapView record={record} country={null} />;
}

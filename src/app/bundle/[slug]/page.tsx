import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllBundles, getBundle } from "@/lib/catalog";
import { kitMetadata, KitView } from "./KitView";

export function generateStaticParams() {
  const bundles = getAllBundles();
  // Cache Components requires at least one param; the placeholder 404s.
  return bundles.length ? bundles.map((b) => ({ slug: b.slug })) : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/bundle/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return kitMetadata(slug, null);
}

export default async function BundlePage({ params }: PageProps<"/bundle/[slug]">) {
  const { slug } = await params;
  const record = getBundle(slug);
  if (!record) notFound();
  return <KitView record={record} country={null} />;
}

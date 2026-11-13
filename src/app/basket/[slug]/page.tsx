import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPresets, getPreset } from "@/lib/catalog";
import { basketMetadata, BasketView } from "./BasketView";

export function generateStaticParams() {
  const presets = getAllPresets();
  // Cache Components requires at least one param; the placeholder 404s.
  return presets.length ? presets.map((p) => ({ slug: p.slug })) : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/basket/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return basketMetadata(slug, null);
}

export default async function BasketPage({ params }: PageProps<"/basket/[slug]">) {
  const { slug } = await params;
  const record = getPreset(slug);
  if (!record) notFound();
  return <BasketView record={record} country={null} />;
}

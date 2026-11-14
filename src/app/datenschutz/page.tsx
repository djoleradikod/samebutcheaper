import type { Metadata } from "next";
import { PrivacyPolicy } from "@/components/PrivacyPolicy";
import { policy } from "@/lib/i18n/de/datenschutz";

/** The privacy policy in German, for the German pages' footer (src/lib/i18n/de/datenschutz.ts). */
export const metadata: Metadata = {
  title: policy.meta.title,
  description: policy.meta.description,
  alternates: { canonical: "/datenschutz" },
};

export default function DatenschutzPage() {
  return <PrivacyPolicy text={policy} />;
}

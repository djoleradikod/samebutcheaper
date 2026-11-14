import type { Metadata } from "next";
import { PrivacyPolicy } from "@/components/PrivacyPolicy";
import { policy } from "@/lib/i18n/en/privacy";

/** The privacy policy in English (src/lib/i18n/en/privacy.ts), in step with the German /datenschutz. */
export const metadata: Metadata = {
  title: policy.meta.title,
  description: policy.meta.description,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <PrivacyPolicy text={policy} />;
}

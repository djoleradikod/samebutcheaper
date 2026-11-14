import { consentActive, gatedStores } from "@/lib/consent";
import { getT, type Lang } from "@/lib/i18n";
import { ConsentChoice, ConsentReopen } from "./ConsentChoice";

/** "amazon", "boots" -> "Amazon and Boots" in the page's language. */
function storeNames(lang: Lang) {
  const names = gatedStores().map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  const and = lang === "de" ? " und " : " and ";
  return names.length > 1 ? `${names.slice(0, -1).join(", ")}${and}${names[names.length - 1]}` : names.join("");
}

/**
 * The consent choice for the root layout (src/lib/consent.ts). Renders nothing, and ships no script, while no
 * programme asks for consent, which is the case today.
 */
export function ConsentSlot({ lang = "en" }: { lang?: Lang }) {
  if (!consentActive()) return null;
  const t = getT(lang);
  const text = { heading: t("consent.heading"), body: t("consent.body", storeNames(lang)), allow: t("consent.allow"), decline: t("consent.decline"), policy: t("consent.policy") };
  return <ConsentChoice text={text} policyHref={lang === "de" ? "/datenschutz" : "/privacy"} />;
}

/** The footer's "Privacy choices" item, only while there is a choice to make. */
export function ConsentFooterItem({ lang = "en" }: { lang?: Lang }) {
  if (!consentActive()) return null;
  return (
    <li>
      <ConsentReopen label={getT(lang)("consent.footer")} />
    </li>
  );
}

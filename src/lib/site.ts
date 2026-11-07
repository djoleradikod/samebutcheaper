export const SITE = {
  name: "SameButCheaper",
  tagline: "Brand names beside cheaper products, compared per unit.",
  description:
    "Cheaper alternatives to brand-name products, compared per unit. Each swap says what matches, what differs and what our records don't show, and links to at least two sources.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@samebutcheaper.com",
};

/** JSON for a JSON-LD script tag. Escapes "<" so a value holding "</script>" can't end the tag. */
export function jsonLdText(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

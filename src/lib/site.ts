export const SITE = {
  name: "SameButCheaper",
  tagline: "Same ingredients. Same results. Less money.",
  description:
    "Verified cheaper alternatives to brand-name products: the same active ingredients, the same formula, or the same specs, at a fraction of the price. Every swap is sourced and explained.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@samebutcheaper.com",
};

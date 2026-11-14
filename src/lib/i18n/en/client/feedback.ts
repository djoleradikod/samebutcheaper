export const feedback = {
  kinds: { price: "Price changed", stock: "Out of stock", product: "Not the same product", other: "Something else" },
  watchHeading: "Email me if this changes",
  watchIntro:
    "One email when the cheaper product's price moves 5% or more, the saving drops under 5%, or we withdraw this swap. We ask you to confirm your address first.",
  email: "Email address",
  saving: "Saving…",
  watch: "Watch this swap",
  watchIdle: "Only about this swap. Every email has a one-click stop link.",
  /** The cheaper product's store bars price alerts in its affiliate terms (src/lib/watch-terms.ts): no watch. */
  watchBarred: (store: string) => `No price watch here: ${store}'s affiliate terms don't allow price alerts for its products.`,
  /** Only the brand's store does: the watch follows the cheaper product's price alone. */
  watchBrandBarred: (store: string) =>
    `${store}'s affiliate terms don't allow price alerts for its products, so this watch follows the cheaper product's price only, not the saving.`,
  howWeUse: "How we use your address",
  somethingWrong: "Something wrong on this page?",
  whatsWrong: "What's wrong?",
  anything: "Anything we should know?",
  optional: "(optional)",
  placeholder: "For example the price you saw, and where",
  sending: "Sending…",
  send: "Send",
  noAccount: "No account or email needed. We don't store your IP address with your report.",
};

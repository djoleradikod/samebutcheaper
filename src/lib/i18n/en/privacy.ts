/**
 * /privacy: the privacy policy in English, from the facts in src/lib/privacy-facts.ts, kept in step with the German
 * one (src/lib/i18n/de/datenschutz.ts) by scripts/tests/privacy-facts.test.ts. What a lawyer still has to confirm is
 * in docs/legal-review-de.md.
 */
import type { PolicyFacts, PolicyText } from "../../privacy-facts";

/** "180 days", "a year", "2 years". */
function period(days: number) {
  if (days % 365 === 0) return days === 365 ? "a year" : `${days / 365} years`;
  return `${days} days`;
}

/** "amazon" -> "Amazon"; several joined with "and". */
function stores(list: string[]) {
  const names = list.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
}

const NETWORKS = "Amazon Associates, Awin, CJ, Rakuten, Impact, Partnerize, Skimlinks or Sovrn";

export const policy: PolicyText = {
  meta: {
    title: "Privacy",
    description: "What SameButCheaper stores about you, why, for how long and who handles it for us.",
  },
  page: {
    eyebrow: "Privacy",
    title: "Privacy policy",
    intro: "We collect as little as we can. Here is what we do keep, why and for how long.",
    loading: "Loading…",
    controllerHeading: "Who is responsible",
    collectHeading: "What we collect",
    logsHeading: "Server logs, abuse protection and backups",
    cookiesHeading: "Cookies",
    storageHeading: "What stays in your browser",
    processorsHeading: "Who else sees your data",
    basesHeading: "Legal bases",
    rightsHeading: "Your rights",
    choicesHeading: "Unsubscribing and deleting",
  },

  controller(notice) {
    if (!notice) {
      return [
        "[Not filled in yet: the name, postal address and email address of who is responsible. They come from the settings LEGAL_NAME, LEGAL_ADDRESS and LEGAL_EMAIL and appear here once they are set.]",
      ];
    }
    return [notice.name, ...notice.address, `Email: ${notice.email}`];
  },

  collected: ({ keep, photos }: PolicyFacts) => [
    {
      lead: "Clicks on store links.",
      text: `When you follow a link to a store, we record which swap or kit it was, which store, your selected country, the page you clicked on, and the site or campaign that first brought you to us, if the link carried one (see Cookies). To count separate visitors without storing your IP address, we keep a one-way hash of your IP address and browser that changes every day. After ${period(keep.clickDetail)} we delete the hash and the page you clicked on. Where the link goes through an affiliate programme, it carries a random click number so the programme can tell us about a sale. The rest of the record (swap, store, country, source and click number) stays, because sales are matched to it, and none of it says who you are.`,
    },
    {
      lead: "Sales.",
      text: `When a store's affiliate programme tells us a click led to a purchase, we record the order reference, the order total and our commission. We are not told who you are or what you bought. We drop anything personal a programme sends along, and delete the rest of its report after ${period(keep.clickDetail)}.`,
    },
    {
      lead: "Email address,",
      text: `only if you give it to us: to get our weekly letter, to watch a swap's price, to be told when we add a swap for something you searched for, or with a suggestion. Each of these is confirmed on its own (double opt-in): we send one email asking you to confirm that one thing, and send nothing about it until you do. Confirming one never signs you up for another. Opening the link only shows what you're confirming: nothing changes until you press the button on that page, so a mail scanner that opens links can't sign you up. If you don't confirm, the request is deleted after ${period(keep.unconfirmed)}, and an address with nothing confirmed goes with it. Once nothing is switched on for your address any more (no letter, no watch, no request waiting), we delete it ${keep.unconfirmed} days later. We record when you confirmed as proof that you asked. We also store the country you had selected, so we show prices in your currency, and the language of the page you signed up on, so we write to you in it. We use your address only to send what you asked for, and we never sell it or pass it on, except to the email service that delivers it for us (see below).`,
    },
    {
      lead: "Price watches.",
      text: `When you watch a swap, we store which swap and its prices at that moment, so we can tell you when they change. A watch you stop, or one that ends because we withdrew the swap, is deleted after ${period(keep.unconfirmed)}.`,
    },
    {
      lead: "“Tell me when you add it”.",
      text: `We store the search and your country with your address. When we add a swap whose brand or product name matches it, we email you once and the request ends. We delete it ${keep.unconfirmed} days after it ends or you stop it, or after ${period(keep.wishes)} if it is still waiting.`,
    },
    {
      lead: "The emails we send.",
      text: `We keep a log of each email we send you (what it was and when, and for the weekly letter which swaps it carried), so nobody gets the same one twice. The log is deleted after ${period(keep.sends)}. Our emails have no tracking pixels and we don't record whether you open them. Links to our own pages carry \`utm_source=newsletter\`, which tells us a visit came from an email, not who you are.`,
    },
    {
      lead: "Suggestions",
      text: "you send through the suggestion form, with your email address if you give it. There is no automatic deletion for suggestions yet: ask us and we delete yours.",
    },
    {
      lead: "“Something wrong?” reports.",
      text: `When you tell us a price, stock level or product on a page is wrong, we store what you picked, your note (we take out anything that looks like an email address or phone number), your selected country and the same daily-changing hash as for clicks, so one person can't count as several. We drop the hash after ${period(keep.reportHash)} and delete the report after ${period(keep.reports)}. When three or more people report a changed price or stock on the same page within two weeks, the page says shoppers have reported it until we've checked.`,
    },
    {
      lead: "Searches we had nothing for.",
      text: `When a search on our site finds nothing, or the product check reads a product we have no swap for, we count the words searched for (in lower case, shortened, and never anything that looks like an email address, web address or phone number) with the country and the day. Nothing about who searched is kept with the count. We delete these counts after ${period(keep.wanted)}.`,
    },
    {
      lead: "Product checks.",
      text: `When you search, scan or photograph a product on the product check page, we record what was looked up, your country and whether we had a swap on file, with the same daily-changing hash. This tells us which products to research next. We delete these records after ${period(keep.lookups)}. To find the product, our server sends the words or barcode you looked up to public product databases (see below); they see our server, not you.`,
    },
    {
      lead: "Photos.",
      text: photos
        ? "Barcodes are read on your own device. If a photo of a label has no readable barcode, and for every photo of a receipt, we send the photo to an AI service (Anthropic's Claude) that reads the text on it, and then discard it. We don't store your photos."
        : "Barcodes are read on your own device. Reading photos with an AI service is switched off at the moment, so no photo goes to one.",
    },
    {
      lead: "Shopping lists and receipts.",
      text: "When you paste a shopping list or the text of a receipt on the list check page, our server reads it to find matching swaps and then discards it. We keep only the cleaned names of products we couldn't match, with no prices and nothing that identifies you.",
    },
  ],

  logs: ({ backupDays }) => [
    "The web server that delivers our pages records requests in log files on our server, including your IP address, the date and time, the address requested and your browser's name. We use them to find faults and attacks. [Still to be set: how long these log files are kept.]",
    "So that nobody can send our forms or the product check thousands of requests in a short time, we count requests per IP address in the server's memory. These counts live only in memory, last a day at most and are never written to the database or to files. Our application's own logs contain no IP addresses and no email addresses.",
    `We make a backup of our database every night and keep the last ${backupDays}. Whatever we delete is gone from the backups ${backupDays} days later at the latest.`,
  ],

  cookiesIntro: (f) =>
    f.consentStores.length > 0
      ? "We set up to three small cookies of our own, and no advertising or analytics cookies from anyone else. None of them identifies you."
      : "We set two small cookies of our own, and no advertising or analytics cookies from anyone else. Neither identifies you.",
  cookie: {
    sbc_country: (days) =>
      `\`sbc_country\` holds a country code, so we show prices and stores for your country. On your first visit we set it from the country your browser names in its language settings, or that a network in front of our server reports from your connection. You can change it at any time. It lasts ${period(days)}.`,
    sbc_others: (days) => `\`sbc_others\` remembers for ${period(days)} whether you want to see swaps from other countries. We only set it when you switch that.`,
    sbc_consent: (days) =>
      `\`sbc_consent\` remembers for ${period(days)} whether you allowed the store tracking described below. We only set it when you choose, and you can change your choice with “Privacy choices” at the foot of every page.`,
  },
  cookiesAfter: (f) => [
    "We don't use a cookie, or anything else on your device, to see where visitors come from. If you arrived through a link from another site or a campaign, the page keeps that site's name (for example “google.com”) in memory while you browse, and adds it to a store link when you follow one, so it is stored with that click. It is gone when you close the tab. Older versions of our site kept it in a cookie called `sbc_src`: if your browser still has one, we delete it on your next visit.",
    f.consentStores.length > 0
      ? `When you visit a store through our links, the store or the affiliate network the link passes through may set its own cookies under its own privacy policy, which is how purchases are credited to us. ${stores(f.consentStores)} ask${f.consentStores.length === 1 ? "s" : ""} us to get your consent first. If you are in the EU, the EEA, the UK or Switzerland, or we can't tell where you are, we only send you through their tracking once you've allowed it; otherwise you get the store's plain link.`
      : "When you visit a store through our links, the store or the affiliate network the link passes through may set its own cookies under its own privacy policy, which is how purchases are credited to us.",
  ],

  storage: [
    "Your savings list, how often you buy things and the ticks on a kit's shopping list are kept by your browser on your device (in “local storage”, under `sbc:saved`, `sbc:how-often` and `sbc:kit-ticks:` followed by the kit's name). So that My list opens without a connection, the browser also keeps a copy of that page, the scripts and styles it needs, our offline pages and the last product photos you saw in its cache (`sbc-shell-`, `sbc-static-` and `sbc-images-`).",
    "None of this is sent to us, unless you share a link to your list yourself. To remove it, clear this site's data in your browser.",
  ],

  processors: ({ photos, consentStores }) => [
    "Our server and database are hosted by Hetzner. Emails are delivered for us by Resend, which receives your email address and the content of the email.",
    photos
      ? "Photos you choose to have read go to Anthropic, as described above. Resend and Anthropic are in the USA, so your data may be processed there."
      : "Resend is in the USA, so your data may be processed there.",
    "To look up a product, our server asks public product databases: Open Food Facts, Open Beauty Facts and Open Pet Food Facts, the US Food and Drug Administration's openFDA and the US National Institutes of Health's Dietary Supplement Label Database. They receive what was looked up, from our server, and nothing about you. The product photos in the product check's results come through our server too (it keeps the last few in memory and fetches only photos from those databases' own image servers), so those servers never see your IP address or your browser.",
    `When you follow a store link, our redirect (\`/go\`) sends you to the store, sometimes through an affiliate network (${NETWORKS}). The network and the store see your IP address like any website you open, and receive our random click number, nothing else from us.${consentStores.length > 0 ? ` For ${stores(consentStores)}, that only happens with your consent, as described under Cookies.` : ""}`,
  ],

  bases: ({ consentStores }) => [
    "We send the weekly letter, price watches and notices only with your consent (Art. 6(1)(a) GDPR), which you can withdraw at any time with effect for the future, most easily with the unsubscribe link in every email.",
    "We read lists, receipts and photos because you ask us to (Art. 6(1)(b) GDPR).",
    "Server logs, limits on repeated requests, backups and counting clicks (with where they came from), searches, product checks and reports rest on our legitimate interest (Art. 6(1)(f) GDPR): a safe, working site, settling accounts with affiliate programmes, and knowing which swaps are missing.",
    ...(consentStores.length > 0
      ? ["Store tracking that asks for consent runs only with yours (Art. 6(1)(a) GDPR and the rules on cookies, such as § 25 TDDDG in Germany and PECR in the UK)."]
      : []),
  ],

  rights: [
    "You have the right to know what data we hold about you (Art. 15 GDPR), to have it corrected (Art. 16), deleted (Art. 17), its use restricted (Art. 18) and to receive it in a portable form (Art. 20). You can object to processing that rests on our legitimate interest (Art. 21). You can withdraw a consent at any time (Art. 7(3)).",
    "You can also complain to a data protection authority, in particular in the country where you live or work (Art. 77 GDPR); in the UK that is the Information Commissioner's Office.",
    "We make no automated decisions about you and build no profiles. You don't have to give us any data: without an email address you just get no emails from us.",
  ],

  choices:
    "Every email we send has unsubscribe links that work in one click: one stops just that letter or watch, the other stops everything we send to your address. To have your email address or a suggestion deleted, or to ask what we hold about you, write to {mail}.",
  whoRuns: "Who runs this site: see the {impressum}.",
  impressumLink: "Impressum (legal notice)",
};

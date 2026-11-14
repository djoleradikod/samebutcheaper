/**
 * Trust and account pages: the consent choice (ConsentChoice.tsx), the pages an email's links open
 * (src/app/newsletter/**), and the short prose pages that have a German form (disclosure, about, how we check).
 */

/** The choice about store tracking that asks for consent (src/lib/consent.ts). Shown only while a programme asks. */
export const consent = {
  heading: "Store links and tracking",
  body: (stores: string) =>
    `${stores} only pay us for a purchase if their tracking, which uses their own cookies, can see that you came from us, and they ask us to get your consent first. If you don't allow it, their links still work and the prices are the same; they just don't know you came from us.`,
  allow: "Allow",
  decline: "Don't allow",
  policy: "Privacy policy",
  footer: "Privacy choices",
};

/**
 * The pages an email's links open (src/app/newsletter/**), in the subscriber's language: /newsletter/... in English,
 * /de/newsletter/... in German. {email}, {swap}, {home} and the like are pieces of the page put in by rich().
 */
export const newsletterPages = {
  loading: "Loading…",
  tooMany: "That's a lot of tries in a short time. Please wait a few minutes, then open the link again.",
  ourSide: "Something went wrong on our side. Please try the link again in a few minutes.",
  homePage: "home page",
  backHome: "Back to the home page",
  seeBiggest: "See the biggest savings",

  confirmTitle: "Confirm your email",
  confirmIntro: "One more step: press the button to confirm.",
  confirmLetter: "You're confirming that {email} should get our weekly letter: new swaps we've checked, at most one email a week.",
  confirmWatch: "You're confirming that {email} should get one email when the price of the swap {swap} moves 5% or more, its saving drops under 5%, or we withdraw it.",
  confirmWish: (query: string) => `You're confirming that {email} should get one email when we add a swap for “${query}”.`,
  yesLetter: "Yes, send me new swaps",
  yesWatch: "Yes, watch this swap",
  yesWish: "Yes, tell me",
  notAsked: "Didn't ask for this? Close this page and nothing happens. The request is removed after 30 days.",
  usedLink: "This link has already been used, has expired, or a newer email replaced it. If you asked more than once, use the link in the newest email.",
  askAgain: "Already confirmed? Then there's nothing more to do. Otherwise you can ask again from the {home} or the swap's page, and we'll send a new link.",

  confirmedTitle: "You're on the list",
  confirmedIntro: "Your email address is confirmed.",
  confirmedBody: "We'll email you when we've checked new swaps. Every email has an unsubscribe link, and one click takes you off the list.",
  confirmedNext: "{biggest} or {check}.",
  checkProduct: "check a product you buy",

  watchTitle: "You're watching this swap",
  watchIntro: "Your email address is confirmed for this price watch.",
  watchBody:
    "We'll email you once if the cheaper product's price moves 5% or more, the saving drops under 5%, or we withdraw the swap. Prices change on our site when we re-check them, so it can be weeks between emails, or none at all.",
  watchOnly: "This doesn't sign you up for anything else. Every email has a link that stops the watch in one click.",

  wishTitle: "Request confirmed",
  wishIntro: "Your email address is confirmed for this request.",
  wishBody:
    "We count every request like yours, and the products most people ask for are the ones we research first. We only add a swap once at least two sources back it up, so we can't promise when, or that we will.",
  wishOnly: "This doesn't sign you up for anything else.",
  suggest: "Know a cheaper product that does the same job? Tell us",

  invalidTitle: "That link didn't work",
  invalidIntro: "It may have been used already, expired, or part of it was cut off.",
  invalidBody:
    "A confirmation link works once, for 30 days, and a newer email replaces it. If you've already confirmed, there's nothing more to do. Otherwise you can ask again from the {home} or the swap's page, and we'll send a new link.",
  invalidUnsubscribe: "Trying to unsubscribe? Email {mail} from the address you signed up with and we'll remove it.",

  stoppedTitle: "Stopped",
  stoppedIntro: "We won't email you about that again.",
  stoppedBody: "Anything else you asked us for carries on. To stop everything, use the “Unsubscribe from everything” link at the foot of any of our emails.",

  unsubscribeTitle: "Unsubscribe",
  unsubscribeIntro: "Stop emails from SameButCheaper to this address.",
  incomplete: "This unsubscribe link is incomplete. Open the link from one of our emails again.",
  unknownLink: "We don't recognise this link. To be removed anyway, email {mail} from the address we write to.",
  alreadyOff: "{email} is already unsubscribed. We don't send it anything.",
  thisIsFor: "This is for {email}.",
  watchOn: (title: string) => `The first button stops the price watch on “${title}”.`,
  watchOff: (title: string) => `The price watch on “${title}” has already stopped.`,
  wishOn: (query: string) => `The first button stops your request about “${query}”.`,
  wishOff: (query: string) => `Your request about “${query}” has already ended.`,
  letterOn: "The first button stops the weekly letter; price watches you set up carry on.",
  letterOff: "The weekly letter is already off.",
  everything: "“Unsubscribe from everything” stops every email we send to this address.",
  stopLetter: "Stop the weekly letter",
  stopWatch: "Stop watching this swap",
  stopWish: "Stop this request",
  stopEverything: "Unsubscribe from everything",
  stopMe: "Unsubscribe me",

  unsubscribedTitle: "You're unsubscribed",
  unsubscribedIntro: "We won't email this address again.",
  unsubscribedBody: "Changed your mind? You can join again from the {home} at any time.",
};

type Env = Record<string, string | undefined>;

/**
 * The weekly letter's switches, read from the environment (see .env.example):
 *  - NEWSLETTER_WEEKLY=on sends it; anything else keeps it off;
 *  - NEWSLETTER_WEEKDAY, 1 (Monday) to 7 (Sunday), the first day of each ISO week it may go out (default 4);
 *  - NEWSLETTER_MAX_PER_RUN, the most letters one upkeep run sends (default 200; the rest go the next day);
 *  - MAIL_POSTAL_ADDRESS, the sender's postal address, which marketing email must carry. Without it the letter
 *    is held back.
 */
export function letterSettings(env: Env) {
  const weekday = Number(env.NEWSLETTER_WEEKDAY);
  const cap = Number(env.NEWSLETTER_MAX_PER_RUN);
  return {
    on: env.NEWSLETTER_WEEKLY?.trim().toLowerCase() === "on",
    weekday: Number.isInteger(weekday) && weekday >= 1 && weekday <= 7 ? weekday : 4,
    cap: Number.isFinite(cap) && cap >= 1 ? Math.floor(cap) : 200,
    postalAddress: env.MAIL_POSTAL_ADDRESS?.trim() || null,
  };
}

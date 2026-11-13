import { esc } from "./mail";

/**
 * The frame every list email shares: plain HTML with inline styles (mail apps drop style sheets), no images, no
 * tracking pixels and no web fonts, so it reads the same in every inbox and with images off. Text parts are
 * written alongside, never generated from the HTML.
 */
export type Footer = {
  /** Why this address gets this email, one sentence. */
  why: string;
  /** Stops just this list (the letter, or one watch). */
  stopThis?: { label: string; url: string };
  /** Stops everything for the address. */
  stopAll: string;
  siteUrl: string;
  contactEmail: string;
  /** The sender's postal address, required in marketing email in the US (CAN-SPAM) and expected in the EU. */
  postalAddress?: string | null;
};

export const COLORS = { ink: "#15171c", ink2: "#40454e", muted: "#6b7079", line: "#e2e4e7", canvas: "#f3f4f1", cobalt: "#1546d6", same: "#0b7a48", ticket: "#ffd60a" };

export function shell(opts: { title: string; preheader: string; body: string; footer: Footer }) {
  const { footer: f } = opts;
  const host = f.siteUrl.replace(/^https?:\/\//, "");
  const stop = [
    f.stopThis ? `<a href="${esc(f.stopThis.url)}" style="color:${COLORS.muted};text-decoration:underline">${esc(f.stopThis.label)}</a>` : "",
    `<a href="${esc(f.stopAll)}" style="color:${COLORS.muted};text-decoration:underline">Unsubscribe from everything</a>`,
  ]
    .filter(Boolean)
    .join(" &middot; ");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.canvas};font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.ink};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.canvas}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${COLORS.line};border-radius:8px">
<tr><td style="padding:24px 24px 4px"><a href="${esc(f.siteUrl)}" style="font-size:15px;font-weight:700;color:${COLORS.ink};text-decoration:none">SameButCheaper</a></td></tr>
<tr><td style="padding:8px 24px 24px">${opts.body}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td style="padding:16px 24px;font-size:12px;line-height:1.6;color:${COLORS.muted}">
<p style="margin:0 0 8px">${esc(f.why)}</p>
<p style="margin:0 0 8px">${stop}</p>
<p style="margin:0">SameButCheaper &middot; <a href="${esc(f.siteUrl)}" style="color:${COLORS.muted}">${esc(host)}</a> &middot; <a href="mailto:${esc(f.contactEmail)}" style="color:${COLORS.muted}">${esc(f.contactEmail)}</a>${f.postalAddress ? `<br>${esc(f.postalAddress)}` : ""}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

export function textFooter(f: Footer) {
  return [
    "--",
    f.why,
    ...(f.stopThis ? [`${f.stopThis.label}: ${f.stopThis.url}`] : []),
    `Unsubscribe from everything: ${f.stopAll}`,
    `SameButCheaper, ${f.siteUrl.replace(/^https?:\/\//, "")}, ${f.contactEmail}`,
    ...(f.postalAddress ? [f.postalAddress] : []),
  ].join("\n");
}

/** Adds the newsletter tags to a link on our own site. */
export function tagged(url: string, campaign: string) {
  const u = new URL(url);
  u.searchParams.set("utm_source", "newsletter");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", campaign);
  return u.toString();
}

export function button(label: string, url: string) {
  return `<a href="${esc(url)}" style="display:inline-block;background:${COLORS.ink};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 18px;border-radius:4px">${esc(label)}</a>`;
}

/** A product's name with its brand said once: "Bramwells (Aldi)" and "Aldi Bramwells Beans, 410g" already name it. */
export function fullName(brand: string, product: string) {
  const b = brand.replace(/\s*\(.*\)\s*$/, "").toLowerCase();
  return product.toLowerCase().includes(b) ? product : `${brand} ${product}`;
}

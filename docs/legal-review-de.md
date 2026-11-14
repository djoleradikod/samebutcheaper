# German legal texts: what a lawyer must still confirm

Written 14 Nov 2026 during the editor's pass over the German site. The German privacy policy (`/datenschutz`,
`src/lib/i18n/de/datenschutz.ts`) now describes what the code does. Nothing below is decided; each item is a question
for a German lawyer (IT and data protection, ideally with competition-law and HWG experience) before launch in
Germany and Austria. Items are ordered by risk.

**Changed later on 14 Nov 2026 (wave 6):** both privacy pages, English `/privacy` and German `/datenschutz`, are now
rendered from one list of facts (`src/lib/privacy-facts.ts`), and `scripts/tests/privacy-facts.test.ts` fails when the
code sets a cookie, storage key or cache the facts don't list, or when either page leaves one out. The `sbc_src`
cookie is gone (section 2), a consent mechanism exists but is switched off (section 2a), and German `/de/disclosure`,
`/de/about` and `/de/how-we-verify` exist (section 7). Section 6 is done.

## 1. Who is responsible (blocks launch)

- The controller (Art. 13(1)(a) GDPR) and the Impressum (§ 5 DDG, § 18 Abs. 2 MStV) come only from `LEGAL_NAME`,
  `LEGAL_ADDRESS`, `LEGAL_EMAIL` (optional `LEGAL_PHONE`, `LEGAL_VAT_ID`, `LEGAL_RESPONSIBLE`). Until they are set,
  `/datenschutz` shows a visible gap in square brackets and `/impressum` says it is not published. Confirm: who the
  controller is (a person or a company), whether a phone number or other "fast electronic contact" is needed beyond
  email (§ 5 Abs. 1 Nr. 2 DDG), and whether a data protection officer must be named (likely not, but confirm).
- The privacy page sends requests to `NEXT_PUBLIC_CONTACT_EMAIL`, the Impressum to `LEGAL_EMAIL`. Confirm one
  address is enough, or that both are monitored.

## 2. Cookies and browser storage (§ 25 TDDDG)

- `sbc_country` (1 year) is set on the first request, without asking, from a CDN country header or the browser's
  `Accept-Language`. `sbc_others` (1 year) is set only when the visitor switches "show other countries".
  Both look "strictly necessary" for a service the visitor asked for, but confirm.
- `sbc_src` is gone (wave 6). The first referring site or campaign is now kept only in the open page's memory
  (`src/components/SourceCarrier.tsx`) and added as `?src=` to the store link when the visitor clicks it; the click
  row stores it. Nothing is written to the device. A visitor's browser that still has the old cookie gets it deleted
  (`src/proxy.ts`). Confirm: reading `document.referrer` and the `utm_source`, `utm_medium` and `ref` parameters in the page, without storing them,
  is not "access to information stored in the terminal equipment" under § 25 Abs. 1 TDDDG.
- localStorage (`sbc:saved`, `sbc:how-often`, `sbc:kit-ticks:<slug>`) and the service worker's offline copies of
  `/my-list` and `/de/my-list`: set only by the visitor's own actions. Confirm they count as necessary.
- No consent banner is shown. Confirm none is needed now that `sbc_src` is gone and section 2a stays switched off.

## 2a. Consent for affiliate tracking (built, switched off)

- Some affiliate networks set their own tracking cookies once the visitor reaches the store, and a programme's terms
  may require consent first. The site can now ask: a programme with `terms.consentBeforeTracking: true` in
  `data/sellers/programmes.json` gets its links tagged only for visitors who chose "Allow" (cookie `sbc_consent`,
  6 months) or who are outside the EU, EEA, UK and Switzerland. Everyone else gets the plain store link, and a choice
  panel with equal "Allow" and "Don't allow" buttons appears, plus a "Datenschutz-Einstellungen" footer link to change
  the choice (`src/lib/consent.ts`, `src/components/ConsentChoice.tsx`).
- No programme has the flag today, so no panel shows and `sbc_consent` is never set. Both privacy pages describe the
  cookie and the consent basis only while some programme has the flag.
- Confirm: whether any programme (Amazon, Awin and others) needs the flag for DE/AT visitors, whether a store's own
  cookies after the click are the store's or the network's responsibility rather than ours, and whether the panel's
  wording and the 6-month lifetime are acceptable.

## 3. Legal bases (Art. 6 GDPR), as the page now states them

- Consent (lit. a): newsletter, price watches, "tell me when you add it", each with double opt-in.
- Request (lit. b): reading pasted lists, receipts and photos.
- Legitimate interest (lit. f): server logs, in-memory rate limiting, backups, counting clicks, searches, product
  checks and reports, and the daily-rotating visitor hash (SHA-256 of salt, day, IP address and user agent).
  Confirm each, and whether a balancing note is needed. Confirm that the daily hash is pseudonymous rather than
  anonymous data and is described correctly.

## 4. Transfers to the USA and processors (Art. 28, 44 ff. GDPR)

- Resend (email delivery) and Anthropic (reading photos, only when `ANTHROPIC_API_KEY` is set; label photos without
  a readable barcode and every receipt photo) are US companies. The page says data "can be processed there". Confirm:
  signed DPAs, the transfer basis (EU-US Data Privacy Framework certification or SCCs), whether the page must name it,
  and whether Anthropic's retention of API inputs must be stated.
- Hetzner hosts server and database (per `docs/deploy.md`). Confirm the contract (DPA) and the server location.
- If Cloudflare or another CDN is put in front (`CLIENT_IP_HEADER=cf-connecting-ip` in `deploy/Caddyfile`), it
  becomes a processor that sees every IP address and must be added to the page.
- Affiliate networks get a random click ID in the outbound link (`subId1` and similar). Confirm this is not a
  transfer of personal data, and whether the networks are separate controllers that must be named.
- Product checks look barcodes up in public databases (Open Food Facts and its sister sites, openFDA, NIH DSLD) from
  our server, so those services see our server, not the visitor. But the product pictures on a check result load
  straight from the Open Facts image servers, which then see the visitor's IP address. Both pages say so. Confirm
  this is acceptable, or serve those pictures through our own server (follow-up).

## 5. Retention

- Server access logs: the reverse proxy on the shared server is not ours (`docker-compose.deploy.yml`), so its log
  format and retention are unknown. The page shows "[Noch festzulegen: wie lange diese Logdateien aufbewahrt
  werden.]" until someone sets and states a period (commonly 7 to 14 days).
- Suggestions (`submissions`, with an optional email) have no deletion period in code. Both pages now say plainly
  that they are not deleted automatically yet. Set a period, then state it.
- Click rows keep slug, store, country, source and click ID with no end date (only hash and referrer go after
  `RETENTION_CLICK_DETAIL_DAYS`). Confirm this is fine as non-personal data.
- Backups: `BACKUP_KEEP_DAYS` (14) is read from the web container's environment; keep it in the same `.env` the
  backup job reads, or the page states the wrong number.

## 6. The English privacy page lags behind (done in wave 6)

`/privacy` and `/datenschutz` now render the same facts from `src/lib/privacy-facts.ts`, section by section, and a
test keeps them in step. The English report form now says "We don't store your IP address with your report", the
English check page names Anthropic only when photo reading is switched on, and the list check names it for photos.
Nothing left for a lawyer here beyond the items above; the English page is not a German legal text.

## 7. Affiliate disclosure (UWG § 5a Abs. 4, Amazon terms)

- Swap pages mark each earning link "Anzeige" and say under the prices which links earn. Kit, basket, list-check
  and My-list pages only have a general line. Confirm that is enough, or mark each earning link there too.
- Footer: "Als Amazon-Partner verdienen wir an qualifizierten Verkäufen." matches Amazon's German wording. A German
  disclosure page now exists (`/de/disclosure`, text in `src/lib/i18n/de/trust-pages.ts`), switched by the same
  settings as the English one. It is a separate text: when the English `/disclosure` wording changes, the German must
  be changed with it. Confirm the German wording.
- Confirm the "Keine Marke zahlt dafür, gelistet zu werden" and "ändert nie die Reihenfolge" claims are kept true
  (they are statements of fact a competitor could test).

## 8. Medicines (Heilmittelwerbegesetz)

- Swap pages on medicines carry the § 4 Abs. 3 HWG notice ("Zu Risiken und Nebenwirkungen lesen Sie die
  Packungsbeilage und fragen Sie Ihre Ärztin, Ihren Arzt oder in Ihrer Apotheke."). Confirm whether a price
  comparison with affiliate links is "Werbung" for HWG purposes at all, and if so whether the notice must also
  appear on medicine cards in lists, kits, baskets, search results and the list check, and in emails that name a
  medicine (the weekly newsletter and price-watch emails do not carry it today).
- Confirm "wirkstoffgleich" and "Gleicher Wirkstoff" (same active ingredient, strength and dosage form from the
  official label) are acceptable comparative statements under § 6 UWG and § 11 HWG, and that "Dasselbe zugelassene
  Arzneimittel" (shown when two packs share a marketing authorisation number) is accurate wording.
- Pharmacy-only medicines are linked to online pharmacies. Confirm affiliate links to apothekenpflichtige
  Arzneimittel are allowed (Berufsordnung, § 8 HWG on mail order) and that showing prices is fine.
- Several records say an alternative is "für Kinder ab …" or "für Erwachsene": these are label facts, not advice.
  Confirm the general line "Nichts hier ist medizinische Beratung" is enough.

## 9. Email (UWG § 7, DSGVO)

- Double opt-in with a POST confirmation page and logged confirmation time: looks right. Confirm the confirmation
  email itself contains no advertising (it does not today).
- Newsletters to DE and AT are held back until the Impressum is set (`src/lib/legal.ts`). Confirm every email also
  needs the full Impressum or a link is enough (today: a link and, for the letter, the postal address).

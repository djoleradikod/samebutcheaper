# German legal texts: what a lawyer must still confirm

Written 14 Nov 2026 during the editor's pass over the German site. The German privacy policy (`/datenschutz`,
`src/lib/i18n/de/datenschutz.ts`) now describes what the code does. Nothing below is decided; each item is a question
for a German lawyer (IT and data protection, ideally with competition-law and HWG experience) before launch in
Germany and Austria. Items are ordered by risk.

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
- `sbc_src` (30 days) stores the first referring site or campaign for attribution in /admin. This is very likely
  **not** strictly necessary and may need consent under § 25 Abs. 1 TDDDG. Options: ask for consent, keep it only in
  the click row without a cookie, or drop it for DE/AT visitors. The page states the cookie and its purpose but does
  not claim a legal basis for it.
- localStorage (`sbc:saved`, `sbc:how-often`, `sbc:kit-ticks:<slug>`) and the service worker's offline copy of
  `/my-list`: set only by the visitor's own actions. Confirm they count as necessary.
- No consent banner exists. Confirm none is needed once `sbc_src` is settled.

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

## 5. Retention

- Server access logs: the reverse proxy on the shared server is not ours (`docker-compose.deploy.yml`), so its log
  format and retention are unknown. The page shows "[Noch festzulegen: wie lange diese Logdateien aufbewahrt
  werden.]" until someone sets and states a period (commonly 7 to 14 days).
- Suggestions (`submissions`, with an optional email) have no deletion period in code. Set one.
- Click rows keep slug, store, country, source and click ID with no end date (only hash and referrer go after
  `RETENTION_CLICK_DETAIL_DAYS`). Confirm this is fine as non-personal data.
- Backups: `BACKUP_KEEP_DAYS` (14) is read from the web container's environment; keep it in the same `.env` the
  backup job reads, or the page states the wrong number.

## 6. The English privacy page lags behind

`/privacy` (English, not changed in this pass) still says "two small cookies", does not mention server logs,
receipt photos going to Anthropic, browser storage, rights, legal bases or the controller. The German page is now
the more complete one. Bring the English page to the same facts; the code also claimed "We never store your IP
address" under the report form in German (now corrected to "not with your report"), and the English form still says it.

## 7. Affiliate disclosure (UWG § 5a Abs. 4, Amazon terms)

- Swap pages mark each earning link "Anzeige" and say under the prices which links earn. Kit, basket, list-check
  and My-list pages only have a general line. Confirm that is enough, or mark each earning link there too.
- Footer: "Als Amazon-Partner verdienen wir an qualifizierten Verkäufen." matches Amazon's German wording. The
  full disclosure page (`/disclosure`) exists only in English. Confirm whether a German version is required.
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

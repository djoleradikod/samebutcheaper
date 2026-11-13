import { getDb } from "@/db";
import { isoWeek, letterMail, letterSettings, sampleIssue, TEST_TOKEN } from "@/lib/letter";
import { isKnownCountry } from "@/lib/markets";
import { isAdminRequest } from "@/lib/server/admin";
import { SITE } from "@/lib/site";

/**
 * GET /admin/letter-preview?country=DE[&format=text]  This week's letter as a new reader in that country would get
 * it, as a page. Nothing is sent or recorded.
 */
export async function GET(request: Request) {
  if (!(await isAdminRequest())) return new Response("Authentication required", { status: 401 });
  const params = new URL(request.url).searchParams;
  const country = params.get("country");
  const now = new Date();
  const issue = await sampleIssue(getDb(), isKnownCountry(country) ? country : null, now);
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
  if (!issue) return new Response("Nothing to send for that country.", { status: 404, headers });
  const mail = letterMail(
    issue,
    { to: "preview@example.com", token: TEST_TOKEN, issueKey: isoWeek(now), test: true },
    { siteUrl: SITE.url, contactEmail: SITE.contactEmail, postalAddress: letterSettings(process.env).postalAddress ?? "(MAIL_POSTAL_ADDRESS is not set)" },
  );
  if (params.get("format") === "text") {
    return new Response(`Subject: ${mail.subject}\n\n${mail.text}`, { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(mail.html, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}

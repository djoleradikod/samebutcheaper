"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { isoWeek, letterMail, letterSettings, sampleIssue, TEST_TOKEN } from "@/lib/letter";
import { log } from "@/lib/log";
import { mailConfigured, sendMail } from "@/lib/mail";
import { runMaintenance } from "@/lib/maintenance";
import { isKnownCountry } from "@/lib/markets";
import { closeReports } from "@/lib/reports";
import { isAdminRequest } from "@/lib/server/admin";
import { SITE } from "@/lib/site";

const STATUSES = schema.submissionStatus.enumValues;

/** Moves a visitor's suggestion through the research queue: new, researching, accepted or rejected. */
export async function setSubmissionStatus(formData: FormData) {
  if (!(await isAdminRequest())) throw new Error("Not authorized");
  const id = Number(formData.get("id"));
  const status = STATUSES.find((s) => s === formData.get("status"));
  const db = getDb();
  if (!db || !Number.isInteger(id) || id < 1 || !status) return;
  await db.update(schema.submissions).set({ status }).where(eq(schema.submissions.id, id));
  revalidatePath("/admin");
}

/** Runs the daily upkeep now (see src/lib/maintenance.ts). */
export async function runUpkeepNow() {
  if (!(await isAdminRequest())) throw new Error("Not authorized");
  const db = getDb();
  if (!db) return;
  try {
    const report = await runMaintenance(db, { siteUrl: SITE.url });
    if (report) log.info("maintenance.done", { ...report, by: "admin" });
  } catch (err) {
    log.error("maintenance.failed", { err });
  }
  revalidatePath("/admin");
}

/** Resolves or dismisses one report, or every open report on a record. */
export async function closeReport(formData: FormData) {
  if (!(await isAdminRequest())) throw new Error("Not authorized");
  const status = formData.get("status") === "dismissed" ? "dismissed" : "resolved";
  const db = getDb();
  if (!db) return;
  const id = Number(formData.get("id"));
  if (Number.isInteger(id) && id > 0) {
    await closeReports(db, { ids: [id] }, status);
  } else {
    const recordKind = formData.get("record") === "bundle" ? "bundle" : "pair";
    const slug = String(formData.get("slug") ?? "").slice(0, 160);
    if (slug) await closeReports(db, { recordKind, slug }, status);
  }
  revalidatePath("/admin");
}

export type TestState = { ok: boolean; message: string } | null;

/** "Send a test to me": this week's letter as a brand-new subscriber in the chosen country would get it. */
export async function sendTestLetter(_prev: TestState, formData: FormData): Promise<TestState> {
  if (!(await isAdminRequest())) throw new Error("Not authorized");
  const email = z.string().trim().toLowerCase().email().max(320).safeParse(formData.get("email"));
  if (!email.success) return { ok: false, message: "Enter the address to send the test to." };
  const country = String(formData.get("country") ?? "");
  const cc = isKnownCountry(country) ? country : null;
  if (!mailConfigured()) {
    return { ok: false, message: "Email isn't set up (RESEND_API_KEY and MAIL_FROM), so nothing can be sent. Use the preview links instead." };
  }
  try {
    const issue = await sampleIssue(getDb(), cc);
    if (!issue) return { ok: false, message: "There is nothing to put in a letter for that country." };
    const postal = letterSettings(process.env).postalAddress ?? "(MAIL_POSTAL_ADDRESS is not set: the real letter is held back until it is)";
    const mail = letterMail(
      issue,
      { to: email.data, token: TEST_TOKEN, issueKey: isoWeek(new Date()), test: true },
      { siteUrl: SITE.url, contactEmail: SITE.contactEmail, postalAddress: postal },
    );
    const result = await sendMail(mail);
    if (!result.ok) return { ok: false, message: `The send failed (${result.detail ?? result.reason}). The server log has the details.` };
    log.info("letter.test_sent", { country: cc ?? "unknown" });
    return { ok: true, message: `Sent to ${email.data}. Its unsubscribe links are placeholders and do nothing.` };
  } catch (err) {
    log.error("letter.test_failed", { err });
    return { ok: false, message: "Something went wrong. The server log has the details." };
  }
}

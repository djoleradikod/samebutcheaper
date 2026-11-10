"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { log } from "@/lib/log";
import { runMaintenance } from "@/lib/maintenance";
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

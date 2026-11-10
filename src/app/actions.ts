"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { log } from "@/lib/log";
import { mailConfigured } from "@/lib/mail";
import { isKnownCountry } from "@/lib/markets";
import { subscribeEmail } from "@/lib/newsletter";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { SITE } from "@/lib/site";
import { visitorFrom } from "@/lib/visitor";

export type FormState = { ok: boolean; message: string } | null;

const emailSchema = z.string().trim().toLowerCase().email().max(320);

const TOO_MANY: FormState = { ok: false, message: "That's a lot of tries in a short time. Please wait a few minutes." };

/** One form submission from this visitor: refused when they are over the form limit, or look like a script. */
async function formVisitor() {
  const visitor = visitorFrom(new Headers(await headers()));
  return { visitor, allowed: rateLimit("forms", visitor.key, LIMITS.forms).ok };
}

export async function subscribe(_prev: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("company")) return { ok: true, message: "Thanks!" }; // honeypot
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { ok: false, message: "Please enter a valid email address." };
  const { allowed } = await formVisitor();
  if (!allowed) return TOO_MANY;
  const db = getDb();
  if (!db) return { ok: false, message: "Sign-ups are not open yet. Please check back soon." };
  try {
    const cookieCountry = (await cookies()).get("sbc_country")?.value;
    const outcome = await subscribeEmail(
      db,
      {
        email: email.data,
        source: String(formData.get("source") ?? "site").slice(0, 64),
        country: isKnownCountry(cookieCountry) ? cookieCountry : null,
      },
      { siteUrl: SITE.url },
    );
    // The same answer whether or not the address was already on the list, so the form can't be used to find out.
    return {
      ok: true,
      message: mailConfigured() && outcome !== "stored"
        ? "Almost there. We've sent you an email: click the link in it to confirm."
        : "You're on the list. We'll email you once to confirm before the first send.",
    };
  } catch (err) {
    log.error("subscribe.failed", { err });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

const submissionSchema = z.object({
  brandProduct: z.string().trim().min(2, "Tell us the brand-name product.").max(300),
  alternativeProduct: z.string().trim().max(300).optional(),
  reason: z.string().trim().max(2000).optional(),
  evidenceUrl: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .refine((v) => !v || /^https?:\/\//.test(v), "The evidence link should start with http(s)://"),
  email: z
    .string()
    .trim()
    .max(320)
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "That email doesn't look right."),
});

export async function suggestSwap(_prev: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("company")) return { ok: true, message: "Thanks!" }; // honeypot
  const val = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() ? v : undefined;
  };
  const parsed = submissionSchema.safeParse({
    brandProduct: val("brandProduct") ?? "",
    alternativeProduct: val("alternativeProduct"),
    reason: val("reason"),
    evidenceUrl: val("evidenceUrl"),
    email: val("email"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { allowed } = await formVisitor();
  if (!allowed) return TOO_MANY;
  const db = getDb();
  if (!db) return { ok: false, message: "Suggestions are not open yet. Please check back soon." };
  try {
    await db.insert(schema.submissions).values(parsed.data);
    return {
      ok: true,
      message: "Thank you! We'll research it and add it if the evidence holds up.",
    };
  } catch (err) {
    log.error("suggest.failed", { err });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

"use server";

import { z } from "zod";
import { getDb, schema } from "@/db";

export type FormState = { ok: boolean; message: string } | null;

const emailSchema = z.string().trim().toLowerCase().email().max(320);

export async function subscribe(_prev: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("company")) return { ok: true, message: "Thanks!" }; // honeypot
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { ok: false, message: "Please enter a valid email address." };
  const db = getDb();
  if (!db) return { ok: false, message: "Sign-ups are not open yet. Please check back soon." };
  try {
    await db
      .insert(schema.subscribers)
      .values({ email: email.data, source: String(formData.get("source") ?? "site").slice(0, 64) })
      .onConflictDoNothing();
    return { ok: true, message: "You're in. We'll send new swaps as we verify them." };
  } catch (err) {
    console.error("subscribe failed", err);
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
  const db = getDb();
  if (!db) return { ok: false, message: "Suggestions are not open yet. Please check back soon." };
  try {
    await db.insert(schema.submissions).values(parsed.data);
    return {
      ok: true,
      message: "Thank you! We'll research it and add it if the evidence holds up.",
    };
  } catch (err) {
    console.error("suggestSwap failed", err);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

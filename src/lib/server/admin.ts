import "server-only";
import { headers } from "next/headers";
import { isAdminAuthorized } from "@/lib/admin-auth";

/**
 * True when this request carries the admin password. src/proxy.ts already guards every /admin URL, but a Server
 * Action can be posted to any page, so each admin action and export checks again here.
 */
export async function isAdminRequest() {
  return isAdminAuthorized((await headers()).get("authorization"), process.env.ADMIN_PASSWORD);
}

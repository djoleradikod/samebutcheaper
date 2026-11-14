import { revalidatePath } from "next/cache";
import { EXPIRE_HEADER, isPriceToken } from "@/lib/server/price-clock";

/**
 * Called only by this server's own price clock (src/lib/server/price-clock.ts), over loopback with a token that never
 * leaves the process: a time-limited price's window has closed, so every cached page and route is dropped and renders
 * again on its next visit, with the price withheld. Anyone else gets a 404.
 */
export async function POST(request: Request) {
  if (!isPriceToken(request.headers.get(EXPIRE_HEADER))) return new Response("Not found", { status: 404 });
  revalidatePath("/", "layout");
  return new Response(null, { status: 204 });
}

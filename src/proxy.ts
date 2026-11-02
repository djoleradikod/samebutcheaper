import { NextResponse, type NextRequest } from "next/server";

/** HTTP Basic auth for /admin. Set ADMIN_PASSWORD (user name is "admin"). */
export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new NextResponse("Admin is disabled. Set ADMIN_PASSWORD.", { status: 404 });

  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, pass] = atob(encoded).split(":");
    if (user === "admin" && pass === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SameButCheaper admin"' },
  });
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
